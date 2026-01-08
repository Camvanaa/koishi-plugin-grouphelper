import { Context, Logger } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import { formatDuration } from '../../utils'

const logger = new Logger('grouphelper:getauth')

/**
 * 获取权限模块 - 查询用户状态和权限
 */
export class GetAuthModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'getauth',
    description: '获取权限模块 - 查询用户状态和权限'
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
  }

  /**
   * 解析用户 ID（支持 @at 和纯数字）
   */
  private parseUserId(target: string): string | null {
    if (!target) return null
    try {
      if (target.startsWith('<at')) {
        const match = target.match(/id="(\d+)"/)
        if (match) return match[1]
      }
      return target.replace(/^@/, '').trim() || null
    } catch (e) {
      return target.replace(/^@/, '').trim() || null
    }
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    this.registerCommand({
      name: 'getauth',
      desc: '获取指定成员状态喵',
      args: '<target:text>',
      permNode: 'getauth',
      permDesc: '查询用户权限状态'
    })
      .alias('ga')
      .example('getauth @可爱猫娘')
      .example('getauth 2038794363')
      .action(async ({ session }, target) => {
        if (!target) return '请指定要查询的成员喵'

        const userId = this.parseUserId(target)
        if (!userId) return '无法解析成员喵'

        try {
          let role = '未知'
          let muteLine = '未禁言'
          let authorityLevel: number = 0

          // 从数据库获取权限等级
          if (this.ctx.database) {
            try {
              const dbUser = await this.ctx.database.getUser(session.platform, userId)
              authorityLevel = (dbUser && typeof dbUser.authority === 'number') ? dbUser.authority : 0
            } catch (e) {
              // ignore
            }
          }

          // 获取群成员信息
          if (session.guildId && session.bot.internal?.getGroupMemberInfo) {
            try {
              const info = await session.bot.internal.getGroupMemberInfo(session.guildId, userId, false)
              if (info) {
                if (typeof info.role !== 'undefined') role = info.role
                if (typeof info.shut_up_timestamp !== 'undefined' && info.shut_up_timestamp > 0) {
                  let ts = Number(info.shut_up_timestamp) || 0
                  let tsMs = ts > 1e12 ? ts : ts * 1000
                  const remaining = tsMs - Date.now()
                  const endTime = new Date(tsMs).toLocaleString()
                  if (remaining > 0) {
                    muteLine = `禁言至 ${endTime}(剩余 ${formatDuration(remaining)})`
                  } else {
                    muteLine = `已解除禁言(原到期：${endTime})`
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          }

          // 尝试从 session 获取权限
          if (authorityLevel === 0 && session.observeUser) {
            try {
              const observed = await session.observeUser(['authority'])
              if (observed && typeof observed.authority === 'number') authorityLevel = observed.authority
            } catch (e) {
              // ignore
            }
          }

          // 获取用户的自定义角色
          const userRoleIds = this.ctx.groupHelper.auth.getUserRoleIds(userId)
          const allRoles = this.ctx.groupHelper.auth.getRoles()
          const userRoleNames = userRoleIds
            .map(id => allRoles.find(r => r.id === id)?.name || id)
            .join(', ') || '无'

          return [
            `成员 ${userId}`,
            `群角色: ${role}`,
            `${muteLine}`,
            `权限等级: ${authorityLevel}`,
            `自定义角色: ${userRoleNames}`
          ].join('\n')
        } catch (e) {
          return `查询失败：${e.message || e}喵`
        }
      })
  }
}