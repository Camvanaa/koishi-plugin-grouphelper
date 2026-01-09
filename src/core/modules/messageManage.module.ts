/**
 * messageManageModule - 基础群管命令模块
 * 
 * 包含消息管理类群管功能：
 * - delmsg: 撤回消息
 * - essence: 精华消息
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class MessageManageModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'manage-message',
    description: '消息管理模块',
    version: '1.1'
  }

  protected async onInit(): Promise<void> {
    this.registerDelMsgCommand()
    this.registerEssenceCommand()
  }


  // ===== 其他命令实现 =====

  /**
   * delmsg 命令 - 撤回消息
   */
  private registerDelMsgCommand(): void {
    this.registerCommand({
      name: 'delmsg',
      desc: '撤回消息',
      permNode: 'delmsg',
      permDesc: '撤回群消息'
    })
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
   * essence 命令 - 精华消息管理
   */
  private registerEssenceCommand(): void {
    const essenceConfig = this.config.setEssenceMsg || { enabled: false, authority: 3 }
    
    this.registerCommand({
      name: 'essence',
      desc: '精华消息管理',
      permNode: 'essence',
      permDesc: '管理精华消息'
    })
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
          this.logCommand(session, 'essence', session.quote?.messageId || 'none', `失败：未知错误`, false)
          return `出错啦喵...${e.message}`
        }
      })
  }
}
