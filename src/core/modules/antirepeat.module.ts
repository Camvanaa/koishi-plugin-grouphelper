/**
 * BasicModule - 基础群管命令模块
 * - antirepeat: 复读管理
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { Config, MuteRecord } from '../../types'
import { parseUserId, parseTimeString, formatDuration } from '../../utils'

export class AntirepeatModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'antirepeat',
    description: '防复读命令模块',
    version: '1.1'
  }

  protected async onInit(): Promise<void> {
     this.registerAntiRepeatCommand()
  }

  /**
   * antirepeat 命令 - 复读管理
   */
  private registerAntiRepeatCommand(): void {
    this.registerCommand({
      name: 'antirepeat',
      desc: '复读管理',
      args: '[threshold:number]',
      permNode: 'antirepeat',
      permDesc: '管理复读检测',
      usage: '设置复读阈值并启用，0为关闭',
      examples: ['antirepeat 5', 'antirepeat 0']
    })
      .action(async ({ session }, threshold) => {
        if (!session.guildId) return this.reply('common.guildOnly')

        const groupConfigs = this.data.groupConfig.getAll()
        const groupConfig = groupConfigs[session.guildId] || {}
        const antiRepeatConfig = (groupConfig as any).antiRepeat || {
          enabled: false,
          threshold: this.config.antiRepeat?.threshold || 5
        }

        if (threshold === undefined) {
          return this.reply('antirepeat.status', {
            status: antiRepeatConfig.enabled ? '已启用' : '未启用',
            threshold: antiRepeatConfig.threshold
          })
        }

        if (threshold === 0) {
          ;(groupConfig as any).antiRepeat = { enabled: false, threshold: antiRepeatConfig.threshold }
          groupConfigs[session.guildId] = groupConfig
          this.data.groupConfig.setAll(groupConfigs)
          this.logCommand(session, 'antirepeat', session.guildId, '成功：已关闭复读检测')
          return this.reply('antirepeat.closed')
        }

        if (threshold < 3) {
          this.logCommand(session, 'antirepeat', session.guildId, '失败：无效的阈值', false)
          return this.reply('antirepeat.invalidThreshold')
        }

        ;(groupConfig as any).antiRepeat = { enabled: true, threshold: threshold }
        groupConfigs[session.guildId] = groupConfig
        this.data.groupConfig.setAll(groupConfigs)
        this.logCommand(session, 'antirepeat', session.guildId, `成功：已设置阈值为 ${threshold} 并启用`)
        return this.reply('antirepeat.updated', { threshold })
      })
  }

}
