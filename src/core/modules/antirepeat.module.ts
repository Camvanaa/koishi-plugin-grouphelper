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
      permDesc: '管理复读检测'
    })
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
          this.logCommand(session, 'antirepeat', session.guildId, '失败：无效的阈值', false)
          return '喵呜...阈值至少要设置为3条以上喵...'
        }

        ;(groupConfig as any).antiRepeat = { enabled: true, threshold: threshold }
        groupConfigs[session.guildId] = groupConfig
        this.data.groupConfig.setAll(groupConfigs)
        this.logCommand(session, 'antirepeat', session.guildId, `成功：已设置阈值为 ${threshold} 并启用`)
        return `已设置本群复读阈值为 ${threshold} 条并启用检测喵~`
      })
  }

}