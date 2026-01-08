/**
 * 日志模块 - 操作日志和命令日志管理
 */
import { Context } from 'koishi'
import * as fs from 'fs'
import * as path from 'path'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'

// 命令日志记录接口
export interface CommandLogRecord {
  id: string
  timestamp: string
  userId: string
  username?: string
  userAuthority?: number
  guildId?: string
  guildName?: string
  channelId?: string
  platform: string
  command: string
  args: string[]
  options: Record<string, any>
  success: boolean
  error?: string
  executionTime: number
  result?: string
  messageId?: string
  isPrivate: boolean
}

export class LogModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'log',
    description: '日志管理模块',
    version: '1.0.0'
  }

  private logPath: string
  private commandLogPath: string
  private commandStats: Map<string, { count: number, lastUsed: number }> = new Map()

  constructor(ctx: Context, dataManager: DataManager, config: Config) {
    super(ctx, dataManager, config)
    this.logPath = path.resolve(this.data.dataPath, 'grouphelper.log')
    this.commandLogPath = path.resolve(this.data.dataPath, 'command_logs.json')
  }

  protected async onInit(): Promise<void> {
    this.initCommandLogs()
    this.registerCommands()
    this.registerEventListeners()
    console.log(`[${this.meta.name}] LogModule initialized`)
  }

  private initCommandLogs(): void {
    if (!fs.existsSync(this.commandLogPath)) {
      this.saveCommandLogs([])
    }
    this.loadStats()
  }

  private readCommandLogs(): CommandLogRecord[] {
    try {
      const content = fs.readFileSync(this.commandLogPath, 'utf-8')
      return JSON.parse(content) || []
    } catch (e) {
      console.error('读取命令日志失败:', e)
      return []
    }
  }

  private saveCommandLogs(logs: CommandLogRecord[]): void {
    try {
      fs.writeFileSync(this.commandLogPath, JSON.stringify(logs, null, 2), 'utf-8')
    } catch (e) {
      console.error('保存命令日志失败:', e)
    }
  }

  private loadStats(): void {
    const logs = this.readCommandLogs()
    this.commandStats.clear()

    logs.forEach(log => {
      const stats = this.commandStats.get(log.command) || { count: 0, lastUsed: 0 }
      stats.count++
      const logTime = new Date(log.timestamp).getTime()
      if (logTime > stats.lastUsed) {
        stats.lastUsed = logTime
      }
      this.commandStats.set(log.command, stats)
    })
  }

  private registerEventListeners(): void {
    // 命令执行前记录开始时间
    this.ctx.on('command/before-execute', (argv) => {
      ;(argv as any)._startTime = Date.now()
    })

    // 命令执行错误记录
    this.ctx.on('command-error', (argv, error) => {
      this.logCommandExecution(argv, false, error?.message || 'Unknown error')
    })

    // 中间件记录成功执行
    this.ctx.middleware(async (session, next) => {
      const result = await next()
      
      if (session.argv && session.argv.command) {
        this.logCommandExecution(session.argv, true, undefined, result)
      }
      
      return result
    }, true)
  }

  private async logCommandExecution(argv: any, success: boolean, error?: string, result?: any): Promise<void> {
    try {
      const session = argv.session
      if (!session) return

      const executionTime = argv._startTime ? Date.now() - argv._startTime : 0

      let userAuthority = 1
      if (this.ctx.database) {
        try {
          const user = await session.observeUser(['authority'])
          userAuthority = user?.authority || 1
        } catch (e) {
          // ignore
        }
      }

      const logRecord: CommandLogRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: session.userId || 'unknown',
        username: session.username || session.author?.nickname || session.author?.username || 'unknown',
        userAuthority,
        guildId: session.guildId,
        guildName: session.guild?.name,
        channelId: session.channelId,
        platform: session.platform || 'unknown',
        command: argv.command?.name || argv.name || 'unknown',
        args: argv.args || [],
        options: argv.options || {},
        success,
        error,
        executionTime,
        result: typeof result === 'string' ? result : undefined,
        messageId: session.messageId,
        isPrivate: !session.guildId
      }

      const logs = this.readCommandLogs()
      logs.push(logRecord)
      this.saveCommandLogs(logs)

      // 更新统计
      const commandName = logRecord.command
      const stats = this.commandStats.get(commandName) || { count: 0, lastUsed: 0 }
      stats.count++
      stats.lastUsed = Date.now()
      this.commandStats.set(commandName, stats)

    } catch (e) {
      console.error('记录命令日志失败:', e)
    }
  }

  private registerCommands(): void {
    this.registerOperationLogCommands()
    this.registerCommandLogCommands()
  }

  // ===== 操作日志命令 =====
  private registerOperationLogCommands(): void {
    // 显示操作日志
    this.ctx.command('listlog [lines:number]', '显示最近的操作记录', { authority: 3 })
      .action(async ({ session }, lines = 100) => {
        if (!this.ctx.groupHelper.auth.check(session, 'log.view')) return '你没有权限查看日志喵...'
        if (!fs.existsSync(this.logPath)) {
          return '还没有任何日志记录喵~'
        }

        try {
          const content = fs.readFileSync(this.logPath, 'utf8')
          const allLines = content.split('\n').filter(line => line.trim())
          const recentLines = allLines.slice(-lines)

          if (recentLines.length === 0) {
            return '还没有任何日志记录喵~'
          }

          this.log(session, 'listlog', `${lines}`, 'success')
          return `=== 最近 ${Math.min(lines, recentLines.length)} 条操作记录 ===\n${recentLines.join('\n')}`
        } catch (e) {
          return `读取日志失败喵...${e.message}`
        }
      })

    // 清理操作日志
    this.ctx.command('clearlog', '清理日志文件', { authority: 4 })
      .option('d', '-d <days:number> 保留最近几天的日志')
      .option('a', '-a 清理所有日志')
      .action(async ({ session, options }) => {
        if (!fs.existsSync(this.logPath)) {
          return '还没有任何日志记录喵~'
        }

        try {
          if (options.a) {
            fs.writeFileSync(this.logPath, '')
            this.log(session, 'clearlog', 'all', 'Cleared all logs')
            return '已清理所有日志记录喵~'
          }

          const days = options.d || 7
          const now = Date.now()
          const content = fs.readFileSync(this.logPath, 'utf8')
          const allLines = content.split('\n').filter(line => line.trim())

          const keptLogs = allLines.filter(line => {
            const match = line.match(/^\[(.*?)\]/)
            if (!match) return false
            const logTime = new Date(match[1]).getTime()
            return (now - logTime) <= days * 24 * 60 * 60 * 1000
          })

          fs.writeFileSync(this.logPath, keptLogs.join('\n') + '\n')

          const deletedCount = allLines.length - keptLogs.length
          this.log(session, 'clearlog', `${days}days`, `Cleared ${deletedCount} logs`)

          return `已清理 ${deletedCount} 条日志记录，保留最近 ${days} 天的记录喵~`
        } catch (e) {
          return `清理日志失败喵...${e.message}`
        }
      })
  }

  // ===== 命令日志命令 =====
  private registerCommandLogCommands(): void {
    // 查看命令日志
    this.ctx.command('cmdlogs.check', '查看命令执行日志')
      .alias('命令日志')
      .option('limit', '-l <number> 显示条数', { fallback: 10 })
      .option('user', '-u <userId> 筛选特定用户')
      .option('command', '-c <command> 筛选特定命令')
      .option('failed', '-f 只显示失败的命令')
      .option('private', '-p 只显示私聊命令')
      .option('guild', '-g <guildId> 筛选特定群组')
      .option('platform', '--platform <platform> 筛选特定平台')
      .option('authority', '-a <level> 筛选特定权限级别')
      .option('since', '-s <date> 显示指定时间之后的日志')
      .option('until', '--until <date> 显示指定时间之前的日志')
      .action(async ({ options, session }) => {
        if (!this.ctx.groupHelper.auth.check(session, 'log.view')) return '你没有权限查看日志喵...'
        try {
          const logs = this.readCommandLogs().slice(-Math.min(options.limit * 10, 1000)).reverse()

          if (logs.length === 0) {
            return '暂无命令执行记录'
          }

          let filteredLogs = this.filterLogs(logs, options)
          filteredLogs = filteredLogs.slice(0, options.limit)

          if (filteredLogs.length === 0) {
            return '没有符合条件的命令记录'
          }

          return this.formatLogList(filteredLogs, logs.length)
        } catch (error) {
          return `获取命令日志失败: ${error.message}`
        }
      })

    // 命令统计
    this.ctx.command('cmdlogs.stats', '查看命令使用统计')
      .alias('命令统计')
      .option('limit', '-l <number> 显示前N个命令', { fallback: 10 })
      .option('command', '-c <command> 筛选特定命令')
      .option('user', '-u <userId> 筛选特定用户')
      .option('guild', '-g <guildId> 筛选特定群组')
      .option('sortBy', '--sort <type> 排序方式: count, time, guild, user', { fallback: 'count' })
      .action(async ({ options, session }) => {
        if (!this.ctx.groupHelper.auth.check(session, 'log.view')) return '你没有权限查看日志喵...'
        try {
          const allLogs = this.readCommandLogs()

          if (allLogs.length === 0) {
            return '暂无命令使用记录'
          }

          let filteredLogs = this.filterLogs(allLogs, options)

          if (filteredLogs.length === 0) {
            return '没有符合条件的命令记录'
          }

          return this.formatStats(filteredLogs, options)
        } catch (error) {
          return `获取命令统计失败: ${error.message}`
        }
      })

    // 清理命令日志
    this.ctx.command('cmdlogs.clear', '清除命令日志')
      .alias('清理日志')
      .option('days', '-d <number> 清除N天前的日志', { fallback: 0 })
      .option('all', '--all 清除所有日志')
      .action(async ({ session, options }) => {
        if (!this.ctx.groupHelper.auth.check(session, 'log.view')) return '你没有权限清理日志喵...'
        try {
          if (options.all) {
            this.saveCommandLogs([])
            this.commandStats.clear()
            this.log(session, 'cmdlogs.clear', 'all', 'success')
            return '已清除所有命令日志'
          } else if (options.days > 0) {
            const removedCount = this.cleanOldLogs(options.days)
            this.log(session, 'cmdlogs.clear', `${options.days}days`, `removed ${removedCount}`)
            return `已清理 ${removedCount} 条超过 ${options.days} 天的命令日志`
          } else {
            return '请指定 --all 清除所有日志，或使用 -d <天数> 清除指定天数前的日志'
          }
        } catch (error) {
          return `清理日志失败: ${error.message}`
        }
      })

    // 导出命令日志
    this.ctx.command('cmdlogs.export', '导出命令日志')
      .alias('导出日志')
      .option('days', '-d <number> 导出最近N天的日志', { fallback: 7 })
      .option('format', '-f <format> 导出格式 (json|csv)', { fallback: 'json' })
      .action(async ({ options }) => {
        try {
          const logs = this.readCommandLogs()
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

            return `CSV格式日志 (${filteredLogs.length} 条记录)\n\n${csvHeader}${csvRows}`
          } else {
            return `JSON格式日志 (${filteredLogs.length} 条记录)\n\n${JSON.stringify(filteredLogs, null, 2)}`
          }
        } catch (error) {
          return `导出日志失败: ${error.message}`
        }
      })
  }

  // ===== 辅助方法 =====
  private filterLogs(logs: CommandLogRecord[], options: any): CommandLogRecord[] {
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

    return filteredLogs
  }

  private formatLogList(logs: CommandLogRecord[], total: number): string {
    let message = `命令执行记录 (${logs.length}/${total})\n\n`

    logs.forEach((log, index) => {
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
  }

  private formatStats(logs: CommandLogRecord[], options: any): string {
    const sortBy = options.sortBy || 'count'

    // 按命令分组
    const commandGroups = new Map<string, CommandLogRecord[]>()
    logs.forEach(log => {
      if (!commandGroups.has(log.command)) {
        commandGroups.set(log.command, [])
      }
      commandGroups.get(log.command)!.push(log)
    })

    // 按使用次数排序
    const sortedCommands = Array.from(commandGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, options.limit)

    let message = `📊 命令使用统计\n`
    message += `总记录: ${logs.length} 条，命令种类: ${commandGroups.size} 个\n\n`

    sortedCommands.forEach(([command, cmdLogs], cmdIndex) => {
      const successCount = cmdLogs.filter(l => l.success).length
      const successRate = ((successCount / cmdLogs.length) * 100).toFixed(1)
      const lastUsed = new Date(Math.max(...cmdLogs.map(l => new Date(l.timestamp).getTime())))
        .toLocaleString('zh-CN')

      message += `${cmdIndex + 1}. ${command}\n`
      message += `   总计: ${cmdLogs.length} 次, 成功率: ${successRate}%\n`
      message += `   最后使用: ${lastUsed}\n\n`
    })

    return message.trim()
  }

  private cleanOldLogs(daysToKeep: number): number {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      const logs = this.readCommandLogs()

      const filteredLogs = logs.filter(log => {
        return new Date(log.timestamp).getTime() > cutoffTime
      })

      const removedCount = logs.length - filteredLogs.length
      this.saveCommandLogs(filteredLogs)
      this.loadStats()

      return removedCount
    } catch (e) {
      console.error('清理命令日志失败:', e)
      return 0
    }
  }

  // 公共 API
  getCommandStats(): Map<string, { count: number, lastUsed: number }> {
    return new Map(this.commandStats)
  }

  async getRecentLogs(limit: number = 100): Promise<CommandLogRecord[]> {
    return this.readCommandLogs().slice(-limit).reverse()
  }

  async getAllLogs(): Promise<CommandLogRecord[]> {
    return this.readCommandLogs().reverse()
  }
}