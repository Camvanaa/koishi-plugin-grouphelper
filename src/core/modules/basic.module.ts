/**
 * BasicModule - 基础群管命令模块
 * 
 * 包含核心群管功能：
 * - kick: 踢出用户
 * - ban/unban: 禁言/解禁
 * - stop: 短期禁言
 * - ban-all/unban-all: 全体禁言
 * - delmsg: 撤回消息
 * - admin/unadmin: 管理员设置
 * - ban-list: 禁言名单
 * - unban-random/unban-allppl: 批量解禁
 * - title: 头衔管理
 * - essence: 精华消息
 * - antirepeat: 复读管理
 * - quit-group: 退出群聊
 * - nickname: 昵称设置
 * - send: 远程发送消息
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class BasicModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'basic',
    description: '基础群管命令模块',
    version: '1.0.0'
  }

  protected async onInit(): Promise<void> {
    this.registerKickCommand()
    this.registerBanCommand()
    this.registerStopCommand()
    this.registerUnbanCommand()
    this.registerBanAllCommand()
    this.registerUnbanAllCommand()
    this.registerDelMsgCommand()
    this.registerAdminCommands()
    this.registerBanListCommand()
    this.registerUnbanRandomCommand()
    this.registerUnbanAllPplCommand()
    this.registerTitleCommand()
    this.registerEssenceCommand()
    this.registerAntiRepeatCommand()
    this.registerQuitGroupCommand()
    this.registerNicknameCommand()
    this.registerSendCommand()
  }

  /**
   * kick 命令 - 踢出用户
   */
  private registerKickCommand(): void {
    this.ctx.command('kick <input:text>', '踢出用户', { authority: 3 })
      .example('kick @用户')
      .example('kick 123456789')
      .example('kick @用户 群号')
      .example('kick @用户 -b')
      .example('kick 123456789 -b 群号')
      .option('black', '-b 加入黑名单')
      .action(async ({ session }, input) => {
        const hasBlackOption = input.includes('-b')
        input = input.replace(/-b/g, '').replace(/\s+/g, ' ').trim()

        let args: string[]
        if (input.includes('<at')) {
          const atMatch = input.match(/<at[^>]+>/)
          if (atMatch) {
            const atPart = atMatch[0]
            const restPart = input.replace(atPart, '').trim()
            args = [atPart, ...restPart.split(' ')]
          } else {
            args = input.split(' ')
          }
        } else {
          args = input.split(' ')
        }

        const [target, groupId] = args

        let userId: string
        try {
          if (target?.startsWith('<at')) {
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
          this.logCommand(session, 'kick', 'none', '失败：无法读取目标用户')
          return '喵呜...请输入正确的用户（@或QQ号）'
        }

        const targetGroup = groupId || session.guildId

        try {
          await session.bot.kickGuildMember(targetGroup, userId, hasBlackOption)

          if (hasBlackOption) {
            const blacklist = this.data.blacklist.getAll()
            blacklist[userId] = { userId, timestamp: Date.now() }
            this.data.blacklist.setAll(blacklist)
            this.logCommand(session, 'kick', userId, `成功：移出群聊并加入黑名单：${targetGroup}`)
            return `已把坏人 ${userId} 踢出去并加入黑名单啦喵！`
          }

          this.logCommand(session, 'kick', userId, `成功：移出群聊 ${targetGroup}`)
          return `已把 ${userId} 踢出去喵~`
        } catch (e) {
          this.logCommand(session, 'kick', userId, `失败：未知错误`)
          return `喵呜...踢出失败了：${e.message}`
        }
      })
  }

  /**
   * ban 命令 - 禁言用户
   */
  private registerBanCommand(): void {
    this.ctx.command('ban <input:text>', '禁言用户', { authority: 3 })
      .example('ban @用户 1h')
      .example('ban 123456789 1h')
      .example('ban @用户 1h 群号')
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

        if (!args || args.length < 2) {
          this.logCommand(session, 'ban', 'none', 'Failed: Insufficient parameters')
          return '喵呜...格式：ban <用户> <时长> [群号]'
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
          this.logCommand(session, 'ban', 'none', '失败：无法读取目标用户')
          return '喵呜...请输入正确的用户（@或QQ号）'
        }

        if (!duration) {
          this.logCommand(session, 'ban', userId, '失败：未指定禁言时长')
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
          this.logCommand(session, 'ban', userId, `失败：未知错误`)
          return `喵呜...禁言失败了：${e.message}`
        }
      })
  }

  /**
   * stop 命令 - 短期禁言（固定10分钟）
   */
  private registerStopCommand(): void {
    this.ctx.command('stop <user:user>', '短期禁言', { authority: 2 })
      .action(async ({ session }, user) => {
        if (!user) return '请指定用户'
        const userId = String(user).split(':')[1]
        
        const mutes = this.data.mutes.getAll()
        const guildMutes = mutes[session.guildId] || {}
        const lastMute = guildMutes[userId] || { startTime: 0, duration: 0 }
        
        if (lastMute.startTime + lastMute.duration > Date.now()) {
          this.logCommand(session, 'stop', userId, '失败：已在禁言中')
          return `喵呜...${userId} 已经处于禁言状态啦，不需要短期禁言喵~`
        }
        
        try {
          await session.bot.muteGuildMember(session.guildId, userId, 600000)
          this.recordMute(session.guildId, userId, 600000)
          this.logCommand(session, 'stop', userId, `成功：已短期禁言，群号 ${session.guildId}`)
          return `已将 ${userId} 短期禁言啦喵~`
        } catch (e) {
          this.logCommand(session, 'stop', userId, '失败：未知错误')
          return `喵呜...短期禁言失败了：${e.message}`
        }
      })
  }

  /**
   * unban 命令 - 解除禁言
   */
  private registerUnbanCommand(): void {
    this.ctx.command('unban <input:text>', '解除用户禁言', { authority: 3 })
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
          this.logCommand(session, 'unban', 'none', '失败：无法读取目标用户')
          return '喵呜...请输入正确的用户（@或QQ号）'
        }

        const targetGroup = groupId || session.guildId

        try {
          await session.bot.muteGuildMember(targetGroup, userId, 0)
          this.recordMute(targetGroup, userId, 0)
          this.logCommand(session, 'unban', userId, `成功：已解除禁言，群号 ${targetGroup}`)
          return `已经把 ${userId} 的禁言解除啦喵！开心~`
        } catch (e) {
          this.logCommand(session, 'unban', userId, `失败：未知错误`)
          return `喵呜...解除禁言失败了：${e.message}`
        }
      })
  }

  /**
   * ban-all 命令 - 全体禁言
   */
  private registerBanAllCommand(): void {
    this.ctx.command('ban-all', '全体禁言', { authority: 3 })
      .action(async ({ session }) => {
        try {
          await session.bot.internal.setGroupWholeBan(session.guildId, true)
          this.logCommand(session, 'ban-all', session.guildId, `成功：已开启全体禁言，群号 ${session.guildId}`)
          return '喵呜...全体禁言开启啦，大家都要乖乖的~'
        } catch (e) {
          this.logCommand(session, 'ban-all', session.guildId, `失败：未知错误`)
          return `出错啦喵...${e}`
        }
      })
  }

  /**
   * unban-all 命令 - 解除全体禁言
   */
  private registerUnbanAllCommand(): void {
    this.ctx.command('unban-all', '解除全体禁言', { authority: 3 })
      .action(async ({ session }) => {
        try {
          await session.bot.internal.setGroupWholeBan(session.guildId, false)
          this.logCommand(session, 'unban-all', session.guildId, `成功：已解除全体禁言，群号 ${session.guildId}`)
          return '全体禁言解除啦喵，可以开心聊天啦~'
        } catch (e) {
          this.logCommand(session, 'unban-all', session.guildId, `失败：未知错误`)
          return `出错啦喵...${e}`
        }
      })
  }

  // ===== 辅助方法 =====

  /**
   * 记录命令执行日志
   */
  private logCommand(session: any, command: string, target: string, result: string): void {
    // 使用 BaseModule 的 log 方法
    this.log(session, command, target, result)
  }

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

  // ===== 其他命令实现 =====

  /**
   * delmsg 命令 - 撤回消息
   */
  private registerDelMsgCommand(): void {
    this.ctx.command('delmsg', '撤回消息', { authority: 3 })
      .action(async ({ session }) => {
        if (!session.quote) return '喵喵！请回复要撤回的消息呀~'

        try {
          await session.bot.deleteMessage(session.channelId, session.quote.id)
          return ''
        } catch (e) {
          return '呜呜...撤回失败了，可能太久了或者没有权限喵...'
        }
      })
  }

  /**
   * admin/unadmin 命令 - 管理员设置
   */
  private registerAdminCommands(): void {
    this.ctx.command('admin <user:user>', '设置管理员', { authority: 4 })
      .example('admin @用户')
      .action(async ({ session }, user) => {
        if (!user) return '请指定用户'

        const userId = String(user).split(':')[1]
        try {
          await session.bot.internal?.setGroupAdmin(session.guildId, userId, true)
          this.logCommand(session, 'admin', userId, '成功：已设置为管理员')
          return `已将 ${userId} 设置为管理员喵~`
        } catch (e) {
          this.logCommand(session, 'admin', userId, `失败：未知错误`)
          return `设置失败了喵...${e.message}`
        }
      })

    this.ctx.command('unadmin <user:user>', '取消管理员', { authority: 4 })
      .example('unadmin @用户')
      .action(async ({ session }, user) => {
        if (!user) return '请指定用户'

        const userId = String(user).split(':')[1]
        try {
          await session.bot.internal?.setGroupAdmin(session.guildId, userId, false)
          this.logCommand(session, 'unadmin', userId, '成功：已取消管理员')
          return `已取消 ${userId} 的管理员权限喵~`
        } catch (e) {
          this.logCommand(session, 'unadmin', userId, `失败：未知错误`)
          return `取消失败了喵...${e.message}`
        }
      })
  }

  /**
   * ban-list 命令 - 查询禁言名单
   */
  private registerBanListCommand(): void {
    this.ctx.command('ban-list', '查询当前禁言名单', { authority: 3 })
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
    this.ctx.command('unban-random <count:number>', '随机解除若干人禁言', { authority: 3 })
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
          this.logCommand(session, 'unban-random', session.guildId, '失败：当前没有被禁言的成员')
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
   * unban-allppl 命令 - 解除所有人禁言
   */
  private registerUnbanAllPplCommand(): void {
    this.ctx.command('unban-allppl', '解除所有人禁言', { authority: 3 })
      .action(async ({ session }) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'

        try {
          const mutes = this.data.mutes.getAll()
          const currentMutes = mutes[session.guildId] || {}
          const now = Date.now()

          let count = 0
          for (const userId in currentMutes) {
            if (!currentMutes[userId].leftGroup) {
              try {
                const muteEndTime = currentMutes[userId].startTime + currentMutes[userId].duration
                if (now >= muteEndTime) {
                  delete currentMutes[userId]
                  continue
                }

                const memberInfo = await session.bot.internal.getGroupMemberInfo(session.guildId, userId, false)
                if (memberInfo.shut_up_timestamp > 0) {
                  await session.bot.muteGuildMember(session.guildId, userId, 0)
                  delete currentMutes[userId]
                  count++
                } else {
                  delete currentMutes[userId]
                }
              } catch (e) {
                console.error(`解除用户 ${userId} 禁言失败:`, e)
              }
            }
          }

          mutes[session.guildId] = currentMutes
          this.data.mutes.setAll(mutes)
          this.logCommand(session, 'unban-allppl', session.guildId, `成功：已解除 ${count} 人的禁言`)
          return count > 0 ? `已解除 ${count} 人的禁言啦！` : '当前没有被禁言的成员喵~'
        } catch (e) {
          return `出错啦喵...${e}`
        }
      })
  }

  /**
   * title 命令 - 群头衔管理
   */
  private registerTitleCommand(): void {
    const titleConfig = this.config.setTitle || { enabled: false, authority: 3, maxLength: 18 }
    
    this.ctx.command('title', '群头衔管理', { authority: titleConfig.authority || 3 })
      .option('s', '-s <text> 设置头衔')
      .option('r', '-r 移除头衔')
      .option('u', '-u <user:user> 指定用户')
      .action(async ({ session, options }) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
        if (!titleConfig.enabled) return '喵呜...头衔功能未启用...'

        let targetId = session.userId
        if (options.u) {
          targetId = String(options.u).split(':')[1]
        }

        try {
          if (options.s) {
            const title = options.s.toString()
            if (new TextEncoder().encode(title).length > (titleConfig.maxLength || 18)) {
              return `喵呜...头衔太长啦！最多只能有 ${titleConfig.maxLength || 18} 个字节哦~`
            }
            await session.bot.internal.setGroupSpecialTitle(session.guildId, targetId, title)
            this.logCommand(session, 'title', targetId, `成功：已设置头衔：${title}`)
            return `已经设置好头衔啦喵~`
          } else if (options.r) {
            await session.bot.internal.setGroupSpecialTitle(session.guildId, targetId, '')
            this.logCommand(session, 'title', targetId, `成功：已移除头衔`)
            return `已经移除头衔啦喵~`
          }
          return '请使用 -s <文本> 设置头衔或 -r 移除头衔\n可选 -u @用户 为指定用户设置'
        } catch (e) {
          this.logCommand(session, 'title', targetId, `失败：未知错误`)
          return `出错啦喵...${e.message}`
        }
      })
  }

  /**
   * essence 命令 - 精华消息管理
   */
  private registerEssenceCommand(): void {
    const essenceConfig = this.config.setEssenceMsg || { enabled: false, authority: 3 }
    
    this.ctx.command('essence', '精华消息管理', { authority: essenceConfig.authority || 3 })
      .option('s', '-s 设置精华消息')
      .option('r', '-r 取消精华消息')
      .action(async ({ session, options }) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
        if (!essenceConfig.enabled) return '喵呜...精华消息功能未启用...'
        if (!session.quote) return '喵喵！请回复要操作的消息呀~'

        try {
          if (options.s) {
            await session.bot.internal.setEssenceMsg(session.quote.messageId)
            this.logCommand(session, 'essence', 'set', `成功：已设置精华消息：${session.quote.messageId}`)
            return '已经设置为精华消息啦喵~'
          } else if (options.r) {
            await session.bot.internal.deleteEssenceMsg(session.quote.messageId)
            this.logCommand(session, 'essence', 'remove', `成功：已取消精华消息：${session.quote.messageId}`)
            return '已经取消精华消息啦喵~'
          }
          return '请使用 -s 设置精华消息或 -r 取消精华消息'
        } catch (e) {
          this.logCommand(session, 'essence', session.quote?.messageId || 'none', `失败：未知错误`)
          return `出错啦喵...${e.message}`
        }
      })
  }

  /**
   * antirepeat 命令 - 复读管理
   */
  private registerAntiRepeatCommand(): void {
    this.ctx.command('antirepeat [threshold:number]', '复读管理', { authority: 3 })
      .action(async ({ session }, threshold) => {
        if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

        const groupConfigs = this.data.groupConfig.getAll()
        const groupConfig = groupConfigs[session.guildId] || {}
        const antiRepeatConfig = (groupConfig as any).antiRepeat || {
          enabled: false,
          threshold: this.config.antiRepeat?.threshold || 5
        }

        if (threshold === undefined) {
          return `当前群复读配置：
状态：${antiRepeatConfig.enabled ? '已启用' : '未启用'}
阈值：${antiRepeatConfig.threshold} 条
使用方法：
antirepeat 数字 - 设置复读阈值并启用（至少3条）
antirepeat 0 - 关闭复读检测`
        }

        if (threshold === 0) {
          ;(groupConfig as any).antiRepeat = { enabled: false, threshold: antiRepeatConfig.threshold }
          groupConfigs[session.guildId] = groupConfig
          this.data.groupConfig.setAll(groupConfigs)
          this.logCommand(session, 'antirepeat', session.guildId, '成功：已关闭复读检测')
          return '已关闭本群的复读检测喵~'
        }

        if (threshold < 3) {
          this.logCommand(session, 'antirepeat', session.guildId, '失败：无效的阈值')
          return '喵呜...阈值至少要设置为3条以上喵...'
        }

        ;(groupConfig as any).antiRepeat = { enabled: true, threshold: threshold }
        groupConfigs[session.guildId] = groupConfig
        this.data.groupConfig.setAll(groupConfigs)
        this.logCommand(session, 'antirepeat', session.guildId, `成功：已设置阈值为 ${threshold} 并启用`)
        return `已设置本群复读阈值为 ${threshold} 条并启用检测喵~`
      })
  }

  /**
   * quit-group 命令 - 退出群聊
   */
  private registerQuitGroupCommand(): void {
    this.ctx.command('quit-group <groupId:string>', '退出指定群聊', { authority: 4 })
      .example('quit-group 123456789')
      .action(async ({ session }, groupId) => {
        if (!groupId) return '喵呜...请指定要退出的群聊ID喵~'
        try {
          await session.bot.internal.setGroupLeave(groupId, false)
          this.logCommand(session, 'quit-group', groupId, `成功：已退出群聊 ${groupId}`)
          return `已成功退出群聊 ${groupId} 喵~`
        } catch (e) {
          this.logCommand(session, 'quit-group', groupId, `失败：未知错误`)
          return `喵呜...退出群聊失败了：${e.message}`
        }
      })
  }

  /**
   * nickname 命令 - 设置用户昵称
   */
  private registerNicknameCommand(): void {
    this.ctx.command('nickname <user:user> <nickname:string> <group:string>', '设置用户昵称', { authority: 3 })
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
          this.logCommand(session, 'nickname', userId, `失败：未知错误`)
          return `喵呜...设置昵称失败了：${e.message}`
        }
      })
  }

  /**
   * send 命令 - 向指定群发送消息
   */
  private registerSendCommand(): void {
    this.ctx.command('send <groupId:string>', '向指定群发送消息', { authority: 3 })
      .example('send 123456789')
      .option('s', '-s 静默发送，不显示发送者信息')
      .action(async ({ session, options }, groupId) => {
        if (!session.quote) return '喵喵！请回复要发送的消息呀~'

        try {
          if (options.s) {
            await session.bot.sendMessage(groupId, session.quote.content)
          } else {
            await session.bot.sendMessage(groupId, '用户' + session.userId + '远程投送消息：\n' + session.quote.content)
          }
          
          if (options.s) {
            this.logCommand(session, 'send', groupId, `成功：已静默发送消息：${session.quote.messageId}`)
          } else {
            this.logCommand(session, 'send', groupId, `成功：已发送消息：${session.quote.messageId}`)
          }
          return `已将消息发送到群 ${groupId} 喵~`
        } catch (e) {
          this.logCommand(session, 'send', groupId, `失败：未知错误`)
          return `喵呜...发送失败了：${e.message}`
        }
      })
  }

  // ===== 辅助方法 =====

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