/**
 * crossGroupModule - 跨群管理命令模块
 * 
 * 包含核心群管功能：
 * - quit-group: 退出群聊
 * - send: 远程发送消息
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class crossGroupModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'manage-cross-group',
    description: '跨群管理命令模块',
    version: '1.1'
  }

  protected async onInit(): Promise<void> {
    this.registerQuitGroupCommand()
    this.registerSendCommand()
  }

  /**
   * quit-group 命令 - 退出群聊
   */
  private registerQuitGroupCommand(): void {
    this.registerCommand({
      name: 'quit-group',
      desc: '退出指定群聊',
      args: '<groupId:string>',
      permNode: 'quit-group',
      permDesc: '退出群聊（高危）'
    })
      .example('quit-group 123456789')
      .action(async ({ session }, groupId) => {
        if (!groupId) return '喵呜...请指定要退出的群聊ID喵~'
        try {
          await session.bot.internal.setGroupLeave(groupId, false)
          this.logCommand(session, 'quit-group', groupId, `成功：已退出群聊 ${groupId}`)
          return `已成功退出群聊 ${groupId} 喵~`
        } catch (e) {
          this.logCommand(session, 'quit-group', groupId, `失败：未知错误`, false)
          return `喵呜...退出群聊失败了：${e.message}`
        }
      })
  }

  /**
   * send 命令 - 向指定群发送消息
   */
  private registerSendCommand(): void {
    this.registerCommand({
      name: 'send',
      desc: '向指定群发送消息',
      args: '<groupId:string>',
      permNode: 'send',
      permDesc: '远程发送群消息'
    })
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
          this.logCommand(session, 'send', groupId, `失败：未知错误`, false)
          return `喵呜...发送失败了：${e.message}`
        }
      })
  }
}