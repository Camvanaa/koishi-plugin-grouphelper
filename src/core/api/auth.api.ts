/**
 * 角色、权限、成员绑定与群组组 API
 */
import { Context, h } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { applyGroupGroupConfigToGuilds } from './api-utils'
import { success, error } from './api-utils'
import type { AuthScope, GuildGroup, Role } from '../../types'

export function registerAuthAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 权限管理 API =====

  /** 获取所有角色 */
  addListener('grouphelper/auth/role/list' as any, async () => {
    return success(service.auth.getRoles())
  })

  /** 创建/更新角色 */
  addListener('grouphelper/auth/role/update' as any, async (params: { role: Role }) => {
    await service.auth.saveRole(params.role)
    await service.data.authRoles.flush()
    return success({ success: true })
  })

  /** 删除角色 */
  addListener('grouphelper/auth/role/delete' as any, async (params: { roleId: string }) => {
    await service.auth.deleteRole(params.roleId)
    await service.data.authRoles.flush()
    await service.data.authUsers.flush() // 用户关联可能被清理
    return success({ success: true })
  })

  /** 获取某用户的角色列表 */
  addListener('grouphelper/auth/user/get' as any, async (params: { userId: string }) => {
    return success(service.auth.getUserRoleIds(params.userId))
  })

  /** 获取某用户的角色绑定列表（含 scope） */
  addListener('grouphelper/auth/user/bindings' as any, async (params: { userId: string }) => {
    return success(service.auth.getUserRoleBindings(params.userId))
  })

  /** 获取角色的成员列表 */
  addListener('grouphelper/auth/role/members' as any, async (params: { roleId: string, fetchNames?: boolean }) => {
    const userIds = service.auth.getRoleMembers(params.roleId)
    
    if (params.fetchNames) {
      const cacheData = service.cache.getCachedData()
      const members = userIds.map(userId => {
        const cached = cacheData.users[userId]
        return {
          id: userId,
          name: cached?.name || '',
          avatar: cached?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
        }
      })
      return success(members)
    }
    
    return success(userIds.map(id => ({ id, name: '', avatar: '' })))
  })

  /** 分配角色 */
  addListener('grouphelper/auth/user/assign' as any, async (params: { userId: string, roleId: string, scope?: AuthScope, assignedBy?: string }) => {
    await service.auth.assignRole(params.userId, params.roleId, params.scope, params.assignedBy)
    await service.data.authUsers.flush()
    return success({ success: true })
  })

  /** 移除角色 */
  addListener('grouphelper/auth/user/revoke' as any, async (params: { userId: string, roleId: string }) => {
    await service.auth.revokeRole(params.userId, params.roleId)
    await service.data.authUsers.flush()
    return success({ success: true })
  })

  /** 更新用户角色作用域 */
  addListener('grouphelper/auth/user/scope-update' as any, async (params: { userId: string, roleId: string, scope: AuthScope, updatedBy?: string }) => {
    await service.auth.updateUserRoleScope(params.userId, params.roleId, params.scope, params.updatedBy)
    await service.data.authUsers.flush()
    return success({ success: true })
  })

  /** 批量导入成员到角色 */
  addListener('grouphelper/auth/role/import-members' as any, async (params: { roleId: string, userIds: string[], scope?: AuthScope, assignedBy?: string }) => {
    try {
      const { roleId, userIds } = params
      if (!roleId || !userIds || !Array.isArray(userIds)) {
        return error('无效的参数')
      }

      // 内置角色不可手动分配
      if (service.auth.isBuiltinRole(roleId)) {
        return error('内置角色由系统自动分配，不支持手动添加成员')
      }

      let imported = 0
      for (const userId of userIds) {
        if (userId && typeof userId === 'string') {
          try {
            await service.auth.assignRole(userId.trim(), roleId, params.scope, params.assignedBy)
            imported++
          } catch {}
        }
      }

      await service.data.authUsers.flush()
      return success({ success: true, imported })
    } catch (e) {
      return error(e instanceof Error ? e.message : '导入失败')
    }
  })

  /** 获取指定 authority 等级的用户列表 */
  addListener('grouphelper/auth/users-by-authority' as any, async (params: { authority: number }) => {
    try {
      const { authority } = params
      if (typeof authority !== 'number' || authority < 1 || authority > 5) {
        return error('无效的权限等级')
      }

      // 从 Koishi 数据库查询指定权限等级的用户
      const users = await ctx.database.get('user', { authority })

      if (users.length === 0) {
        return success([])
      }

      // 获取用户的 aid 列表
      const aids = users.map(u => u.id)

      // 从 binding 表查询实际的平台用户 ID
      const bindings = await ctx.database.get('binding', { aid: { $in: aids } })

      // 按 aid 分组 bindings，优先取 onebot/red/qq 平台的绑定
      const aidToBinding: Record<number, { platform: string; pid: string }> = {}
      for (const binding of bindings) {
        const existing = aidToBinding[binding.aid]
        // 优先使用 QQ 相关平台
        const isQQPlatform = ['onebot', 'red', 'qq'].includes(binding.platform)
        if (!existing || (isQQPlatform && !['onebot', 'red', 'qq'].includes(existing.platform))) {
          aidToBinding[binding.aid] = { platform: binding.platform, pid: binding.pid }
        }
      }

      const cacheData = service.cache.getCachedData()
      const members = users
        .filter(user => aidToBinding[user.id]) // 只保留有绑定的用户
        .map(user => {
          const binding = aidToBinding[user.id]
          const userId = binding.pid
          const cached = cacheData.users[userId]
          const isQQPlatform = ['onebot', 'red', 'qq'].includes(binding.platform)
          return {
            id: userId,
            name: cached?.name || user.name || '',
            avatar: cached?.avatar || (isQQPlatform ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640` : '')
          }
        })

      return success(members)
    } catch (e) {
      ctx.logger('grouphelper').error('获取权限用户列表失败:', e)
      return error(e instanceof Error ? e.message : '获取用户列表失败')
    }
  })

  // ===== 群组组管理 API =====

  /** 获取所有群组组 */
  addListener('grouphelper/auth/guild-group/list' as any, async () => {
    const groups = service.data.guildGroups.get('groups') || {}
    return success(Object.values(groups))
  })

  /** 创建/更新群组组 */
  addListener('grouphelper/auth/guild-group/update' as any, async (params: { group: GuildGroup }) => {
    const group = params.group
    if (!group || !group.id || !group.name) return error('无效的群组组信息')
    const groups = service.data.guildGroups.get('groups') || {}
    groups[group.id] = {
      id: String(group.id),
      name: String(group.name),
      description: group.description ? String(group.description) : '',
      guildIds: Array.isArray(group.guildIds) ? group.guildIds.map(String) : []
    }
    service.data.guildGroups.set('groups', groups)
    await service.data.guildGroups.flush()
    await applyGroupGroupConfigToGuilds(data, groups[group.id].id)
    return success({ success: true })
  })

  /** 删除群组组 */
  addListener('grouphelper/auth/guild-group/delete' as any, async (params: { groupId: string }) => {
    const groups = service.data.guildGroups.get('groups') || {}
    if (groups[params.groupId]) {
      delete groups[params.groupId]
      service.data.guildGroups.set('groups', groups)
      await service.data.guildGroups.flush()
    }
    const configs = service.data.groupGroupConfig.get('configs') || {}
    if (configs[params.groupId]) {
      delete configs[params.groupId]
      service.data.groupGroupConfig.set('configs', configs)
      await service.data.groupGroupConfig.flush()
    }
    return success({ success: true })
  })

  addListener('grouphelper/auth/guild-admins' as any, async (params: { guildId: string }) => {
    try {
      const { guildId } = params
      if (!guildId) {
        return error('缺少群号')
      }

      // 获取群成员列表
      for (const bot of ctx.bots) {
        try {
          const members: any[] = []
          let next: string | undefined

          do {
            const result = await bot.getGuildMemberList(guildId, next)
            if (result.data) {
              members.push(...result.data)
            }
            next = result.next
          } while (next)

          // 筛选管理员和群主
          const admins = members.filter(member => {
            const roles = member.roles || []
            const role = (member as any).role
            return roles.includes('admin') || roles.includes('owner') || role === 'admin' || role === 'owner'
          })

          // 格式化返回
          const result = admins.map(member => {
            const userId = member.user?.id || member.userId
            let avatar = member.user?.avatar || member.avatar
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }
            return {
              id: userId,
              name: member.nick || member.user?.nick || member.user?.name || userId,
              avatar
            }
          })

          return success(result)
        } catch (e) {
          ctx.logger('grouphelper').warn('获取群管理员列表失败:', e)
        }
      }

      return error('无法获取群管理员列表')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取群管理员列表失败')
    }
  })

  /** 获取系统所有可用的权限节点列表 (供前端选择) */
  addListener('grouphelper/auth/permission/list' as any, async () => {
    // 从 AuthService 获取动态注册的权限节点
    const permissions = service.auth.getPermissions()
    return success(permissions)
  })
}
