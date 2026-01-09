/**
 * memberManageModule - 基础群管命令模块
 * 
 * 包括成员管理类群管功能：
 * - kick: 踢出用户
 * - admin/unadmin: 管理员设置
 * - unban-allppl: 全部解禁
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class MemberManageModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'manage-member',
    description: '成员管理模块',
    version: '1.1'
  }

  protected async onInit(): Promise<void> {
    this.registerKickCommand()
    this.registerAdminCommands()
    this.registerUnbanAllPplCommand()
    this.registerTitleCommand()
  }

  /**
   * kick 命令 - 踢出用户
   */
  private registerKickCommand(): void {
    this.registerCommand({
      name: 'kick',
      desc: '踢出用户',
      args: '<input:text>',
      permNode: 'kick',
      permDesc: '踢出群成员',
      usage: '支持 @用户 或 QQ号，可指定群号，-b 加入黑名单',
      examples: ['kick @用户', 'kick 123456789', 'kick @用户 -b']
    })
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
          this.logCommand(session, 'kick', 'none', '失败：无法读取目标用户', false)
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
            await this.ctx.groupHelper.pushMessage(session.bot, `[黑名单] 用户 ${userId} 被踢出群 ${targetGroup} 并加入黑名单`, 'blacklist')
            return `已把坏人 ${userId} 踢出去并加入黑名单啦喵！`
          }

          this.logCommand(session, 'kick', userId, `成功：移出群聊 ${targetGroup}`)
          return `已把 ${userId} 踢出去喵~`
        } catch (e) {
          this.logCommand(session, 'kick', userId, `失败：未知错误`, false)
          return `喵呜...踢出失败了：${e.message}`
        }
      })
  }

  /**
   * admin/unadmin 命令 - 管理员设置
   */
  private registerAdminCommands(): void {
    this.registerCommand({
      name: 'admin',
      desc: '设置管理员',
      args: '<user:user>',
      permNode: 'admin',
      permDesc: '设置群管理员',
      examples: ['admin @用户']
    })
      .example('admin @用户')
      .action(async ({ session }, user) => {
        if (!user) return '请指定用户'

        const userId = String(user).split(':')[1]
        try {
          await session.bot.internal?.setGroupAdmin(session.guildId, userId, true)
          this.logCommand(session, 'admin', userId, '成功：已设置为管理员')
          return `已将 ${userId} 设置为管理员喵~`
        } catch (e) {
          this.logCommand(session, 'admin', userId, `失败：未知错误`, false)
          return `设置失败了喵...${e.message}`
        }
      })

    this.registerCommand({
      name: 'unadmin',
      desc: '取消管理员',
      args: '<user:user>',
      permNode: 'unadmin',
      permDesc: '取消群管理员',
      examples: ['unadmin @用户']
    })
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
   * title 命令 - 群头衔管理
   */
  private registerTitleCommand(): void {
    const titleConfig = this.config.setTitle || { enabled: false, authority: 3, maxLength: 18 }
    
    this.registerCommand({
      name: 'title',
      desc: '群头衔管理',
      permNode: 'title',
      permDesc: '设置群头衔',
      usage: '-s <文本> 设置头衔，-r 移除头衔，-u @用户 指定用户',
      examples: ['title -s 大佬', 'title -r', 'title -s 萌新 -u @用户']
    })
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
          this.logCommand(session, 'title', targetId, `失败：未知错误`, false)
          return `出错啦喵...${e.message}`
        }
      })
  }

  /**
   * unban-allppl 命令 - 解除所有人禁言
   */
  private registerUnbanAllPplCommand(): void {
    this.registerCommand({
      name: 'unban-allppl',
      desc: '解除所有人禁言',
      permNode: 'unban-allppl',
      permDesc: '批量解除所有禁言',
      usage: '解除当前群所有被禁言成员的禁言状态'
    })
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
          this.logCommand(session, 'unban-allppl', session.guildId, `失败：未知错误`, false)
          return `出错啦喵...${e}`
        }
      })
  }

  // ===== 辅助方法 =====

  /**
   * 记录命令执行日志
   */
  
}