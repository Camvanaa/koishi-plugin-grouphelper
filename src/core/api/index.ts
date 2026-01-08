/**
 * WebSocket API 模块
 * 提供 WebUI 前端所需的实时数据接口
 */

import { Context, h } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { Subscription, Role } from '../../types'
import * as crypto from 'crypto'

/** API 响应格式 */
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/** 失败响应 */
function error(message: string): ApiResponse {
  return { success: false, error: message }
}

/**
 * 注册所有 WebSocket API
 */
export function registerWebSocketAPI(ctx: Context, service: GroupHelperService) {
  // 确保 console 服务存在
  if (!ctx.console) {
    ctx.logger('grouphelper').warn('console 服务未启用，WebSocket API 跳过注册')
    return
  }

  const data = service.data

  // ===== 群组配置 API =====
  
  /** 重新加载所有数据 */
  ctx.console.addListener('grouphelper/config/reload' as any, async () => {
    try {
      data.groupConfig.reload()
      ctx.logger('grouphelper').info('群组配置已重新加载，共 %d 条', Object.keys(data.groupConfig.getAll()).length)
      return success({
        success: true,
        count: Object.keys(data.groupConfig.getAll()).length
      })
    } catch (e) {
      ctx.logger('grouphelper').error('重新加载配置失败:', e)
      return error(e instanceof Error ? e.message : '重新加载失败')
    }
  })

  /** 获取所有群组配置 */
  ctx.console.addListener('grouphelper/config/list', async (params?: { fetchNames?: boolean }) => {
    const allConfigs = data.groupConfig.getAll()
    const results: Record<string, any> = {}

    if (params?.fetchNames) {
      // 开启解析：从缓存读取群组名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      Object.entries(allConfigs).forEach(([guildId, config]) => {
        const cached = cacheData.guilds[guildId]
        results[guildId] = {
          ...config,
          guildName: cached?.name || '',
          guildAvatar: cached?.avatar || `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`
        }
      })
    } else {
      // 关闭解析：不读取名称
      Object.entries(allConfigs).forEach(([guildId, config]) => {
        results[guildId] = {
          ...config,
          guildName: '',
          guildAvatar: ''
        }
      })
    }

    return success(results)
  })

  /** 获取单个群组配置 */
  ctx.console.addListener('grouphelper/config/get', async (params: { guildId: string }) => {
    return success(data.groupConfig.get(params.guildId))
  })

  /** 更新群组配置 */
  ctx.console.addListener('grouphelper/config/update', async (params: { guildId: string, config: any }) => {
    data.groupConfig.set(params.guildId, params.config)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 创建群组配置 */
  ctx.console.addListener('grouphelper/config/create', async (params: { guildId: string }) => {
    if (data.groupConfig.get(params.guildId)) {
      return error('配置已存在')
    }
    // 创建默认配置
    const defaultConfig = {
      welcomeEnabled: false,
      antiRecall: { enabled: false },
      antiRepeat: { enabled: false, threshold: 3 },
      forbidden: { autoDelete: false, autoBan: false, autoKick: false, muteDuration: 600000 },
      dice: { enabled: true, lengthLimit: 1000 },
      banme: {
        enabled: true, baseMin: 1, baseMax: 30, growthRate: 30,
        jackpot: { enabled: true, baseProb: 0.006, softPity: 73, hardPity: 89, upDuration: '24h', loseDuration: '12h' }
      },
      openai: { enabled: true }
    }
    data.groupConfig.set(params.guildId, defaultConfig)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 删除群组配置 */
  ctx.console.addListener('grouphelper/config/delete', async (params: { guildId: string }) => {
    data.groupConfig.delete(params.guildId)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  // ===== 权限管理 API =====

  /** 获取所有角色 */
  ctx.console.addListener('grouphelper/auth/role/list' as any, async () => {
    return success(service.auth.getRoles())
  })

  /** 创建/更新角色 */
  ctx.console.addListener('grouphelper/auth/role/update' as any, async (params: { role: Role }) => {
    await service.auth.saveRole(params.role)
    await service.data.authRoles.flush()
    return success({ success: true })
  })

  /** 删除角色 */
  ctx.console.addListener('grouphelper/auth/role/delete' as any, async (params: { roleId: string }) => {
    await service.auth.deleteRole(params.roleId)
    await service.data.authRoles.flush()
    await service.data.authUsers.flush() // 用户关联可能被清理
    return success({ success: true })
  })

  /** 获取某用户的角色列表 */
  ctx.console.addListener('grouphelper/auth/user/get' as any, async (params: { userId: string }) => {
    return success(service.auth.getUserRoleIds(params.userId))
  })

  /** 获取角色的成员列表 */
  ctx.console.addListener('grouphelper/auth/role/members' as any, async (params: { roleId: string, fetchNames?: boolean }) => {
    const userIds = service.auth.getRoleMembers(params.roleId)
    
    if (params.fetchNames) {
      const cacheData = service.cache.getCachedData()
      const members = userIds.map(userId => {
        const cached = cacheData.users[userId]
        return {
          id: userId,
          name: cached?.name || '',
          avatar: cached?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
        }
      })
      return success(members)
    }
    
    return success(userIds.map(id => ({ id, name: '', avatar: '' })))
  })

  /** 分配角色 */
  ctx.console.addListener('grouphelper/auth/user/assign' as any, async (params: { userId: string, roleId: string }) => {
    await service.auth.assignRole(params.userId, params.roleId)
    await service.data.authUsers.flush()
    return success({ success: true })
  })

  /** 移除角色 */
  ctx.console.addListener('grouphelper/auth/user/revoke' as any, async (params: { userId: string, roleId: string }) => {
    await service.auth.revokeRole(params.userId, params.roleId)
    await service.data.authUsers.flush()
    return success({ success: true })
  })

  /** 获取系统所有可用的权限节点列表 (供前端选择) */
  ctx.console.addListener('grouphelper/auth/permission/list' as any, async () => {
    // 静态定义可用的权限节点
    const permissions = [
      // 管理权限
      { id: '*', name: '超级管理员', description: '拥有所有权限' },
      { id: 'auth.role.manage', name: '角色管理', description: '创建、修改和删除角色' },
      { id: 'auth.user.manage', name: '用户权限管理', description: '分配和移除用户角色' },
      
      // 配置权限
      { id: 'config.view', name: '查看配置', description: '查看群组配置' },
      { id: 'config.edit', name: '修改配置', description: '修改群组配置' },
      
      // 警告管理
      { id: 'warn.view', name: '查看警告', description: '查看用户警告记录' },
      { id: 'warn.add', name: '添加警告', description: '添加警告记录' },
      { id: 'warn.manage', name: '管理警告', description: '修改和删除警告记录' },
      
      // 黑名单管理
      { id: 'blacklist.view', name: '查看黑名单', description: '查看黑名单列表' },
      { id: 'blacklist.manage', name: '管理黑名单', description: '添加和移除黑名单' },
      
      // 订阅管理
      { id: 'subscription.manage', name: '管理订阅', description: '管理消息订阅' },
      
      // 日志
      { id: 'log.view', name: '查看日志', description: '查看命令日志' },
      
      // 聊天功能
      { id: 'chat.send', name: '发送消息', description: '使用控制台发送消息' }
    ]
    return success(permissions)
  })

  // ===== 警告记录 API =====

  /** 重新加载警告数据 */
  ctx.console.addListener('grouphelper/warns/reload' as any, async () => {
    try {
      data.warns.reload()
      ctx.logger('grouphelper').info('警告数据已重新加载')
      return success({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : '重新加载失败')
    }
  })

  /** 获取所有警告记录 (Enriched) - 支持新格式 */
  ctx.console.addListener('grouphelper/warns/list', async (params?: { fetchNames?: boolean }) => {
    const allWarns = data.warns.getAll()
    const result: any[] = []

    if (params?.fetchNames) {
      // 开启解析：从缓存读取名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      
      for (const [guildId, guildWarns] of Object.entries(allWarns)) {
        if (!guildWarns || typeof guildWarns !== 'object') continue

        const guildCache = cacheData.guilds[guildId]
        const guildName = guildCache?.name || ''
        const guildAvatar = guildCache?.avatar || `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`

        // @ts-ignore
        for (const [userId, warnInfo] of Object.entries(guildWarns)) {
          if (!warnInfo || typeof warnInfo !== 'object' || !('count' in warnInfo)) continue
          const info = warnInfo as { count: number, timestamp: number }
          
          const memberKey = `${guildId}:${userId}`
          const memberCache = cacheData.members[memberKey]
          const userName = memberCache?.nick || memberCache?.name || ''
          const userAvatar = memberCache?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`

          result.push({
            key: memberKey,
            guildId,
            userId,
            guildName,
            guildAvatar,
            userName,
            userAvatar,
            count: info.count,
            timestamp: info.timestamp
          })
        }
      }
    } else {
      // 关闭解析：不读取名称
      for (const [guildId, guildWarns] of Object.entries(allWarns)) {
        if (!guildWarns || typeof guildWarns !== 'object') continue

        // @ts-ignore
        for (const [userId, warnInfo] of Object.entries(guildWarns)) {
          if (!warnInfo || typeof warnInfo !== 'object' || !('count' in warnInfo)) continue
          const info = warnInfo as { count: number, timestamp: number }

          result.push({
            key: `${guildId}:${userId}`,
            guildId,
            userId,
            guildName: '',
            guildAvatar: '',
            userName: '',
            userAvatar: '',
            count: info.count,
            timestamp: info.timestamp
          })
        }
      }
    }

    return success(result)
  })

  /** 更新警告次数 */
  ctx.console.addListener('grouphelper/warns/update', async (params: { key: string, count: number }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    
    const guildId = parts[0]
    const userId = parts[1]
    
    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        if (params.count <= 0) {
          // Count <= 0 means clear
          delete guildWarns[userId]
          if (Object.keys(guildWarns).length === 0) {
            data.warns.delete(guildId)
          } else {
            // @ts-ignore
            data.warns.set(guildId, guildWarns)
          }
        } else {
          guildWarns[userId].count = params.count
          guildWarns[userId].timestamp = Date.now() // 更新时间戳
          // @ts-ignore
          data.warns.set(guildId, guildWarns)
        }
        await data.warns.flush()
        return success({ success: true })
    }
    return error('Record not found')
  })

  /** 添加警告 */
  ctx.console.addListener('grouphelper/warns/add', async (params: { guildId: string, userId: string }) => {
    const guildWarns = data.warns.get(params.guildId) || {}
    
    if (!guildWarns[params.userId]) {
      guildWarns[params.userId] = { count: 0, timestamp: 0 }
    }
    
    guildWarns[params.userId].count++
    guildWarns[params.userId].timestamp = Date.now()
    
    // @ts-ignore
    data.warns.set(params.guildId, guildWarns)
    await data.warns.flush()
    return success({ success: true })
  })

  /** 获取用户警告记录 */
  ctx.console.addListener('grouphelper/warns/get', async (params: { key: string }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    const guildId = parts[0]
    const userId = parts[1]
    
    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        return success(guildWarns[userId])
    }
    return success(null)
  })

  /** 清除用户警告 */
  ctx.console.addListener('grouphelper/warns/clear', async (params: { key: string }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    const guildId = parts[0]
    const userId = parts[1]

    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        delete guildWarns[userId]
        if (Object.keys(guildWarns).length === 0) {
            data.warns.delete(guildId)
        } else {
            // @ts-ignore
            data.warns.set(guildId, guildWarns)
        }
        await data.warns.flush()
    }
    return success({ success: true })
  })

  // ===== 黑名单 API =====

  /** 获取黑名单 */
  ctx.console.addListener('grouphelper/blacklist/list', async () => {
    return success(data.blacklist.getAll())
  })

  /** 添加黑名单 */
  ctx.console.addListener('grouphelper/blacklist/add', async (params: { userId: string, record: any }) => {
    data.blacklist.set(params.userId, params.record)
    await data.blacklist.flush()
    return success({ success: true })
  })

  /** 移除黑名单 */
  ctx.console.addListener('grouphelper/blacklist/remove', async (params: { userId: string }) => {
    data.blacklist.delete(params.userId)
    await data.blacklist.flush()
    return success({ success: true })
  })

  // ===== 订阅 API =====

  /** 获取订阅列表 */
  ctx.console.addListener('grouphelper/subscriptions/list', async (params?: { fetchNames?: boolean }) => {
    const subsData = data.subscriptions.get('list') || []
    
    if (params?.fetchNames) {
      // 开启解析：从缓存读取名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      const enrichedList = subsData.map((sub) => {
        let name = ''
        let avatar = ''
        if (sub.type === 'group') {
          const cached = cacheData.guilds[sub.id]
          name = cached?.name || ''
          avatar = cached?.avatar || `https://p.qlogo.cn/gh/${sub.id}/${sub.id}/640/`
        } else if (sub.type === 'private') {
          const cached = cacheData.users[sub.id]
          name = cached?.name || ''
          avatar = cached?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${sub.id}&s=640`
        }
        return { ...sub, name, avatar }
      })
      return success(enrichedList)
    } else {
      // 关闭解析：不读取名称
      return success(subsData.map(sub => ({ ...sub, name: '', avatar: '' })))
    }
  })

  /** 添加订阅 */
  ctx.console.addListener('grouphelper/subscriptions/add', async (params: { subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    list.push(params.subscription)
    data.subscriptions.set('list', list)
    await data.subscriptions.flush()
    return success({ success: true })
  })

  /** 移除订阅 */
  ctx.console.addListener('grouphelper/subscriptions/remove', async (params: { index: number }) => {
    const list = data.subscriptions.get('list') || []
    if (params.index >= 0 && params.index < list.length) {
      list.splice(params.index, 1)
      data.subscriptions.set('list', list)
      await data.subscriptions.flush()
    }
    return success({ success: true })
  })

  /** 更新订阅 */
  ctx.console.addListener('grouphelper/subscriptions/update', async (params: { index: number, subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    if (params.index >= 0 && params.index < list.length) {
      list[params.index] = params.subscription
      data.subscriptions.set('list', list)
      await data.subscriptions.flush()
    }
    return success({ success: true })
  })

  // ===== 统计 API =====

  /** 获取仪表盘统计 */
  ctx.console.addListener('grouphelper/stats/dashboard', async () => {
    const allWarns = data.warns.getAll()
    const allBlacklist = data.blacklist.getAll()
    const allConfigs = data.groupConfig.getAll()
    const subsList = data.subscriptions.get('list') || []

    // 统计所有警告记录的真实数量
    let totalWarnCount = 0
    for (const guildWarns of Object.values(allWarns)) {
      if (guildWarns && typeof guildWarns === 'object') {
        totalWarnCount += Object.keys(guildWarns).length
      }
    }

    return success({
      totalGroups: Object.keys(allConfigs).length,
      totalWarns: totalWarnCount,
      totalBlacklisted: Object.keys(allBlacklist).length,
      totalSubscriptions: subsList.length,
      timestamp: Date.now()
    })
  })

  // ===== 日志检索 API =====

  ctx.console.addListener('grouphelper/logs/search', async (params: {
    startTime?: string | number
    endTime?: string | number
    command?: string
    userId?: string
    username?: string
    details?: string
    guildId?: string
    page?: number
    pageSize?: number
  }) => {
    const logModule = service.getAllModules().find(m => m.meta.name === 'log') as any
    if (!logModule) return error('Log module not found')

    // 获取所有日志进行检索
    let logs = await logModule.getAllLogs()
    
    // 过滤
    logs = logs.filter((log: any) => {
      const time = new Date(log.timestamp).getTime()
      if (params.startTime && time < new Date(params.startTime).getTime()) return false
      if (params.endTime && time > new Date(params.endTime).getTime()) return false
      if (params.command && !log.command.toLowerCase().includes(params.command.toLowerCase())) return false
      if (params.userId && log.userId !== params.userId) return false
      if (params.username && (!log.username || !log.username.toLowerCase().includes(params.username.toLowerCase()))) return false
      if (params.details) {
        const keyword = params.details.toLowerCase()
        const matchResult = log.result?.toLowerCase().includes(keyword)
        const matchError = log.error?.toLowerCase().includes(keyword)
        const matchArgs = log.args?.some((arg: string) => arg.toLowerCase().includes(keyword))
        const matchOptions = JSON.stringify(log.options || {}).toLowerCase().includes(keyword)
        
        if (!matchResult && !matchError && !matchArgs && !matchOptions) return false
      }
      if (params.guildId && log.guildId !== params.guildId) return false
      return true
    })

    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const total = logs.length
    const list = logs.slice((page - 1) * pageSize, page * pageSize)

    return success({ list, total, page, pageSize })
  })

  // ===== 设置 API =====

  /** 获取插件设置 */
  ctx.console.addListener('grouphelper/settings/get', async () => {
    // 获取当前设置
    return success(service.settings.settings)
  })

  /** 更新插件设置 */
  ctx.console.addListener('grouphelper/settings/update', async (params: { settings: any }) => {
    try {
      const { settings } = params
      
      // 检查 settings 是否有效
      if (!settings || typeof settings !== 'object') {
        return error('无效的设置数据')
      }
      
      // 更新设置
      await service.settings.update(settings)
      
      ctx.logger('grouphelper').info('设置已更新')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('更新设置失败:', e)
      return error(e instanceof Error ? e.message : '更新设置失败')
    }
  })

  /** 重置插件设置 */
  ctx.console.addListener('grouphelper/settings/reset', async () => {
    try {
      await service.settings.reset()
      ctx.logger('grouphelper').info('设置已重置为默认值')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('重置设置失败:', e)
      return error(e instanceof Error ? e.message : '重置设置失败')
    }
  })

  // ===== 缓存管理 API =====

  /** 获取缓存统计信息 */
  ctx.console.addListener('grouphelper/cache/stats' as any, async () => {
    try {
      const stats = service.cache.getStats()
      return success(stats)
    } catch (e) {
      ctx.logger('grouphelper').error('获取缓存统计失败:', e)
      return error(e instanceof Error ? e.message : '获取缓存统计失败')
    }
  })

  /** 强制刷新缓存 */
  ctx.console.addListener('grouphelper/cache/refresh' as any, async () => {
    try {
      ctx.logger('grouphelper').info('开始刷新缓存...')
      await service.cache.refreshAll()
      ctx.logger('grouphelper').info('缓存刷新完成')
      return success({ success: true, stats: service.cache.getStats() })
    } catch (e) {
      ctx.logger('grouphelper').error('刷新缓存失败:', e)
      return error(e instanceof Error ? e.message : '刷新缓存失败')
    }
  })

  /** 清空缓存 */
  ctx.console.addListener('grouphelper/cache/clear' as any, async () => {
    try {
      await service.cache.clearAll()
      ctx.logger('grouphelper').info('缓存已清空')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('清空缓存失败:', e)
      return error(e instanceof Error ? e.message : '清空缓存失败')
    }
  })

  /** 按需获取单个名称（会触发缓存） */
  ctx.console.addListener('grouphelper/cache/fetch-name' as any, async (params: {
    type: 'guild' | 'user' | 'member'
    guildId?: string
    userId?: string
  }) => {
    try {
      const { type, guildId, userId } = params
      
      if (type === 'guild' && guildId) {
        const info = await service.cache.getGuildInfo(guildId)
        return success({ name: info?.name || '', avatar: info?.avatar })
      } else if (type === 'user' && userId) {
        const info = await service.cache.getUserInfo(userId)
        return success({ name: info?.name || '', avatar: info?.avatar })
      } else if (type === 'member' && guildId && userId) {
        const info = await service.cache.getMemberInfo(guildId, userId)
        return success({
          name: info?.name || '',
          nick: info?.nick || '',
          avatar: info?.avatar
        })
      }
      
      return error('无效的参数')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取名称失败')
    }
  })

  // ===== 聊天功能 API =====

  /** 获取群信息 */
  ctx.console.addListener('grouphelper/chat/guild-info' as any, async (params: { guildId: string }) => {
    try {
      const { guildId } = params
      if (!guildId) return error('缺少 guildId 参数')

      for (const bot of ctx.bots) {
        try {
          const guild = await bot.getGuild(guildId)
          if (guild) {
            let avatar = guild.avatar
            // OneBot/QQ 群头像回退
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`
            }
            return success({ name: guild.name, avatar })
          }
        } catch {}
      }
      return error('无法获取群信息')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取群信息失败')
    }
  })

  /** 获取用户信息 */
  ctx.console.addListener('grouphelper/chat/user-info' as any, async (params: { userId: string }) => {
    try {
      const { userId } = params
      if (!userId) return error('缺少 userId 参数')

      for (const bot of ctx.bots) {
        try {
          const user = await bot.getUser(userId)
          if (user) {
            let avatar = user.avatar
            // OneBot/QQ 个人头像回退
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }
            return success({ name: user.name || user.nick || userId, avatar })
          }
        } catch {}
      }
      return error('无法获取用户信息')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取用户信息失败')
    }
  })

  /** 发送消息 */
  ctx.console.addListener('grouphelper/chat/send' as any, async (params: { channelId: string, content: string, platform?: string, guildId?: string }) => {
    try {
      const { channelId, content, platform, guildId } = params
      if (!channelId || !content) return error('缺少必要参数')

      // 寻找合适的 bot
      const bot = ctx.bots.find(b => !platform || b.platform === platform)
      if (!bot) return error('未找到可用的 Bot')

      await bot.sendMessage(channelId, content, guildId)
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('发送消息失败:', e)
      return error(e instanceof Error ? e.message : '发送失败')
    }
  })

  /** 图片代理 - 使用 get_image API 获取图片 */
  ctx.console.addListener('grouphelper/image/fetch' as any, async (params: { url: string, file?: string }) => {
    try {
      const { url, file } = params
      if (!url) return error('缺少 URL 参数')

      // 尝试从 URL 中提取文件名（如果没有提供 file 参数）
      let fileToUse = file
      
      if (!fileToUse) {
        try {
          const urlObj = new URL(url)
          const urlPath = urlObj.pathname
          const pathParts = urlPath.split('/')
          const lastPart = pathParts[pathParts.length - 1]
          if (lastPart && (lastPart.includes('.') || /^[A-F0-9]{32}$/i.test(lastPart))) {
            fileToUse = lastPart
          }
        } catch {}
      }

      // 使用 OneBot get_image API 获取图片
      for (const bot of ctx.bots) {
        if (bot.platform === 'onebot' && (bot as any).internal?.getImage) {
          try {
            const fileParam = fileToUse || url
            const result = await (bot as any).internal.getImage(fileParam)
            
            // 优先使用返回的 base64
            if (result?.base64) {
              let mimeType = 'image/png'
              const fileName = result.file_name || result.file || ''
              if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg'
              else if (fileName.endsWith('.gif')) mimeType = 'image/gif'
              else if (fileName.endsWith('.webp')) mimeType = 'image/webp'
              
              const dataUrl = `data:${mimeType};base64,${result.base64}`
              const hash = crypto.createHash('md5').update(url).digest('hex')
              return success({ dataUrl, hash, mimeType, source: 'local-base64' })
            }
            
            // 其次使用返回的新 url
            if (result?.url && result.url !== url) {
              const newResponse = await fetch(result.url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': ''
                }
              })
              if (newResponse.ok) {
                const buffer = await newResponse.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                const contentType = newResponse.headers.get('content-type') || 'image/jpeg'
                const dataUrl = `data:${contentType};base64,${base64}`
                const hash = crypto.createHash('md5').update(url).digest('hex')
                return success({ dataUrl, hash, mimeType: contentType, source: 'local-url' })
              }
            }
            
            // 最后尝试读取本地文件
            if (result?.file) {
              try {
                const fs = await import('fs/promises')
                const localBuffer = await fs.readFile(result.file)
                const base64 = localBuffer.toString('base64')
                
                let mimeType = 'image/png'
                if (result.file.endsWith('.jpg') || result.file.endsWith('.jpeg')) mimeType = 'image/jpeg'
                else if (result.file.endsWith('.gif')) mimeType = 'image/gif'
                else if (result.file.endsWith('.webp')) mimeType = 'image/webp'
                
                const dataUrl = `data:${mimeType};base64,${base64}`
                const hash = crypto.createHash('md5').update(url).digest('hex')
                return success({ dataUrl, hash, mimeType, source: 'local-file' })
              } catch {}
            }
          } catch {}
        }
      }
      
      return error('无法获取图片')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取图片失败')
    }
  })

  // 缓存 bot 登录信息，避免重复请求
  const botLoginInfoCache = new Map<string, { userId: string; nickname: string }>()

  // 获取 bot 登录信息（使用 get_login_info API）
  const getBotLoginInfo = async (bot: any): Promise<{ userId: string; nickname: string } | null> => {
    const cacheKey = `${bot.platform}:${bot.selfId}`
    if (botLoginInfoCache.has(cacheKey)) {
      return botLoginInfoCache.get(cacheKey)!
    }
    
    // 尝试使用 OneBot get_login_info API
    if (bot.platform === 'onebot' && bot.internal?.getLoginInfo) {
      try {
        const info = await bot.internal.getLoginInfo()
        if (info?.user_id && info?.nickname) {
          const result = { userId: String(info.user_id), nickname: info.nickname }
          botLoginInfoCache.set(cacheKey, result)
          return result
        }
      } catch {}
    }
    
    // 回退到 bot.user
    if (bot.user?.name || bot.user?.id) {
      const result = { userId: bot.selfId, nickname: bot.user.name || bot.selfId }
      botLoginInfoCache.set(cacheKey, result)
      return result
    }
    
    return null
  }

  // 监听并广播消息
  const broadcastMessage = async (session: any, isSelf = false) => {
    // 获取消息内容
    let content = session.content
    let elements = session.elements
    
    // 如果是自己发送的消息，通过 get_msg API 获取内容
    if (isSelf && session.messageId) {
      const bot = session.bot || ctx.bots.find(b => b.selfId === session.selfId)
      
      if (bot?.platform === 'onebot' && (bot as any).internal?.getMsg) {
        try {
          const msgInfo = await (bot as any).internal.getMsg(session.messageId)
          if (msgInfo) {
            // 优先使用 raw_message (CQ 码格式)
            if (msgInfo.raw_message) {
              content = msgInfo.raw_message
              elements = h.parse(content)
            } else if (Array.isArray(msgInfo.message)) {
              // 数组格式消息段
              elements = msgInfo.message.map((seg: any) => ({
                type: seg.type,
                attrs: seg.data || {}
              }))
              content = elements.map((el: any) => {
                if (el.type === 'text') return el.attrs?.text || el.attrs?.content || ''
                return `[${el.type}]`
              }).join('')
            }
          }
        } catch {}
      }
    }
    
    
    // 尝试获取更多信息
    let guildAvatar = session.event?.guild?.avatar
    
    // 如果没有群头像但有群ID，尝试获取
    if (!guildAvatar && session.guildId) {
      const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
      if (bot) {
        try {
          const guild = await bot.getGuild(session.guildId)
          if (guild?.avatar) guildAvatar = guild.avatar
        } catch {}
      }
    }

    // OneBot/QQ 协议特有头像处理
    if (session.platform === 'onebot' || session.platform === 'red' || session.platform === 'qq') {
      if (!guildAvatar && session.guildId) {
        guildAvatar = `https://p.qlogo.cn/gh/${session.guildId}/${session.guildId}/640/`
      }
    }

    // 使用已获取的 elements 或解析 content
    const finalElements = elements || session.elements || (content ? h.parse(content) : [])

    // 如果是自己发送的消息，补充作者信息
    let username = session.author?.name || session.author?.nick || session.userId
    let avatar = session.author?.avatar

    if (isSelf) {
      // 尝试从 bot 登录信息获取准确的昵称
      const bot = session.bot || ctx.bots.find(b => b.selfId === session.selfId)
      if (bot) {
        const loginInfo = await getBotLoginInfo(bot)
        if (loginInfo) {
          username = loginInfo.nickname
        } else {
          username = bot.user?.name || username || '我'
        }
        avatar = bot.user?.avatar || avatar
      }
    }

    // OneBot/QQ 个人头像回退
    if (!avatar && (session.platform === 'onebot' || session.platform === 'red' || session.platform === 'qq')) {
      const targetId = isSelf ? session.selfId : session.userId
      if (targetId) {
        avatar = `https://q1.qlogo.cn/g?b=qq&nk=${targetId}&s=640`
      }
    }

    // 尝试获取群名称 (如果缺失)
    let guildName = (session as any).guildName || (session.event?.guild?.name)
    if (!guildName && session.guildId) {
       const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
       if (bot) {
         try {
           const guild = await bot.getGuild(session.guildId)
           if (guild?.name) guildName = guild.name
         } catch {}
       }
    }

    // 尝试解析 elements 中的 at 标签，补充名称
    const enrichedElements = await Promise.all(finalElements.map(async (el: any) => {
      if (el.type === 'at' && el.attrs?.id) {
         if (!el.attrs.name) {
             // 尝试获取被 at 用户的昵称
             const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
             if (bot && session.guildId) {
               try {
                 const member = await bot.getGuildMember(session.guildId, el.attrs.id)
                 if (member?.nick || member?.user?.name) {
                   el.attrs.name = member.nick || member.user.name
                 }
               } catch {}
             }
         }
      }
      return el
    }))

    ctx.console.broadcast('grouphelper/chat/message', {
      id: session.messageId || session.id || Date.now().toString(),
      timestamp: session.timestamp || Date.now(),
      userId: session.userId || session.selfId,
      username,
      avatar,
      content: content || session.content,
      elements: enrichedElements, // 传递处理后的元素
      platform: session.platform,
      guildId: session.guildId,
      guildName,
      guildAvatar, // 传递群头像
      channelId: session.channelId,
      channelName: (session as any).channelName || (session.event?.channel?.name),
      selfId: session.selfId,
    })
  }

  // 监听收到消息
  ctx.on('message', (session) => {
    broadcastMessage(session)
  })

  // 监听发送消息
  // @ts-ignore - send 事件类型定义可能不完整
  ctx.on('send', (session) => {
    broadcastMessage(session, true)
  })
}