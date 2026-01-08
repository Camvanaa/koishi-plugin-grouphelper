import { Context, Logger } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import { BUILTIN_ROLE_IDS } from '../services/auth.service'

const logger = new Logger('grouphelper:auth')

/**
 * 权限管理模块 - 通过命令管理用户角色
 */
export class AuthModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'auth',
    description: '权限管理模块 - 管理用户角色'
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
   * 通过 ID 或名称查找角色
   * @param roleIdentifier 角色 ID 或名称
   * @returns 找到的角色，或 null
   */
  private findRole(roleIdentifier: string) {
    const allRoles = this.ctx.groupHelper.auth.getRoles()
    // 优先精确匹配 ID
    let role = allRoles.find(r => r.id === roleIdentifier)
    if (!role) {
      // 再尝试匹配名称（忽略大小写）
      const lowerIdentifier = roleIdentifier.toLowerCase()
      role = allRoles.find(r => r.name.toLowerCase() === lowerIdentifier)
    }
    return role || null
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // gauth - 角色管理主命令
    this.registerCommand({
      name: 'gauth',
      desc: '管理用户角色',
      permNode: 'gauth',
      permDesc: '管理用户角色（主命令）'
    })

    // gauth.list - 列出所有可用角色
    this.registerCommand({
      name: 'gauth.list',
      desc: '列出所有可用角色',
      permNode: 'gauth-list',
      permDesc: '列出所有可用角色'
    })
      .action(async ({ session }) => {
        const roles = this.ctx.groupHelper.auth.getRoles()
        if (roles.length === 0) {
          return '暂无可用角色'
        }

        const lines = ['可用角色列表:']
        for (const role of roles) {
          const isBuiltin = BUILTIN_ROLE_IDS.includes(role.id as any)
          const tag = isBuiltin ? '[内置]' : ''
          const memberCount = isBuiltin ? '-' : this.ctx.groupHelper.auth.getRoleMembers(role.id).length
          lines.push(`• ${role.name} (${role.id}) ${tag} - ${memberCount} 成员`)
        }
        return lines.join('\n')
      })

    // gauth.info <user> - 查看用户角色
    this.registerCommand({
      name: 'gauth.info',
      desc: '查看用户的角色',
      args: '<target:user>',
      permNode: 'gauth-info',
      permDesc: '查看用户的角色'
    })
      .example('gauth.info @可爱猫娘')
      .example('gauth.info 123456')
      .action(async ({ session }, target) => {
        if (!target) return '请指定要查询的用户'
        
        // target 可能是 User 对象或字符串，提取纯用户 ID（去除平台前缀）
        let rawId = typeof target === 'string' ? target : (target as any)?.id || String(target)
        // 去除平台前缀（如 onebot:123456 -> 123456）
        const userId = rawId.includes(':') ? rawId.split(':').pop() : rawId
        if (!userId) return '无法解析用户 ID'

        const userRoleIds = this.ctx.groupHelper.auth.getUserRoleIds(userId)
        const allRoles = this.ctx.groupHelper.auth.getRoles()
        
        if (userRoleIds.length === 0) {
          return `用户 ${userId} 暂无自定义角色`
        }

        const lines = [`用户 ${userId} 的角色:`]
        for (const roleId of userRoleIds) {
          const role = allRoles.find(r => r.id === roleId)
          const roleName = role?.name || roleId
          lines.push(`• ${roleName} (${roleId})`)
        }
        return lines.join('\n')
      })

    // gauth.add <user> <role> - 给用户添加角色
    this.registerCommand({
      name: 'gauth.add',
      desc: '给用户添加角色',
      args: '<target:user> <roleIdentifier:text>',
      permNode: 'gauth-add',
      permDesc: '给用户添加角色'
    })
      .example('gauth.add @可爱猫娘 admin')
      .example('gauth.add @可爱猫娘 管理员')
      .example('gauth.add 123456 moderator')
      .action(async ({ session }, target, roleIdentifier) => {
        if (!target) return '请指定要操作的用户'
        if (!roleIdentifier) return '请指定要添加的角色 ID 或名称'

        // target 可能是 User 对象或字符串，提取纯用户 ID（去除平台前缀）
        let rawId = typeof target === 'string' ? target : (target as any)?.id || String(target)
        // 去除平台前缀（如 onebot:123456 -> 123456）
        const userId = rawId.includes(':') ? rawId.split(':').pop() : rawId
        if (!userId) return '无法解析用户 ID'

        // 通过 ID 或名称查找角色
        const role = this.findRole(roleIdentifier)
        if (!role) {
          return `角色 "${roleIdentifier}" 不存在，使用 gauth.list 查看可用角色`
        }

        // 检查是否为内置角色
        if (BUILTIN_ROLE_IDS.includes(role.id as any)) {
          return `"${role.name}" 是内置角色，由系统自动分配，不支持手动添加`
        }

        try {
          await this.ctx.groupHelper.auth.assignRole(userId, role.id)
          return `已将用户 ${userId} 添加到角色 "${role.name}"`
        } catch (e) {
          return `添加失败: ${e.message || e}`
        }
      })

    // gauth.remove <user> <role> - 从用户移除角色
    this.registerCommand({
      name: 'gauth.remove',
      desc: '从用户移除角色',
      args: '<target:user> <roleIdentifier:text>',
      permNode: 'gauth-remove',
      permDesc: '从用户移除角色'
    })
      .alias('gauth.rm')
      .example('gauth.remove @可爱猫娘 admin')
      .example('gauth.remove @可爱猫娘 管理员')
      .example('gauth.rm 123456 moderator')
      .action(async ({ session }, target, roleIdentifier) => {
        if (!target) return '请指定要操作的用户'
        if (!roleIdentifier) return '请指定要移除的角色 ID 或名称'

        // target 可能是 User 对象或字符串，提取纯用户 ID（去除平台前缀）
        let rawId = typeof target === 'string' ? target : (target as any)?.id || String(target)
        // 去除平台前缀（如 onebot:123456 -> 123456）
        const userId = rawId.includes(':') ? rawId.split(':').pop() : rawId
        if (!userId) return '无法解析用户 ID'

        // 通过 ID 或名称查找角色
        const role = this.findRole(roleIdentifier)
        if (!role) {
          return `角色 "${roleIdentifier}" 不存在`
        }

        // 检查是否为内置角色
        if (BUILTIN_ROLE_IDS.includes(role.id as any)) {
          return `"${role.name}" 是内置角色，由系统自动分配，不支持手动移除`
        }

        // 检查用户是否拥有该角色
        const userRoleIds = this.ctx.groupHelper.auth.getUserRoleIds(userId)
        if (!userRoleIds.includes(role.id)) {
          return `用户 ${userId} 没有角色 "${role.name}"`
        }

        try {
          await this.ctx.groupHelper.auth.revokeRole(userId, role.id)
          return `已从用户 ${userId} 移除角色 "${role.name}"`
        } catch (e) {
          return `移除失败: ${e.message || e}`
        }
      })
  }
}