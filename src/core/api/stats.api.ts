/**
 * 模块状态、仪表盘与图表统计 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'

const pkg = require('../../../package.json')

export function registerStatsAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 统计 API =====

  /** 获取模块状态 */
  addListener('grouphelper/stats/modules' as any, async () => {
    const modules = service.getAllModules()
    const result = modules.map(m => ({
      name: m.meta.name,
      description: m.meta.description,
      state: m.state,
      error: m.error ? m.error.message : undefined
    }))
    return success(result)
  })

  /** 获取仪表盘统计 */
  addListener('grouphelper/stats/dashboard', async () => {
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
      version: pkg.version,
      timestamp: Date.now()
    })
  })

  /** 获取图表统计数据 */
  addListener('grouphelper/stats/charts' as any, async (params?: { days?: number }) => {
    const days = params?.days || 7
    const now = Date.now()
    const startTime = now - days * 24 * 60 * 60 * 1000

    // 获取日志模块
    const logModule = service.getAllModules().find(m => m.meta.name === 'log') as any
    if (!logModule) return error('Log module not found')

    const logs = await logModule.getAllLogs()

    // 1. 按日期统计命令使用趋势
    const dailyStats: Record<string, number> = {}
    // 2. 命令类型分布
    const commandStats: Record<string, number> = {}
    // 3. 成功/失败统计
    let successCount = 0
    let failCount = 0
    // 4. 群组使用统计
    const guildStats: Record<string, number> = {}
    // 5. 用户使用统计
    const userStats: Record<string, { count: number, name: string }> = {}

    // 初始化日期
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().slice(0, 10)
      dailyStats[dateKey] = 0
    }

    // 统计日志
    logs.forEach((log: any) => {
      try {
        const logTime = new Date(log.timestamp).getTime()
        if (logTime < startTime) return

        // 日期统计
        const dateKey = new Date(log.timestamp).toISOString().slice(0, 10)
        if (dailyStats[dateKey] !== undefined) {
          dailyStats[dateKey]++
        }

        // 命令分布
        const cmd = log.command || 'unknown'
        commandStats[cmd] = (commandStats[cmd] || 0) + 1

        // 成功/失败
        if (log.success) {
          successCount++
        } else {
          failCount++
        }

        // 群组统计
        if (log.guildId) {
          guildStats[log.guildId] = (guildStats[log.guildId] || 0) + 1
        }

        // 用户统计
        if (log.userId) {
          if (!userStats[log.userId]) {
            userStats[log.userId] = { count: 0, name: log.username || log.userId }
          }
          userStats[log.userId].count++
        }
      } catch (e) {
        // 跳过错误日志
      }
    })

    // 转换为数组格式，按日期排序
    const trend = Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // 命令分布，按数量排序取前10
    const distribution = Object.entries(commandStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }))

    // 群组排行，取前10（附带群名）
    const cacheData = service.cache.getCachedData()
    const guildRank = Object.entries(guildStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([guildId, count]) => ({
        guildId,
        count,
        name: cacheData.guilds[guildId]?.name || ''
      }))

    // 用户排行，取前10
    const userRank = Object.entries(userStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([userId, data]) => ({ userId, count: data.count, name: data.name }))

    return success({
      trend,
      distribution,
      successRate: { success: successCount, fail: failCount },
      guildRank,
      userRank
    })
  })
}
