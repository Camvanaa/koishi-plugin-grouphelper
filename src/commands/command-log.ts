import { Context } from 'koishi'
import { CommandLogService } from '../services'

export function registerCommandLogCommands(ctx: Context, commandLogService: CommandLogService) {

  ctx.command('cmdlogs.check', '查看命令执行日志')
    .alias('命令日志')
    .option('limit', '-l <number> 显示条数', { fallback: 10 })
    .option('user', '-u <userId> 筛选特定用户')
    .option('command', '-c <command> 筛选特定命令')
    .option('failed', '-f 只显示失败的命令')
    .option('private', '-p 只显示私聊命令')
    .option('guild', '-g <guildId> 筛选特定群组')
    .option('platform', '--platform <platform> 筛选特定平台')
    .option('authority', '-a <level> 筛选特定权限级别')
    .option('since', '-s <date> 显示指定时间之后的日志 (格式: YYYY-MM-DD 或 YYYY-MM-DD HH:mm)')
    .option('until', '--until <date> 显示指定时间之前的日志 (格式: YYYY-MM-DD 或 YYYY-MM-DD HH:mm)')
    .action(async ({ options }) => {
      try {
        const logs = await commandLogService.getRecentLogs(Math.min(options.limit * 10, 1000))

        if (logs.length === 0) {
          return '暂无命令执行记录'
        }

        let filteredLogs = logs

        if (options.user) {
          filteredLogs = filteredLogs.filter(log => log.userId === options.user)
        }

        if (options.command) {
          filteredLogs = filteredLogs.filter(log =>
            log.command.toLowerCase().includes(options.command.toLowerCase())
          )
        }

        if (options.failed) {
          filteredLogs = filteredLogs.filter(log => !log.success)
        }

        if (options.private) {
          filteredLogs = filteredLogs.filter(log => log.isPrivate)
        }

        if (options.guild) {
          filteredLogs = filteredLogs.filter(log => log.guildId === options.guild)
        }

        if (options.platform) {
          filteredLogs = filteredLogs.filter(log => log.platform === options.platform)
        }

        if (options.authority !== undefined) {
          filteredLogs = filteredLogs.filter(log => log.userAuthority === options.authority)
        }

        if (options.since) {
          const sinceTime = new Date(options.since).getTime()
          if (!isNaN(sinceTime)) {
            filteredLogs = filteredLogs.filter(log =>
              new Date(log.timestamp).getTime() >= sinceTime
            )
          }
        }

        if (options.until) {
          const untilTime = new Date(options.until).getTime()
          if (!isNaN(untilTime)) {
            filteredLogs = filteredLogs.filter(log =>
              new Date(log.timestamp).getTime() <= untilTime
            )
          }
        }

        filteredLogs = filteredLogs.slice(0, options.limit)

        if (filteredLogs.length === 0) {
          return '没有符合条件的命令记录'
        }

        let message = `命令执行记录 (${filteredLogs.length}/${logs.length})\n\n`

        filteredLogs.forEach((log, index) => {
          const status = log.success ? '✅' : '❌'
          const time = new Date(log.timestamp).toLocaleString('zh-CN')
          const location = log.isPrivate ? '私聊' : `群(${log.guildId})`
          const execTime = log.executionTime > 0 ? ` (${log.executionTime}ms)` : ''
          const authority = log.userAuthority ? ` [权限:${log.userAuthority}]` : ''

          message += `${index + 1}. ${status} ${log.command}${execTime}\n`
          message += `   用户: ${log.username}(${log.userId})${authority}\n`
          message += `   位置: ${location}\n`
          message += `   平台: ${log.platform}\n`
          message += `   时间: ${time}\n`

          if (log.args.length > 0) {
            message += `   参数: ${log.args.join(', ')}\n`
          }

          if (Object.keys(log.options).length > 0) {
            message += `   选项: ${JSON.stringify(log.options)}\n`
          }

          if (!log.success && log.error) {
            message += `   错误: ${log.error}\n`
          }

          message += '\n'
        })

        return message.trim()
      } catch (error) {
        return `获取命令日志失败: ${error.message}`
      }
    })

  ctx.command('cmdlogs.stats', '查看命令使用统计')
    .alias('命令统计')
    .option('limit', '-l <number> 显示前N个命令', { fallback: 10 })
    .option('recent', '-r 按最近使用时间排序')
    .option('command', '-c <command> 筛选特定命令')
    .option('user', '-u <userId> 筛选特定用户')
    .option('guild', '-g <guildId> 筛选特定群组')
    .option('platform', '--platform <platform> 筛选特定平台')
    .option('authority', '-a <level> 筛选特定权限级别')
    .option('since', '-s <date> 统计指定时间之后的数据')
    .option('until', '--until <date> 统计指定时间之前的数据')
    .action(async ({ options }) => {
      try {
        const allLogs = await commandLogService.getRecentLogs(10000)

        if (allLogs.length === 0) {
          return '暂无命令使用记录'
        }

        let filteredLogs = allLogs

        if (options.command) {
          filteredLogs = filteredLogs.filter(log =>
            log.command.toLowerCase().includes(options.command.toLowerCase())
          )
        }

        if (options.user) {
          filteredLogs = filteredLogs.filter(log => log.userId === options.user)
        }

        if (options.guild) {
          filteredLogs = filteredLogs.filter(log => log.guildId === options.guild)
        }

        if (options.platform) {
          filteredLogs = filteredLogs.filter(log => log.platform === options.platform)
        }

        if (options.authority !== undefined) {
          filteredLogs = filteredLogs.filter(log => log.userAuthority === options.authority)
        }

        if (options.since) {
          const sinceTime = new Date(options.since).getTime()
          if (!isNaN(sinceTime)) {
            filteredLogs = filteredLogs.filter(log =>
              new Date(log.timestamp).getTime() >= sinceTime
            )
          }
        }

        if (options.until) {
          const untilTime = new Date(options.until).getTime()
          if (!isNaN(untilTime)) {
            filteredLogs = filteredLogs.filter(log =>
              new Date(log.timestamp).getTime() <= untilTime
            )
          }
        }

        if (filteredLogs.length === 0) {
          return '没有符合条件的命令记录'
        }

        const commandStats = new Map<string, { count: number, lastUsed: number, successRate: number, totalSuccess: number }>()

        filteredLogs.forEach(log => {
          const stats = commandStats.get(log.command) || {
            count: 0,
            lastUsed: 0,
            successRate: 0,
            totalSuccess: 0
          }
          stats.count++
          if (log.success) stats.totalSuccess++
          const logTime = new Date(log.timestamp).getTime()
          if (logTime > stats.lastUsed) {
            stats.lastUsed = logTime
          }
          stats.successRate = (stats.totalSuccess / stats.count) * 100
          commandStats.set(log.command, stats)
        })

        const sortedStats = Array.from(commandStats.entries())

        if (options.recent) {
          sortedStats.sort((a, b) => b[1].lastUsed - a[1].lastUsed)
        } else {
          sortedStats.sort((a, b) => b[1].count - a[1].count)
        }

        const topStats = sortedStats.slice(0, options.limit)

        let message = `命令使用统计 (${options.recent ? '按最近使用' : '按使用次数'})\n`
        message += `总记录: ${filteredLogs.length} 条，命令种类: ${commandStats.size} 个\n\n`

        topStats.forEach(([command, stat], index) => {
          const lastUsedTime = new Date(stat.lastUsed).toLocaleString('zh-CN')
          const successRate = stat.successRate.toFixed(1)
          message += `${index + 1}. ${command}\n`
          message += `   使用次数: ${stat.count}\n`
          message += `   成功率: ${successRate}% (${stat.totalSuccess}/${stat.count})\n`
          message += `   最后使用: ${lastUsedTime}\n\n`
        })

        return message.trim()
      } catch (error) {
        return `获取命令统计失败: ${error.message}`
      }
    })

  ctx.command('cmdlogs.clear', '清除命令日志')
    .alias('清理日志')
    .option('days', '-d <number> 清除N天前的日志', { fallback: 0 })
    .option('all', '--all 清除所有日志')
    .action(async ({ session, options }) => {
      try {
        if (session.userId !== ctx.config.adminUserId) {
          return '只有管理员可以执行此操作'
        }

        if (options.all) {
          commandLogService.clearCommandLogs()
          return '✅ 已清除所有命令日志'
        } else if (options.days > 0) {
          const removedCount = await commandLogService.cleanOldLogs(options.days)
          return `✅ 已清理 ${removedCount} 条超过 ${options.days} 天的命令日志`
        } else {
          return '请指定 --all 清除所有日志，或使用 -d <天数> 清除指定天数前的日志'
        }
      } catch (error) {
        return `清理日志失败: ${error.message}`
      }
    })

  ctx.command('cmdlogs.export', '导出命令日志')
    .alias('导出日志')
    .option('days', '-d <number> 导出最近N天的日志', { fallback: 7 })
    .option('format', '-f <format> 导出格式 (json|csv)', { fallback: 'json' })
    .action(async ({ session, options }) => {
      try {

        const logs = await commandLogService.getRecentLogs(10000)
        const cutoffTime = Date.now() - (options.days * 24 * 60 * 60 * 1000)

        const filteredLogs = logs.filter(log =>
          new Date(log.timestamp).getTime() > cutoffTime
        )

        if (filteredLogs.length === 0) {
          return `最近 ${options.days} 天没有命令执行记录`
        }

        if (options.format === 'csv') {
          const csvHeader = 'timestamp,userId,username,userAuthority,guildId,platform,command,success,executionTime,error\n'
          const csvRows = filteredLogs.map(log =>
            `"${log.timestamp}","${log.userId}","${log.username}","${log.userAuthority || ''}","${log.guildId || ''}","${log.platform}","${log.command}","${log.success}","${log.executionTime}","${log.error || ''}"`
          ).join('\n')

          return `📄 CSV格式日志 (${filteredLogs.length} 条记录)\n\n${csvHeader}${csvRows}`
        } else {
          return `📄 JSON格式日志 (${filteredLogs.length} 条记录)\n\n${JSON.stringify(filteredLogs, null, 2)}`
        }
      } catch (error) {
        return `导出日志失败: ${error.message}`
      }
    })
}
