import * as fs from 'fs'
import * as path from 'path'
import { Context } from 'koishi'
import { DataService } from './data.service'

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

export class CommandLogService {
  private commandLogPath: string
  private commandStats: Map<string, { count: number, lastUsed: number }> = new Map()

  constructor(private ctx: Context, private dataService: DataService) {
    this.commandLogPath = path.resolve(dataService.dataPath, 'command_logs.json')
    this.init()
    this.registerEventListeners()
  }

  private init() {
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

  private saveCommandLogs(logs: CommandLogRecord[]) {
    try {
      fs.writeFileSync(this.commandLogPath, JSON.stringify(logs, null, 2), 'utf-8')
    } catch (e) {
      console.error('保存命令日志失败:', e)
    }
  }

  private loadStats() {
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

  private registerEventListeners() {
    this.ctx.on('command/before-execute', (argv) => {
      ;(argv as any)._startTime = Date.now()
    })

    this.ctx.on('command-error', (argv, error) => {
      this.logCommand(argv, false, error?.message || 'Unknown error')
    })

    this.ctx.middleware(async (session, next) => {
      const result = await next()
      
      if (session.argv && session.argv.command) {
        this.logCommand(session.argv, true, undefined, result)
      }
      
      return result
    }, true)
  }

  private async logCommand(argv: any, success: boolean, error?: string, result?: any) {
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

      const commandName = logRecord.command
      const stats = this.commandStats.get(commandName) || { count: 0, lastUsed: 0 }
      stats.count++
      stats.lastUsed = Date.now()
      this.commandStats.set(commandName, stats)

      this.pushCommandLog(logRecord)

    } catch (e) {
      console.error('记录命令日志失败:', e)
    }
  }

  private async pushCommandLog(logRecord: CommandLogRecord) {
    try {
      const message = this.formatLogMessage(logRecord)
      await this.dataService.pushMessage(
        this.ctx.bots[logRecord.platform], 
        message, 
        'log'
      )
    } catch (e) {
      console.error('推送命令日志失败:', e)
    }
  }

  private formatLogMessage(record: CommandLogRecord): string {
    const status = record.success ? '✅' : '❌'
    const location = record.isPrivate ? '私聊' : `群(${record.guildId})`
    const time = record.executionTime > 0 ? ` (${record.executionTime}ms)` : ''
    const authority = record.userAuthority ? ` [权限:${record.userAuthority}]` : ''

    let message = `${status} [命令执行] ${record.command}\n`
    message += `用户: ${record.username}(${record.userId})${authority}\n`
    message += `位置: ${location}\n`
    message += `平台: ${record.platform}\n`
    message += `时间: ${record.timestamp}${time}`

    if (record.args.length > 0) {
      message += `\n参数: ${record.args.join(', ')}`
    }

    if (Object.keys(record.options).length > 0) {
      message += `\n选项: ${JSON.stringify(record.options)}`
    }

    if (!record.success && record.error) {
      message += `\n错误: ${record.error}`
    }

    return message
  }

  private saveCommandStats() {
  }

  getCommandStats(): Map<string, { count: number, lastUsed: number }> {
    return new Map(this.commandStats)
  }

  clearCommandStats() {
    this.commandStats.clear()
    this.saveCommandStats()
  }

  async getRecentLogs(limit: number = 100): Promise<CommandLogRecord[]> {
    try {
      const logs = this.readCommandLogs()
      return logs
        .slice(-limit)
        .reverse()
    } catch (e) {
      console.error('读取命令日志失败:', e)
      return []
    }
  }

  clearCommandLogs() {
    this.saveCommandLogs([])
    this.commandStats.clear()
  }

  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      const logs = this.readCommandLogs()

      const filteredLogs = logs.filter(log => {
        return new Date(log.timestamp).getTime() > cutoffTime
      })

      const removedCount = logs.length - filteredLogs.length
      this.saveCommandLogs(filteredLogs)

      this.loadStats()

      console.log(`清理了 ${removedCount} 条旧命令日志`)
      return removedCount
    } catch (e) {
      console.error('清理命令日志失败:', e)
      return 0
    }
  }

  dispose() {
  }
}
