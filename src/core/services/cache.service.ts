/**
 * 缓存服务 - 用于缓存群组和用户信息
 */

import { Context } from 'koishi'
import { resolve } from 'path'
import { JsonDataStore } from '../data/json.store'

/** 群组缓存信息 */
export interface GuildCacheInfo {
  id: string
  name: string
  avatar?: string
  lastUpdate: number
}

/** 用户缓存信息 */
export interface UserCacheInfo {
  id: string
  name: string
  avatar?: string
  lastUpdate: number
}

/** 群成员缓存信息 */
export interface MemberCacheInfo {
  guildId: string
  userId: string
  nick?: string
  name?: string
  avatar?: string
  lastUpdate: number
}

/** 缓存数据结构 */
interface CacheData {
  guilds: Record<string, GuildCacheInfo>
  users: Record<string, UserCacheInfo>
  members: Record<string, MemberCacheInfo> // key: `${guildId}:${userId}`
  metadata: {
    lastFullRefresh: number
    version: string
  }
  [key: string]: unknown
}

/**
 * 各类缓存的条目上限。超出后按 lastUpdate 淘汰最旧的一批。
 *
 * 过期时间只决定"要不要刷新"，从不删除条目，因此没有上限的话
 * cache.json 会随机器人见过的群/用户/成员组合无限增长；
 * members 是 guildId×userId 组合，增长最快，给的配额也最大。
 */
const CACHE_LIMITS = {
  guilds: 1000,
  users: 5000,
  members: 20000
} as const

/** 触发淘汰时一次清理到上限的比例，避免每次写入都要排序 */
const CACHE_EVICT_RATIO = 0.9

export class CacheService {
  private store: JsonDataStore<CacheData>
  private logger: any
  private cacheExpiry = 7 * 24 * 60 * 60 * 1000 // 7天过期

  // 同一 key 正在进行的拉取，复用同一个 Promise，避免并发重复打 API
  private pending = new Map<string, Promise<any>>()
  // 拉取失败的 key 及失败时间，短期内不再重试，避免对协议端反复无效请求
  private negativeCache = new Map<string, number>()
  private negativeTtl = 5 * 60 * 1000

  /** 释放底层存储：落盘挂起的写入并停掉定时器 */
  dispose(): void {
    this.store.dispose()
  }

  private isExpired(entry: { lastUpdate: number } | undefined, now = Date.now()): boolean {
    return !entry || now - entry.lastUpdate >= this.cacheExpiry
  }

  private isNegative(key: string, now = Date.now()): boolean {
    const failedAt = this.negativeCache.get(key)
    if (failedAt === undefined) return false
    if (now - failedAt < this.negativeTtl) return true
    this.negativeCache.delete(key)
    return false
  }

  private dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>
    const task = factory().finally(() => this.pending.delete(key))
    this.pending.set(key, task)
    return task
  }

  /**
   * 若某类缓存超出上限，按 lastUpdate 从旧到新淘汰到 90%。
   * 就地修改传入的 data，由调用方负责写回。
   */
  private evictIfNeeded(data: CacheData, kind: keyof typeof CACHE_LIMITS): void {
    const limit = CACHE_LIMITS[kind]
    const bucket = data[kind] as Record<string, { lastUpdate: number }>
    const keys = Object.keys(bucket)
    if (keys.length <= limit) return

    const keepCount = Math.floor(limit * CACHE_EVICT_RATIO)
    const sorted = keys.sort((a, b) => (bucket[b]?.lastUpdate || 0) - (bucket[a]?.lastUpdate || 0))
    for (const key of sorted.slice(keepCount)) {
      delete bucket[key]
    }
    this.logger.debug(`缓存 ${kind} 超出上限 ${limit}，已淘汰 ${keys.length - keepCount} 条`)
  }

  constructor(private ctx: Context, dataDir: string) {
    this.logger = ctx.logger('grouphelper:cache')
    const cachePath = resolve(dataDir, 'cache.json')

    this.store = new JsonDataStore<CacheData>(cachePath, {
      guilds: {},
      users: {},
      members: {},
      metadata: {
        lastFullRefresh: 0,
        version: '1.0.0'
      }
    })
  }

  /** 获取群组信息（优先从缓存） */
  async getGuildInfo(guildId: string, forceRefresh = false): Promise<GuildCacheInfo | null> {
    const cached = this.store.getAll().guilds[guildId]
    if (!forceRefresh && !this.isExpired(cached)) return cached
    if (!forceRefresh && this.isNegative(`guild:${guildId}`)) return cached ?? null

    return this.dedupe(`guild:${guildId}`, async () => {
      for (const bot of this.ctx.bots) {
        try {
          const guild = await bot.getGuild(guildId)
          if (guild) {
            let avatar = guild.avatar
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`
            }

            const info: GuildCacheInfo = {
              id: guildId,
              name: guild.name,
              avatar,
              lastUpdate: Date.now()
            }

            const data = this.store.getAll()
            data.guilds[guildId] = info
            this.evictIfNeeded(data, 'guilds')
            this.store.setAll(data)
            this.negativeCache.delete(`guild:${guildId}`)
            return info
          }
        } catch (e) {
          // 继续尝试下一个 bot
        }
      }

      this.negativeCache.set(`guild:${guildId}`, Date.now())
      if (cached) {
        this.logger.warn(`无法刷新群组 ${guildId} 信息，使用过期缓存`)
        return cached
      }
      return null
    })
  }

  /** 获取用户信息（优先从缓存） */
  async getUserInfo(userId: string, forceRefresh = false): Promise<UserCacheInfo | null> {
    const cached = this.store.getAll().users[userId]
    if (!forceRefresh && !this.isExpired(cached)) return cached
    if (!forceRefresh && this.isNegative(`user:${userId}`)) return cached ?? null

    return this.dedupe(`user:${userId}`, async () => {
      for (const bot of this.ctx.bots) {
        try {
          const user = await bot.getUser(userId)
          if (user) {
            let avatar = user.avatar
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }

            const info: UserCacheInfo = {
              id: userId,
              name: user.name || user.nick || userId,
              avatar,
              lastUpdate: Date.now()
            }

            const data = this.store.getAll()
            data.users[userId] = info
            this.evictIfNeeded(data, 'users')
            this.store.setAll(data)
            this.negativeCache.delete(`user:${userId}`)
            return info
          }
        } catch (e) {
          // 继续尝试
        }
      }

      this.negativeCache.set(`user:${userId}`, Date.now())
      if (cached) {
        this.logger.warn(`无法刷新用户 ${userId} 信息，使用过期缓存`)
        return cached
      }
      return null
    })
  }

  /** 获取群成员信息（优先从缓存） */
  async getMemberInfo(guildId: string, userId: string, forceRefresh = false): Promise<MemberCacheInfo | null> {
    const key = `${guildId}:${userId}`
    const cached = this.store.getAll().members[key]
    if (!forceRefresh && !this.isExpired(cached)) return cached
    if (!forceRefresh && this.isNegative(`member:${key}`)) return cached ?? null

    return this.dedupe(`member:${key}`, async () => {
      for (const bot of this.ctx.bots) {
        try {
          const member = await bot.getGuildMember(guildId, userId)
          if (member) {
            let avatar = member.avatar || member.user?.avatar
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }

            const info: MemberCacheInfo = {
              guildId,
              userId,
              nick: member.nick,
              name: member.user?.name,
              avatar,
              lastUpdate: Date.now()
            }

            const data = this.store.getAll()
            data.members[key] = info
            this.evictIfNeeded(data, 'members')
            this.store.setAll(data)
            this.negativeCache.delete(`member:${key}`)
            return info
          }
        } catch (e) {
          // 继续尝试
        }
      }

      this.negativeCache.set(`member:${key}`, Date.now())
      if (cached) {
        this.logger.warn(`无法刷新群成员 ${guildId}:${userId} 信息，使用过期缓存`)
        return cached
      }
      return null
    })
  }

  /** 批量预热缓存（缓存未缓存或已过期的） */
  async warmCache(guildIds: string[], userIds: string[], memberPairs: Array<{ guildId: string, userId: string }>): Promise<void> {
    const allData = this.store.getAll()
    const uniqueGuildIds = Array.from(new Set(guildIds))
    const uniqueUserIds = Array.from(new Set(userIds))
    const seenMembers = new Set<string>()
    const uniqueMemberPairs = memberPairs.filter(({ guildId, userId }) => {
      const key = `${guildId}:${userId}`
      if (seenMembers.has(key)) return false
      seenMembers.add(key)
      return true
    })

    // 过滤出未缓存或已过期的 ID
    const uncachedGuilds = uniqueGuildIds.filter(id => this.isExpired(allData.guilds[id]))
    const uncachedUsers = uniqueUserIds.filter(id => this.isExpired(allData.users[id]))
    const uncachedMembers = uniqueMemberPairs.filter(({ guildId, userId }) => this.isExpired(allData.members[`${guildId}:${userId}`]))

    this.logger.info(`开始预热缓存: ${uncachedGuilds.length}/${uniqueGuildIds.length} 个群组, ${uncachedUsers.length}/${uniqueUserIds.length} 个用户, ${uncachedMembers.length}/${uniqueMemberPairs.length} 个成员`)

    const startTime = Date.now()
    let successGuilds = 0
    let successUsers = 0
    let successMembers = 0

    // 并发获取群组信息
    const guildResults = await Promise.allSettled(uncachedGuilds.map(id => this.getGuildInfo(id)))
    guildResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successGuilds++
      } else {
        this.logger.debug(`群组 ${uncachedGuilds[index]} 获取失败`)
      }
    })

    // 并发获取用户信息
    const userResults = await Promise.allSettled(uncachedUsers.map(id => this.getUserInfo(id)))
    userResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successUsers++
      } else {
        this.logger.debug(`用户 ${uncachedUsers[index]} 获取失败`)
      }
    })

    // 并发获取成员信息
    const memberResults = await Promise.allSettled(uncachedMembers.map(({ guildId, userId }) =>
      this.getMemberInfo(guildId, userId)
    ))
    memberResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successMembers++
      } else {
        const { guildId, userId } = uncachedMembers[index]
        this.logger.debug(`成员 ${guildId}:${userId} 获取失败`)
      }
    })

    const data = this.store.getAll()
    data.metadata.lastFullRefresh = Date.now()
    this.store.setAll(data)

    const duration = Date.now() - startTime
    this.logger.info(`缓存预热完成，耗时 ${duration}ms`)
    this.logger.info(`成功缓存: ${successGuilds}/${uncachedGuilds.length} 群组, ${successUsers}/${uncachedUsers.length} 用户, ${successMembers}/${uncachedMembers.length} 成员`)

    const failedCount = (uncachedGuilds.length - successGuilds) + (uncachedUsers.length - successUsers) + (uncachedMembers.length - successMembers)
    if (failedCount > 0) {
      this.logger.warn(`有 ${failedCount} 个项目获取失败（可能Bot未加入相关群组或权限不足）`)
    }
  }

  /** 强制刷新所有缓存 */
  async refreshAll(): Promise<void> {
    const allData = this.store.getAll()
    const guildIds = Object.keys(allData.guilds)
    const userIds = Object.keys(allData.users)
    const memberPairs = Object.keys(allData.members).map(key => {
      const [guildId, userId] = key.split(':')
      return { guildId, userId }
    })

    this.logger.info('开始强制刷新所有缓存...')

    // 强制刷新
    await Promise.all([
      ...guildIds.map(id => this.getGuildInfo(id, true)),
      ...userIds.map(id => this.getUserInfo(id, true)),
      ...memberPairs.map(({ guildId, userId }) => this.getMemberInfo(guildId, userId, true))
    ])

    const data = this.store.getAll()
    data.metadata.lastFullRefresh = Date.now()
    this.store.setAll(data)
    this.logger.info('所有缓存已刷新')
  }

  /** 清空所有缓存 */
  async clearAll(): Promise<void> {
    this.store.setAll({
      guilds: {},
      users: {},
      members: {},
      metadata: {
        lastFullRefresh: 0,
        version: '1.0.0'
      }
    })
    this.negativeCache.clear()
    this.logger.info('缓存已清空')
  }

  /** 获取缓存统计信息 */
  getStats() {
    const data = this.store.getAll()
    return {
      guilds: Object.keys(data.guilds).length,
      users: Object.keys(data.users).length,
      members: Object.keys(data.members).length,
      lastFullRefresh: data.metadata.lastFullRefresh,
      lastFullRefreshTime: data.metadata.lastFullRefresh
        ? new Date(data.metadata.lastFullRefresh).toLocaleString('zh-CN')
        : '从未刷新'
    }
  }

  /** 直接获取缓存数据（同步，不触发网络请求） */
  getCachedData(): CacheData {
    return this.store.getAll()
  }
}
