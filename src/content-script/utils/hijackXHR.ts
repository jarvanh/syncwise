import { AsyncArray } from '@liuli-util/async';
import { TweetInfo, initIndexeddb } from './initIndexeddb';
import { get, pick } from 'lodash-es';
import { blockUser } from './blockUser';
import { bookmarksStore } from './store';
import {
  MESSAGE_ORIGIN_CONTENT,
  MESSAGE_SAVE_DATA_TO_DB,
  TWITTER_BOOKMARKS_XHR_HIJACK,
} from '../../constants/twitter';
import { initDB } from './db';
import { parseBookmarkResponse } from '../../parser/twitter';
import Browser from 'webextension-polyfill';

const blockUserIds = new Set<string>();

export function parseTwitterResponseResult(result: any): TweetInfo {
  const fullText = result.legacy.full_text;
  const lang = result.legacy.lang;
  const following = !!result.core.user_results.result.legacy.following;
  const description = result.core.user_results.result.legacy.description;
  const name = result.core.user_results.result.legacy.name;
  const username = result.core.user_results.result.legacy.screen_name;
  const avatar = result.core.user_results.result.legacy.profile_image_url_https;
  const restId = result.rest_id;
  const userId = result.core.user_results.result.rest_id;

  return {
    id: restId,
    fullText: fullText,
    description,
    name,
    username,
    userId,
    avatar,
    lang,
    following,
  };
}

export function parseTwitterResponserInfo(response: any): TweetInfo[] {
  const entries = response.data.threaded_conversation_with_injections_v2
    .instructions[0].entries as any[];
  return (
    entries
      .flatMap((it: any) => {
        const entityId = it.entryId as string;
        if (entityId.startsWith('conversationthread-')) {
          return it.content.items
            .filter(
              (it: any) => it.item.itemContent.itemType === 'TimelineTweet',
            )
            .map((it: any) => it.item.itemContent.tweet_results.result);
        }
        if (entityId.startsWith('tweet-')) {
          return [it.content.itemContent.tweet_results.result];
        }
        return [];
      })
      // "TweetWithVisibilityResults" | "Tweet"
      .filter((it) => it.__typename === 'Tweet')
      .map((result: any) => {
        return parseTwitterResponseResult(result);
      })
  );
}

async function updateDatabase(tweets: TweetInfo[]) {
  const db = await initIndexeddb();
  const tweetStore = db.transaction('tweet', 'readwrite').objectStore('tweet');
  await AsyncArray.forEach(tweets, async (it) => {
    await tweetStore.put(it);
  });
}

async function handleTweetDetail(responseBody: any) {
  const tweets = parseTwitterResponserInfo(responseBody);
  const db = await initIndexeddb();
  const blockList = await AsyncArray.filter(
    tweets
      .filter((it) => !it.following)
      .map((it) => pick(it, 'userId', 'username')),
    async (it) => {
      const blockUser = await db
        .transaction('block', 'readonly')
        .objectStore('block')
        .get(it.userId);
      return !!blockUser;
    },
  );
  await updateDatabase(parseTwitterResponserInfo(responseBody));
  if (blockList.length === 0) {
    return;
  }
  console.log('blockList: ', blockList);
  await AsyncArray.forEach(blockList, async (it) => {
    blockUser(it.userId);
  });
}

export function parseTwitterTimeline(responseBody: any): TweetInfo[] {
  return (
    responseBody.data.user.result.timeline_v2.timeline.instructions.find(
      (it: any) => it.type === 'TimelineAddEntries',
    ).entries as any[]
  )
    .map((it) => get(it, 'content.itemContent.tweet_results.result'))
    .filter((it: any) => it && it.__typename === 'Tweet')
    .map(parseTwitterResponseResult);
}

async function handleTimeline(responseBody: any) {
  // console.log('handleTimeline', responseBody)
  await updateDatabase(parseTwitterTimeline(responseBody));
}

function hookXHR(options: { after(xhr: XMLHttpRequest): string | void }) {
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('readystatechange', () => {
      if (this.readyState === 4) {
        const r = options.after(this);
        if (!r) {
          return;
        }
        Object.defineProperty(this, 'responseText', {
          value: r,
          writable: true,
        });
        Object.defineProperty(this, 'response', {
          value: r,
          writable: true,
        });
      }
    });

    return send.apply(this, arguments as any);
  };
}

export async function initBlockUserIds() {
  const db = await initIndexeddb();
  const keys = await db.getAllKeys('block');
  keys.forEach((it) => blockUserIds.add(it));
}

export function filterTweets(
  response: any,
  isBlock: (tweet: TweetInfo) => boolean,
) {
  const entries = response.data.threaded_conversation_with_injections_v2
    .instructions[0].entries as any[];
  entries
    .filter((entry: any) => entry.entryId.includes('conversationthread-'))
    .forEach((entry) => {
      entry.content.items = entry.content.items.filter((it: any) => {
        if (it.item.itemContent.cursorType === 'ShowMore') {
          return true;
        }
        const result = it.item.itemContent.tweet_results.result;
        if (result.__typename !== 'Tweet') {
          return true;
        }
        const tweet = parseTwitterResponseResult(result);
        // console.log('isBlock', tweet.username, isBlock(tweet))
        return !isBlock(tweet);
      });
    });
  return response;
}

function filterEntries(list: any[]) {
  return list.filter((item) => !item.entryId.includes('cursor'));
}

// content-js 和 background 实例化之后，不是一个 DB。
let db: any = null;

(async () => {
  db = await initDB();
  console.log('Database initialized', db);
})();

export async function hijackXHR() {
  console.log('hijackXHR');
  hookXHR({
    after(xhr) {
      const isHijack = localStorage.getItem(TWITTER_BOOKMARKS_XHR_HIJACK);
      console.log('isHijack', isHijack);
      if (!isHijack) return;

      if (
        /https:\/\/twitter.com\/i\/api\/graphql\/.*\/Bookmarks/.test(
          xhr.responseURL,
        )
      ) {
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          const response = JSON.parse(xhr.responseText);
          // handleTweetDetail(response)
          const entries = filterEntries(
            response?.data?.bookmark_timeline_v2?.timeline?.instructions?.[0]
              ?.entries ?? [],
          );
          console.log('Bookmarks entries', entries);
          const parsedList = entries.map(parseBookmarkResponse);
          // sendMessageToBackground(parsedList)
          // if (db) {
          //   parsedList.map((x) => {
          //     db.put('bookmarks', {
          //       url: x.url,
          //       screen_name: x.screen_name,
          //     });
          //   });
          // } else {
          //   console.log('db not initialized');
          // }
          console.log('parsedList:', parsedList);
          // 去重逻辑
          bookmarksStore.upsert(parsedList);
        }
      }
    },
  });
}

// function sendMessageToBackground(list: TweetBookmarkParsedItem[]) {
//   Browser.runtime.sendMessage({
//     from: MESSAGE_SAVE_DATA_TO_DB,
//     type: "save",
//     data: list
//   });
// }
