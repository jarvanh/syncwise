import { KEY_SYNCED_TWITTER_BOOKMARKS_ID_LIST, KEY_TWITTER_BOOKMARKS } from '../../constants/twitter'

type TCallback = (args: Record<string, any>) => void

class LocalStorageStore<T> {
    private storeKey: string

    constructor(storeKey: string) {
        this.storeKey = storeKey
    }

    // 创建或更新记录
    upsert(data: T, fn?: TCallback): void {
        const currentData = this.load()
        if (currentData == null) {
            this.save(data, fn)
        } else {
            this.insert(data, fn)
        }
    }

    load(): T | null {
        const data = localStorage.getItem(this.storeKey)
        return data ? JSON.parse(data) : null
    }

    // 删除数据
    delete(): void {
        localStorage.removeItem(this.storeKey)
    }

    // 创建或更新数据
    private save(data: T, fn?: TCallback): void {
        localStorage.setItem(this.storeKey, JSON.stringify(data))
        fn?.({
            length: (data as any).length,
        })
    }

    // 读取数据

    // 去重更新数据
    private insert(data: T, fn?: TCallback): void {
        const currentData = this.load()
        let list: any = []

        if (Array.isArray(currentData)) {
            const savedList = currentData.map((item: any) => item.id)
            list = (data as any).filter((item: any) => item.id && !savedList.includes(item.id))
        }
        const oldList: any = currentData ?? []
        this.save([...oldList, ...list] as any, fn)
    }
}

// 或许加上这个人的 ID，以防一个浏览器里多个 X 账号
const bookmarksStore = new LocalStorageStore(KEY_TWITTER_BOOKMARKS)
const syncedBookmarksStore = new LocalStorageStore(KEY_SYNCED_TWITTER_BOOKMARKS_ID_LIST)

export { bookmarksStore, syncedBookmarksStore }
