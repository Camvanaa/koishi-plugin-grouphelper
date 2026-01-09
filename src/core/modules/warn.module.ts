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
    this.migrateData()
    this.registerCommands()
  }

  /**
   * 迁移旧数据格式到新格式
   * 旧格式1: key="guildId:userId", value={ groups: { guildId: { count, timestamp } } }
   * 旧格式2: key="guildId", value={ userId: count }
   * 新格式: key="guildId", value={ userId: { count, timestamp } }
   */
  private migrateData() {
    const allWarns = this.data.warns.getAll()
    const migratedData: Record<string, Record<string, { count: number, timestamp: number }>> = {}
    let hasMigration = false

    for (const [key, record] of Object.entries(allWarns)) {
      // 检查是否是旧格式1 (key 包含冒号)
      if (key.includes(':')) {
        const [guildId, userId] = key.split(':')
        // @ts-ignore
        if (record && record.groups && record.groups[guildId]) {
          if (!migratedData[guildId]) migratedData[guildId] = {}
          // @ts-ignore
          const oldRecord = record.groups[guildId]
          migratedData[guildId][userId] = {
            count: oldRecord.count,
            timestamp: oldRecord.timestamp || Date.now()
          }
          hasMigration = true
        }
      }
      // 检查是否是旧格式2 (value 是简单的 userId: count 映射)
      // 或者已经是新格式 (value 是 userId: { count, timestamp })
      else {
        // 假设 key 是 guildId
        const guildId = key
        // @ts-ignore
        for (const [userId, val] of Object.entries(record)) {
          if (typeof val === 'number') {
            // 旧格式2: val 是 count
            if (!migratedData[guildId]) migratedData[guildId] = {}
            if (!migratedData[guildId][userId]) {
                migratedData[guildId][userId] = {
                    count: val,
                    timestamp: Date.now()
                }
            }
            hasMigration = true
          } else if (typeof val === 'object' && val && 'count' in val) {
             // 已经是新格式，或者是部分新格式，保留
             if (!migratedData[guildId]) migratedData[guildId] = {}
             // @ts-ignore
             migratedData[guildId][userId] = val
          }
        }
      }
    }

    if (hasMigration) {
      // 清空旧数据并写入新数据
      // 注意：这里我们直接覆盖，因为 migratedData 包含了所有我们需要保留的数据
      // 但为了安全，我们应该先清除旧的，再设置新的
      
      // 1. 找出所有旧格式的 key 并删除
      for (const key of Object.keys(allWarns)) {
          if (key.includes(':')) {
              this.data.warns.delete(key)
          } else {
             // 检查 value 是否包含数字类型的属性 (旧格式2)
             const val = allWarns[key]
             let isOld = false
             for(const v of Object.values(val as any)) {
                 if(typeof v === 'number') {
                     isOld = true;
                     break;
                 }
             }
             if(isOld) {
                 this.data.warns.delete(key)
             }
          }
      }

      // 2. 写入新数据
      for (const [guildId, records] of Object.entries(migratedData)) {
        // @ts-ignore
        this.data.warns.set(guildId, records)
      }
      
      this.data.warns.flush()
      this.ctx.logger('grouphelper').info('警告数据已迁移到新格式')
    }
  }

  /**
   * 注册警告相关命令
   */
  private registerCommands(): void {
    // warn 命令 - 警告用户
    this.registerCommand({
      name: 'warn',
      desc: '警告用户',
      args: '<user:user> [count:number]',
      permNode: 'add',
      permDesc: '添加警告记录',
      usage: '警告用户，达到阈值后自动禁言',
      examples: ['warn @用户', 'warn @用户 3']
    }).action(async ({ session }, user, count = 1) => {
      return this.handleWarn(session, user, count)
    })

    // warn.clear 命令 - 清除用户警告
    this.registerCommand({
      name: 'warn.clear',
      desc: '清除用户警告',
      args: '<user:user>',
      permNode: 'clear',
      permDesc: '清除用户的警告记录',
      examples: ['warn.clear @用户']
    }).action(async ({ session }, user) => {
      return this.handleClearWarn(session, user)
    })

    // warn.list 命令 - 查看警告列表
    this.registerCommand({
      name: 'warn.list',
      desc: '查看警告列表',
      args: '[user:user]',
      permNode: 'list',
      permDesc: '查看警告记录列表',
      usage: '不指定用户则显示本群所有警告',
      examples: ['warn.list', 'warn.list @用户']
    }).action(async ({ session }, user) => {
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

    // 权限检查已在 registerCommand 的 before 中间件中完成
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
    const guildWarns = this.data.warns.get(guildId) || {}
    
    if (!guildWarns[userId]) {
      guildWarns[userId] = {
        count: 0,
        timestamp: Date.now()
      }
    }

    guildWarns[userId].count += count
    guildWarns[userId].timestamp = Date.now()

    // @ts-ignore
    this.data.warns.set(guildId, guildWarns)
    this.data.warns.flush()

    return guildWarns[userId].count
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

    // 权限检查已在 registerCommand 的 before 中间件中完成
    if (!user) {
      return '请指定要清除警告的用户喵！'
    }

    const userId = String(user).split(':')[1]
    const guildWarns = this.data.warns.get(session.guildId)

    if (!guildWarns || !guildWarns[userId]) {
      return `用户 ${userId} 在本群没有警告记录`
    }

    const oldCount = guildWarns[userId].count
    delete guildWarns[userId]

    if (Object.keys(guildWarns).length === 0) {
      this.data.warns.delete(session.guildId)
    } else {
      // @ts-ignore
      this.data.warns.set(session.guildId, guildWarns)
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

    // 权限检查已在 registerCommand 的 before 中间件中完成

    const guildWarns = this.data.warns.get(session.guildId)

    if (user) {
      // 查看指定用户的警告
      const userId = String(user).split(':')[1]
      
      if (!guildWarns || !guildWarns[userId]) {
        return `用户 ${userId} 在本群没有警告记录`
      }

      const { count, timestamp } = guildWarns[userId]
      const date = new Date(timestamp).toLocaleString('zh-CN')

      return `用户 ${userId} 警告记录：\n本群警告：${count} 次\n最后警告时间：${date}`
    } else {
      // 查看本群所有用户的警告
      if (!guildWarns || Object.keys(guildWarns).length === 0) {
        return '本群暂无警告记录'
      }

      const list: Array<{ userId: string; count: number }> = []
      for (const [userId, record] of Object.entries(guildWarns)) {
        list.push({ userId, count: record.count })
      }

      // 按警告次数排序
      list.sort((a, b) => b.count - a.count)

      const lines = list.slice(0, 10).map((w, i) => {
        return `${i + 1}. ${w.userId} - ${w.count} 次`
      })

      return `本群警告记录（前10名）：\n${lines.join('\n')}`
    }
  }

  /**
   * 获取用户警告数
   */
  getWarnCount(guildId: string, userId: string): number {
    const guildWarns = this.data.warns.get(guildId)
    return guildWarns?.[userId]?.count || 0
  }

  /**
   * 获取群组所有警告
   */
  getGuildWarns(guildId: string): Array<{ userId: string; count: number; timestamp: number }> {
    const result: Array<{ userId: string; count: number; timestamp: number }> = []
    const guildWarns = this.data.warns.get(guildId)
    
    if (guildWarns) {
      for (const [userId, record] of Object.entries(guildWarns)) {
        result.push({
          userId,
          count: record.count,
          timestamp: record.timestamp
        })
      }
    }

    return result
  }
}