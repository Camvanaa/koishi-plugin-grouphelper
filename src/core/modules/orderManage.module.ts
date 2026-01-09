/**
 * orderManageModule - 秩序管理命令模块
 * 
 * 包含秩序管理类群管功能：
 * - ban/unban: 禁言/解禁
 * - stop: 短期禁言
 * - ban-all/unban-all: 全体禁言
 * - ban-list: 禁言名单
 * - nickname: 昵称设置
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class OrderManageModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'manage-order',
    description: '秩序管理命令模块',
    version: '1.1'
  }

  protected async onInit(): Promise<void> {
    this.registerBanCommand()
    this.registerStopCommand()
    this.registerUnbanCommand()
    this.registerBanAllCommand()
    this.registerUnbanAllCommand()
    this.registerBanListCommand()
    this.registerUnbanRandomCommand()
    this.registerNicknameCommand()
  }

  /**
   * ban 命令 - 禁言用户
   */
  private registerBanCommand(): void {
    this.registerCommand({
      name: 'ban',
      desc: '禁言用户',
      args: '<input:text>',
      permNode: 'ban',
      permDesc: '禁言群成员'
    })
      .example('ban @用户 1h')
      .example('ban 123456789 1h')
      .example('ban @用户 1h 群号')
      .action(async ({ session }, input) => {

      if (!input) {
        // 将对应的 log.success 设为失败
        this.logCommand(session, 'ban', 'none', '失败：缺少必要参数', false)
        return '喵呜...格式：ban &lt;用户> &lt;时长> [群号]'
      }
      if (session.quote && input.endsWith(session.quote.content.toString())) {
        input = input.slice(0, input.length - session.quote.content.length).trim()
      }
        let args: string[]
        if (input.includes('<at')) {
          const atMatch = input.match(/<at[^>]+>/)
          if (atMatch) {
            const atPart = atMatch[0]
            const restPart = input.replace(atPart, '').trim()
            args = [atPart, ...restPart.split(/\s+/)]
          } else {
            args = input.split(/\s+/)
          }
        } else {
          args = input.split(/\s+/)
        }

        if (!input || !args || args.length < 2) {
          this.logCommand(session, 'ban', 'none', '失败：缺少必要参数',false)
          return '喵呜...格式：ban &lt;用户> &lt;时长> [群号]'
        }

        const [target, duration, groupId] = args

        let userId: string
        try {
          if (target.startsWith('<at')) {
            const match = target.match(/id="(\d+)"/)
            if (match) {
              userId = match[1]
            }
          } else {
            userId = parseUserId(target)
          }
        } catch (e) {
          userId = parseUserId(target)
        }

        if (!userId) {
          this.logCommand(session, 'ban', 'none', '失败：无法读取目标用户', false)
          return '喵呜...请输入正确的用户（@或QQ号）'
        }

        if (!duration) {
          this.logCommand(session, 'ban', userId, '失败：未指定禁言时长', false)
          return '喵呜...请告诉我要禁言多久呀~'
        }

        const targetGroup = groupId || session.guildId

        try {
          const milliseconds = parseTimeString(duration)
          await session.bot.muteGuildMember(targetGroup, userId, milliseconds)
          this.recordMute(targetGroup, userId, milliseconds)

          const timeStr = formatDuration(milliseconds)
          this.logCommand(session, 'ban', userId, `成功：已禁言 ${timeStr}，群号：${targetGroup}`)
          return `已经把 ${userId} 禁言 ${duration} (${timeStr}) 啦喵~`
        } catch (e) {
          this.logCommand(session, 'ban', userId, `失败：未知错误`, false)
          return `喵呜...禁言失败了：${e.message}`
        }
      })
  }

  /**
   * stop 命令 - 短期禁言（固定10分钟）
   */
  private registerStopCommand(): void {
    this.registerCommand({
      name: 'stop',
      desc: '短期禁言',
      args: '<user:user>',
      permNode: 'stop',
      permDesc: '短期禁言（10分钟）'
    })
      .action(async ({ session }, user) => {
        if (!user) return '请指定用户'
        const userId = String(user).split(':')[1]
        
        const mutes = this.data.mutes.getAll()
        const guildMutes = mutes[session.guildId] || {}
        const lastMute = guildMutes[userId] || { startTime: 0, duration: 0 }
        
        if (lastMute.startTime + lastMute.duration > Date.now()) {
          this.logCommand(session, 'stop', userId, '失败：已在禁言中', false)
          return `喵呜...${userId} 已经处于禁言状态啦，不需要短期禁言喵~`
        }
        
        try {
          await session.bot.muteGuildMember(session.guildId, userId, 600000)
          this.recordMute(session.guildId, userId, 600000)
          this.logCommand(session, 'stop', userId, `成功：已短期禁言，群号 ${session.guildId}`)
          return `已将 ${userId} 短期禁言啦喵~`
        } catch (e) {
          this.logCommand(session, 'stop', userId, '失败：未知错误', false)
          return `喵呜...短期禁言失败了：${e.message}`
        }
      })
  }

  /**
   * unban 命令 - 解除禁言
   */
  private registerUnbanCommand(): void {
    this.registerCommand({
      name: 'unban',
      desc: '解除用户禁言',
      args: '<input:text>',
      permNode: 'unban',
      permDesc: '解除禁言'
    })
      .example('unban @用户')
      .example('unban 123456789')
      .example('unban @用户 群号')
      .action(async ({ session }, input) => {
        let args: string[]
        if (input.includes('<at')) {
          const atMatch = input.match(/<at[^>]+>/)
          if (atMatch) {
            const atPart = atMatch[0]
            const restPart = input.replace(atPart, '').trim()
            args = [atPart, ...restPart.split(/\s+/)]
          } else {
            args = input.split(/\s+/)
          }
        } else {
          args = input.split(/\s+/)
        }

        const [target, groupId] = args

        let userId: string
        try {
          if (target.startsWith('<at')) {
            const match = target.match(/id="(\d+)"/)
            if (match) {
              userId = match[1]
            }
          } else {
            userId = parseUserId(target)
          }
        } catch (e) {
          userId = parseUserId(target)
        }

        if (!userId) {
          this.logCommand(session, 'unban', 'none', '失败：无法读取目标用户', false)
          return '喵呜...请输入正确的用户（@或QQ号）'
        }

        const targetGroup = groupId || session.guildId

        try {
          await session.bot.muteGuildMember(targetGroup, userId, 0)
          this.recordMute(targetGroup, userId, 0)
          this.logCommand(session, 'unban', userId, `成功：已解除禁言，群号 ${targetGroup}`)
          return `已经把 ${userId} 的禁言解除啦喵！开心~`
        } catch (e) {
          this.logCommand(session, 'unban', userId, `失败：未知错误`, false)
          return `喵呜...解除禁言失败了：${e.message}`
        }
      })
  }

  /**
   * ban-all 命令 - 全体禁言
   */
  private registerBanAllCommand(): void {
    this.registerCommand({
      name: 'ban-all',
      desc: '全体禁言',
      permNode: 'ban-all',
      permDesc: '开启全体禁言'
    })
      .action(async ({ session }) => {
        try {
          await session.bot.internal.setGroupWholeBan(session.guildId, true)
          this.logCommand(session, 'ban-all', session.guildId, `成功：已开启全体禁言，群号 ${session.guildId}`)
          return '喵呜...全体禁言开启啦，大家都要乖乖的~'
        } catch (e) {
          this.logCommand(session, 'ban-all', session.guildId, `失败：未知错误`, false)
          return `出错啦喵...${e}`
        }
      })
  }

  /**
   * unban-all 命令 - 解除全体禁言
   */
  private registerUnbanAllCommand(): void {
    this.registerCommand({
      name: 'unban-all',
      desc: '解除全体禁言',
      permNode: 'unban-all',
      permDesc: '解除全体禁言'
    })
      .action(async ({ session }) => {
        try {
          await session.bot.internal.setGroupWholeBan(session.guildId, false)
          this.logCommand(session, 'unban-all', session.guildId, `成功：已解除全体禁言，群号 ${session.guildId}`)
          return '全体禁言解除啦喵，可以开心聊天啦~'
        } catch (e) {
          this.logCommand(session, 'unban-all', session.guildId, `失败：未知错误`, false)
          return `出错啦喵...${e}`
        }
      })
  }

  /**
   * ban-list 命令 - 查询禁言名单
   */
  private registerBanListCommand(): void {
    this.registerCommand({
      name: 'ban-list',
      desc: '查询当前禁言名单',
      permNode: 'ban-list',
      permDesc: '查询禁言名单'
    })
      .action(async ({ session }) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'
        
        const mutes = this.data.mutes.getAll()
        const currentMutes = mutes[session.guildId] || {}

        const formatMutes = Object.entries(currentMutes)
          .filter(([, data]) => {
            const muteData = data as MuteRecord
            return !muteData.leftGroup && Date.now() - muteData.startTime < muteData.duration
          })
          .map(([userId, data]) => {
            const muteData = data as MuteRecord
            const remainingTime = muteData.duration - (Date.now() - muteData.startTime)
            return `用户 ${userId}：剩余 ${formatDuration(remainingTime)}`
          })
          .join('\n')

        if (formatMutes) {
          return `当前禁言名单：\n${formatMutes}`
        } else {
          return '当前没有被禁言的成员喵~'
        }
      })
  }

  /**
   * unban-random 命令 - 随机解禁
   */
  private registerUnbanRandomCommand(): void {
    this.registerCommand({
      name: 'unban-random',
      desc: '随机解除若干人禁言',
      args: '<count:number>',
      permNode: 'unban-random',
      permDesc: '随机解除禁言'
    })
      .action(async ({ session }, count) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'
        count = count || 1

        const mutes = this.data.mutes.getAll()
        const currentMutes = mutes[session.guildId] || {}
        const banList: string[] = []

        for (const userId in currentMutes) {
          const muteEndTime = currentMutes[userId].startTime + currentMutes[userId].duration
          if (muteEndTime > Date.now()) {
            banList.push(userId)
          }
        }

        if (banList.length === 0) {
          this.logCommand(session, 'unban-random', session.guildId, '失败：当前没有被禁言的成员', false)
          return '当前没有被禁言的成员喵~'
        }

        const unbanList = this.getRandomElements(banList, count)

        for (const userId of unbanList) {
          await session.bot.muteGuildMember(session.guildId, userId, 0)
          currentMutes[userId].startTime = Date.now()
          currentMutes[userId].duration = 0
        }

        mutes[session.guildId] = currentMutes
        this.data.mutes.setAll(mutes)
        this.logCommand(session, 'unban-random', session.guildId, `成功：已随机解除 ${unbanList.length} 人的禁言，解除名单：${unbanList.join(', ')}`)
        return `已随机解除 ${unbanList.length} 人的禁言喵~\n解除名单：\n${unbanList.join(', ')}`
      })
  }

  /**
   * nickname 命令 - 设置用户昵称
   */
  private registerNicknameCommand(): void {
    this.registerCommand({
      name: 'nickname',
      desc: '设置用户昵称',
      args: '<user:user> <nickname:string> <group:string>',
      permNode: 'nickname',
      permDesc: '设置群成员昵称'
    })
      .example('nickname 123456789 小猫咪')
      .action(async ({ session }, user, nickname, group) => {
        if (!user) return '喵呜...请指定用户喵~'

        const userId = String(user).split(':')[1]
        try {
          if (nickname) {
            await session.bot.internal.setGroupCard(group || session.guildId, userId, nickname)
            this.logCommand(session, 'nickname', userId, `成功：已设置昵称为 ${nickname}, 群号 ${group || session.guildId}`)
            return `已将 ${userId} 的昵称设置为 "${nickname}" 喵~`
          } else {
            await session.bot.internal.setGroupCard(group || session.guildId, userId)
            this.logCommand(session, 'nickname', userId, `成功：已清除昵称, 群号 ${group || session.guildId}`)
            return `已将 ${userId} 的昵称清除喵~`
          }
        } catch (e) {
          this.logCommand(session, 'nickname', userId, `失败：未知错误`, false)
          return `喵呜...设置昵称失败了：${e.message}`
        }
      })
  }

  // ===== 辅助方法 =====

  /**
   * 记录禁言
   */
  private recordMute(guildId: string, userId: string, duration: number): void {
    const mutes = this.data.mutes.getAll()
    if (!mutes[guildId]) {
      mutes[guildId] = {}
    }
    mutes[guildId][userId] = {
      startTime: Date.now(),
      duration
    }
    this.data.mutes.setAll(mutes)
  }

  /**
   * 获取随机元素
   */
  private getRandomElements(arr: string[], n: number): string[] {
    const result: string[] = []
    const arrCopy = [...arr]
    n = Math.min(n, arrCopy.length)
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * arrCopy.length)
      result.push(arrCopy[idx])
      arrCopy.splice(idx, 1)
    }
    return result
  }
}