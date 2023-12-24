import i18next from 'i18next'
import { TranslateType } from '../i18n'
import enUS from '../i18n/en-US.json'
import zhCN from '../i18n/zh-CN.json'
import zhTW from '../i18n/zh-TW.json'
import jaJP from '../i18n/ja-JP.json'
import { Lang, langList } from './langs'
import Browser from 'webextension-polyfill'

export function setLanguage(lang: Lang) {
    localStorage.setItem('language', lang)
    location.reload()
}

export const langs = langList.filter((it) => (['en-US', 'zh-CN', 'zh-TW', 'ja-JP'] as Lang[]).includes(it.value))

export const initI18n = async () => {
    // if (localStorage.getItem('i18nInit') === '1') return;
    await i18next.init({
        lng: (await Browser.storage.sync.get('language')).language,
        fallbackLng: 'en-US',
        debug: true,
        resources: {
            'en-US': { translation: enUS },
            'zh-CN': { translation: zhCN },
            'zh-TW': { translation: zhTW },
            'ja-JP': { translation: jaJP },
        } as Record<Lang, { translation: any }>,
        keySeparator: false,
    })
    // localStorage.setItem('i18nInit', '1')
}

type T = TranslateType

/**
 * Get the translated text according to the key
 * @param args
 */
export function t<K extends keyof T>(...args: T[K]['params']): T[K]['value'] {
    // @ts-ignore
    return i18next.t(args[0], args[1])
}
