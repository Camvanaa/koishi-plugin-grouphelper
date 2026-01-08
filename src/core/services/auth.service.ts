import { Context, Service, Session } from 'koishi'
import { DataManager } from '../data'
import { Role } from '../../types'

export class AuthService {
  constructor(
    private ctx: Context,
    private data: DataManager
  ) {}

  /**
   * 创建或更新角色
   */
  async saveRole(role: Role): Promise<void> {
    const roles = this.data.authRoles.get('roles') || {}
    roles[role.id] = role
    this.data.authRoles.set('roles', roles)
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId: string): Promise<void> {
    const roles = this.data.authRoles.get('roles') || {}
    if (roles[roleId]) {
      delete roles[roleId]
      this.data.authRoles.set('roles', roles)
      
      // 同时清理所有用户关联的该角色
      const users = this.data.authUsers.get('users') || {}
      let changed = false
      for (const userId in users) {
        const userRoles = users[userId]
        if (userRoles.includes(roleId)) {
          users[userId] = userRoles.filter(id => id !== roleId)
          changed = true
        }
      }
      if (changed) {
        this.data.authUsers.set('users', users)
      }
    }
  }

  /**
   * 获取所有角色
   */
  getRoles(): Role[] {
    const roles = this.data.authRoles.get('roles') || {}
    return Object.values(roles).sort((a, b) => b.priority - a.priority)
  }

  /**
   * 获取用户的角色列表
   */
  getUserRoleIds(userId: string): string[] {
    const users = this.data.authUsers.get('users') || {}
    return users[userId] || []
  }

  /**
   * 获取拥有某角色的所有用户ID
   */
  getRoleMembers(roleId: string): string[] {
    const users = this.data.authUsers.get('users') || {}
    const memberIds: string[] = []
    for (const userId in users) {
      if (users[userId].includes(roleId)) {
        memberIds.push(userId)
      }
    }
    return memberIds
  }

  /**
   * 给用户分配角色
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    const users = this.data.authUsers.get('users') || {}
    const userRoles = users[userId] || []
    if (!userRoles.includes(roleId)) {
      userRoles.push(roleId)
      users[userId] = userRoles
      this.data.authUsers.set('users', users)
    }
  }

  /**
   * 移除用户的角色
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    const users = this.data.authUsers.get('users') || {}
    const userRoles = users[userId] || []
    if (userRoles.includes(roleId)) {
      users[userId] = userRoles.filter(id => id !== roleId)
      this.data.authUsers.set('users', users)
    }
  }

  /**
   * 获取用户的所有权限节点
   */
  getUserPermissions(session: Session): Set<string> {
    const perms = new Set<string>()
    const user = session.userId
    if (!user) return perms

    // 1. 获取 Koishi 原生等级对应的默认权限
    // 注意：这里我们使用 data.authRoles 中存储的 defaultLevels
    const defaultLevels = this.data.authRoles.get('defaultLevels') || {}
    
    // 假设 session.user?.authority 获取原生等级，或者 session 本身有 authority 属性（视 Koishi 版本而定）
    // 通常 session.user.authority 是 reliable 的
    const authority = (session.user as any)?.authority || 0

    // 累加 <= 当前等级的所有默认权限
    for (let i = 0; i <= authority; i++) {
      const levelPerms = defaultLevels[i] || []
      levelPerms.forEach(p => perms.add(p))
    }

    // 2. 获取用户自定义角色权限
    const roleIds = this.getUserRoleIds(user)
    const roles = this.data.authRoles.get('roles') || {}

    roleIds.forEach(roleId => {
      const role = roles[roleId]
      if (role) {
        role.permissions.forEach(p => perms.add(p))
      }
    })

    return perms
  }

  /**
   * 检查用户是否有指定权限
   */
  check(session: Session, node: string): boolean {
    // 0. 超级管理员直接放行 (authority >= 5)
    if (((session.user as any)?.authority || 0) >= 4) return true // Koishi 默认 4 是 admin，5 是 owner

    const perms = this.getUserPermissions(session)

    // 1. 精确匹配
    if (perms.has(node)) return true

    // 2. 超级通配符
    if (perms.has('*')) return true

    // 3. 逐级通配符匹配 (e.g. "warn.*" matches "warn.add")
    // 将 node 拆分，例如 "warn.add" -> ["warn", "add"]
    const parts = node.split('.')
    let current = ''
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : '.') + parts[i]
      if (perms.has(current + '.*')) return true
    }

    return false
  }
}