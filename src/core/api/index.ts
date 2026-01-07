/**
 * WebSocket API 模块
 * 提供 WebUI 前端所需的实时数据接口
 */

import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { Subscription } from '../../types'

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
  
  /** 获取所有群组配置 */
  ctx.console.addListener('grouphelper/config/list', async (params?: { fetchNames?: boolean }) => {
    const allConfigs = data.groupConfig.getAll()
    const results: Record<string, any> = {}

    // 并行获取群组名称
    await Promise.all(Object.entries(allConfigs).map(async ([guildId, config]) => {
      let guildName = ''
      if (params?.fetchNames) {
        for (const bot of ctx.bots) {
          try {
            const guild = await bot.getGuild(guildId)
            if (guild?.name) {
              guildName = guild.name
              break
            }
          } catch {
            continue
          }
        }
      }
      results[guildId] = { ...config, guildName }
    }))

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

  // ===== 警告记录 API =====

  /** 获取所有警告记录 (Enriched) */
  ctx.console.addListener('grouphelper/warns/list', async (params?: { fetchNames?: boolean }) => {
    const rawWarns = data.warns.getAll()
    const result = []

    for (const [key, record] of Object.entries(rawWarns)) {
      // key format: guildId:userId
      const parts = key.split(':')
      const guildId = parts[0]
      const userId = parts[1] || 'Unknown'
      const groupData = record.groups?.[guildId]

      if (guildId && groupData) {
        let guildName = ''
        let userName = ''

        // Try to fetch names if requested
        if (params?.fetchNames) {
          for (const bot of ctx.bots) {
            try {
              if (!guildName) {
                const guild = await bot.getGuild(guildId)
                if (guild?.name) guildName = guild.name
              }
              if (!userName) {
                const member = await bot.getGuildMember(guildId, userId)
                if (member?.user?.name || member?.nick) userName = member.nick || member.user.name
              }
              if (guildName && userName) break
            } catch {
              continue
            }
          }
        }

        result.push({
          key,
          guildId,
          userId,
          guildName: guildName || 'Unknown',
          userName: userName || 'Unknown',
          count: groupData.count,
          timestamp: groupData.timestamp
        })
      }
    }

    return success(result)
  })

  /** 更新警告次数 */
  ctx.console.addListener('grouphelper/warns/update', async (params: { key: string, count: number }) => {
    const record = data.warns.get(params.key)
    if (record) {
      const parts = params.key.split(':')
      const guildId = parts[0]
      if (record.groups[guildId]) {
        if (params.count <= 0) {
          // Count <= 0 means clear
          delete record.groups[guildId]
          if (Object.keys(record.groups).length === 0) {
            data.warns.delete(params.key)
          } else {
            data.warns.set(params.key, record)
          }
        } else {
          record.groups[guildId].count = params.count
          data.warns.set(params.key, record)
        }
        await data.warns.flush()
        return success({ success: true })
      }
    }
    return error('Record not found')
  })

  /** 获取用户警告记录 */
  ctx.console.addListener('grouphelper/warns/get', async (params: { key: string }) => {
    return success(data.warns.get(params.key))
  })

  /** 清除用户警告 */
  ctx.console.addListener('grouphelper/warns/clear', async (params: { key: string }) => {
    data.warns.delete(params.key)
    await data.warns.flush()
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
  ctx.console.addListener('grouphelper/subscriptions/list', async () => {
    const subsData = data.subscriptions.get('list')
    return success(subsData || [])
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

  // ===== 统计 API =====

  /** 获取仪表盘统计 */
  ctx.console.addListener('grouphelper/stats/dashboard', async () => {
    const allWarns = data.warns.getAll()
    const allBlacklist = data.blacklist.getAll()
    const allConfigs = data.groupConfig.getAll()
    const subsList = data.subscriptions.get('list') || []

    return success({
      totalGroups: Object.keys(allConfigs).length,
      totalWarns: Object.keys(allWarns).length,
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
      if (params.command && !log.command.includes(params.command)) return false
      if (params.userId && log.userId !== params.userId) return false
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
}