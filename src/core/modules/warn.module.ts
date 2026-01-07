/**
 * 警告模块
 * 提供用户警告功能，累计警告达到阈值时自动禁言
 */
import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import type { DataManager } from '../data'
import type { Config, WarnRecord } from '../../types'
import { parseTimeString, formatDuration } from '../../utils'

export class WarnModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'warn',
    description: '用户警告功能，累计警告达到阈值时自动禁言',
    version: '1.0.0'
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
  }

  /**
   * 注册警告相关命令
   */
  private registerCommands(): void {
    // warn 命令 - 警告用户
    this.ctx.command('warn <user:user> [count:number]', '警告用户', { authority: 3 })
      .action(async ({ session }, user, count = 1) => {
        return this.handleWarn(session, user, count)
      })

    // warn.clear 命令 - 清除用户警告
    this.ctx.command('warn.clear <user:user>', '清除用户警告', { authority: 3 })
      .action(async ({ session }, user) => {
        return this.handleClearWarn(session, user)
      })

    // warn.list 命令 - 查看警告列表
    this.ctx.command('warn.list [user:user]', '查看警告列表', { authority: 2 })
      .action(async ({ session }, user) => {
        return this.handleListWarns(session, user)
      })
  }

  /**
   * 处理警告命令
   */
  private async handleWarn(session: Session, user: any, count: number): Promise<string> {
    if (!session.guildId) {
      return '喵呜...这个命令只能在群里用喵...'
    }
    if (!user) {
      return '请指定要警告的用户喵！'
    }

    const userId = String(user).split(':')[1]
    const warnCount = this.addWarn(session.guildId, userId, count)

    // 检查是否达到警告阈值
    if (warnCount >= this.config.warnLimit) {
      return await this.executeAutoBan(session, userId, warnCount, count)
    } else {
      await this.ctx.groupHelper.pushMessage(
        session.bot,
        `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${count} 次，累计 ${warnCount} 次，未触发自动禁言`,
        'warning'
      )
      this.log(session, 'warn', userId, `已警告 ${count} 次，累计 ${warnCount} 次`)
      return `已警告用户 ${userId}\n本群警告：${warnCount} 次`
    }
  }

  /**
   * 添加警告记录
   */
  private addWarn(guildId: string, userId: string, count: number): number {
    const key = `${guildId}:${userId}`
    const record = this.data.warns.get(key) || {
      groups: {}
    }

    if (!record.groups[guildId]) {
      record.groups[guildId] = {
        count: 0,
        timestamp: Date.now()
      }
    }

    record.groups[guildId].count += count
    record.groups[guildId].timestamp = Date.now()

    this.data.warns.set(key, record)
    this.data.warns.flush()

    return record.groups[guildId].count
  }

  /**
   * 执行自动禁言
   */
  private async executeAutoBan(
    session: Session,
    userId: string,
    warnCount: number,
    addedCount: number
  ): Promise<string> {
    const expression = this.config.banTimes.expression.replace(/{t}/g, String(warnCount))

    try {
      const milliseconds = parseTimeString(expression)
      await session.bot.muteGuildMember(session.guildId, userId, milliseconds)

      // 记录禁言
      this.recordMute(session.guildId, userId, milliseconds)

      await this.ctx.groupHelper.pushMessage(
        session.bot,
        `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${addedCount} 次，累计 ${warnCount} 次，触发自动禁言 ${formatDuration(milliseconds)}`,
        'warning'
      )
      this.log(session, 'warn', userId, `成功：已警告 ${addedCount} 次，累计 ${warnCount} 次，触发自动禁言 ${formatDuration(milliseconds)}`)

      return `已警告用户 ${userId}\n本群警告：${warnCount} 次\n已自动禁言 ${formatDuration(milliseconds)}`
    } catch (e) {
      await this.ctx.groupHelper.pushMessage(
        session.bot,
        `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${addedCount} 次，累计 ${warnCount} 次，但自动禁言失败：${e.message}`,
        'warning'
      )
      this.log(session, 'warn', userId, `失败：已警告 ${addedCount} 次，累计 ${warnCount} 次，但自动禁言失败`)

      return `警告已记录，但自动禁言失败：${e.message}`
    }
  }

  /**
   * 记录禁言信息
   */
  private recordMute(guildId: string, userId: string, duration: number): void {
    // mutes 结构: Record<guildId, Record<userId, MuteRecord>>
    const guildMutes = this.data.mutes.get(guildId) || {}
    guildMutes[userId] = {
      startTime: Date.now(),
      duration: duration,
      remainingTime: duration
    }
    this.data.mutes.set(guildId, guildMutes)
    this.data.mutes.flush()
  }

  /**
   * 处理清除警告命令
   */
  private async handleClearWarn(session: Session, user: any): Promise<string> {
    if (!session.guildId) {
      return '喵呜...这个命令只能在群里用喵...'
    }
    if (!user) {
      return '请指定要清除警告的用户喵！'
    }

    const userId = String(user).split(':')[1]
    const key = `${session.guildId}:${userId}`
    const record = this.data.warns.get(key)

    if (!record || !record.groups[session.guildId]) {
      return `用户 ${userId} 在本群没有警告记录`
    }

    const oldCount = record.groups[session.guildId].count
    delete record.groups[session.guildId]

    // 如果所有群的警告都被清除，删除整条记录
    if (Object.keys(record.groups).length === 0) {
      this.data.warns.delete(key)
    } else {
      this.data.warns.set(key, record)
    }
    this.data.warns.flush()

    this.log(session, 'warn.clear', userId, `已清除 ${oldCount} 次警告`)
    return `已清除用户 ${userId} 在本群的 ${oldCount} 次警告`
  }

  /**
   * 处理查看警告列表命令
   */
  private async handleListWarns(session: Session, user: any): Promise<string> {
    if (!session.guildId) {
      return '喵呜...这个命令只能在群里用喵...'
    }

    const allWarns = this.data.warns.getAll()

    if (user) {
      // 查看指定用户的警告
      const userId = String(user).split(':')[1]
      const key = `${session.guildId}:${userId}`
      const record = allWarns[key]

      if (!record || !record.groups[session.guildId]) {
        return `用户 ${userId} 在本群没有警告记录`
      }

      const count = record.groups[session.guildId].count
      const timestamp = record.groups[session.guildId].timestamp
      const date = new Date(timestamp).toLocaleString('zh-CN')

      return `用户 ${userId} 警告记录：\n本群警告：${count} 次\n最后警告时间：${date}`
    } else {
      // 查看本群所有用户的警告
      const guildWarns: Array<{ userId: string; count: number; timestamp: number }> = []

      for (const [key, record] of Object.entries(allWarns)) {
        if (key.startsWith(`${session.guildId}:`)) {
          const userId = key.split(':')[1]
          const guildRecord = record.groups[session.guildId]
          if (guildRecord) {
            guildWarns.push({
              userId,
              count: guildRecord.count,
              timestamp: guildRecord.timestamp
            })
          }
        }
      }

      if (guildWarns.length === 0) {
        return '本群暂无警告记录'
      }

      // 按警告次数排序
      guildWarns.sort((a, b) => b.count - a.count)

      const lines = guildWarns.slice(0, 10).map((w, i) => {
        return `${i + 1}. ${w.userId} - ${w.count} 次`
      })

      return `本群警告记录（前10名）：\n${lines.join('\n')}`
    }
  }

  /**
   * 获取用户警告数
   */
  getWarnCount(guildId: string, userId: string): number {
    const key = `${guildId}:${userId}`
    const record = this.data.warns.get(key)
    return record?.groups[guildId]?.count || 0
  }

  /**
   * 获取群组所有警告
   */
  getGuildWarns(guildId: string): Array<{ userId: string; count: number; timestamp: number }> {
    const result: Array<{ userId: string; count: number; timestamp: number }> = []
    const allWarns = this.data.warns.getAll()

    for (const [key, record] of Object.entries(allWarns)) {
      if (key.startsWith(`${guildId}:`)) {
        const userId = key.split(':')[1]
        const guildRecord = record.groups[guildId]
        if (guildRecord) {
          result.push({
            userId,
            count: guildRecord.count,
            timestamp: guildRecord.timestamp
          })
        }
      }
    }

    return result
  }
}