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

export class CacheService {
  private store: JsonDataStore<CacheData>
  private logger: any
  private cacheExpiry = 7 * 24 * 60 * 60 * 1000 // 7天过期

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
    const allData = this.store.getAll()
    const cached = allData.guilds[guildId]
    
    // 如果缓存有效且不强制刷新，返回缓存
    if (!forceRefresh && cached && Date.now() - cached.lastUpdate < this.cacheExpiry) {
      return cached
    }

    // 从 bot 获取最新信息
    for (const bot of this.ctx.bots) {
      try {
        const guild = await bot.getGuild(guildId)
        if (guild) {
          let avatar = guild.avatar
          
          // OneBot/QQ 群头像回退
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
          this.store.setAll(data)
          return info
        }
      } catch (e) {
        // 继续尝试下一个 bot
      }
    }

    // 如果获取失败但有缓存，返回过期的缓存
    if (cached) {
      this.logger.warn(`无法刷新群组 ${guildId} 信息，使用过期缓存`)
      return cached
    }

    return null
  }

  /** 获取用户信息（优先从缓存） */
  async getUserInfo(userId: string, forceRefresh = false): Promise<UserCacheInfo | null> {
    const allData = this.store.getAll()
    const cached = allData.users[userId]
    
    if (!forceRefresh && cached && Date.now() - cached.lastUpdate < this.cacheExpiry) {
      return cached
    }

    for (const bot of this.ctx.bots) {
      try {
        const user = await bot.getUser(userId)
        if (user) {
          let avatar = user.avatar
          
          // OneBot/QQ 个人头像回退
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
          this.store.setAll(data)
          return info
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (cached) {
      this.logger.warn(`无法刷新用户 ${userId} 信息，使用过期缓存`)
      return cached
    }

    return null
  }

  /** 获取群成员信息（优先从缓存） */
  async getMemberInfo(guildId: string, userId: string, forceRefresh = false): Promise<MemberCacheInfo | null> {
    const key = `${guildId}:${userId}`
    const allData = this.store.getAll()
    const cached = allData.members[key]
    
    if (!forceRefresh && cached && Date.now() - cached.lastUpdate < this.cacheExpiry) {
      return cached
    }

    for (const bot of this.ctx.bots) {
      try {
        const member = await bot.getGuildMember(guildId, userId)
        if (member) {
          let avatar = member.avatar || member.user?.avatar
          
          // OneBot/QQ 个人头像回退
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
          this.store.setAll(data)
          return info
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (cached) {
      this.logger.warn(`无法刷新群成员 ${guildId}:${userId} 信息，使用过期缓存`)
      return cached
    }

    return null
  }

  /** 批量预热缓存（只缓存未缓存的） */
  async warmCache(guildIds: string[], userIds: string[], memberPairs: Array<{ guildId: string, userId: string }>): Promise<void> {
    const allData = this.store.getAll()
    
    // 过滤出未缓存的 ID
    const uncachedGuilds = guildIds.filter(id => !allData.guilds[id])
    const uncachedUsers = userIds.filter(id => !allData.users[id])
    const uncachedMembers = memberPairs.filter(({ guildId, userId }) => !allData.members[`${guildId}:${userId}`])

    this.logger.info(`开始预热缓存: ${uncachedGuilds.length}/${guildIds.length} 个群组, ${uncachedUsers.length}/${userIds.length} 个用户, ${uncachedMembers.length}/${memberPairs.length} 个成员`)

    const startTime = Date.now()
    let successGuilds = 0
    let successUsers = 0
    let successMembers = 0

    // 并发获取群组信息（只获取未缓存的）
    const guildResults = await Promise.allSettled(uncachedGuilds.map(id => this.getGuildInfo(id)))
    guildResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successGuilds++
      } else {
        this.logger.debug(`群组 ${uncachedGuilds[index]} 获取失败`)
      }
    })

    // 并发获取用户信息（只获取未缓存的）
    const userResults = await Promise.allSettled(uncachedUsers.map(id => this.getUserInfo(id)))
    userResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successUsers++
      } else {
        this.logger.debug(`用户 ${uncachedUsers[index]} 获取失败`)
      }
    })

    // 并发获取成员信息（只获取未缓存的）
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

    this.logger.info('缓存刷新完成')
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
  getCachedData() {
    return this.store.getAll()
  }
}