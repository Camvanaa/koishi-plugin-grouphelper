import { Context, Service, Session } from 'koishi'
import { DataManager } from '../data'
import { AuthScope, Role, PermissionNode, RegisteredCommand, UserRoleBinding } from '../../types'

/** 内置角色 ID 列表 */
export const BUILTIN_ROLE_IDS = [
  'authority1',
  'authority2',
  'authority3',
  'authority4+',
  'guild-admin'
] as const

export type BuiltinRoleId = typeof BUILTIN_ROLE_IDS[number]

export class AuthService {
  /** 动态注册的权限节点 */
  private _permissions: Map<string, PermissionNode> = new Map()
  /** 已注册的模块通配符 */
  private _moduleWildcards: Set<string> = new Set()
  /** 已注册的命令（用于动态生成帮助） */
  private _commands: Map<string, RegisteredCommand> = new Map()

  constructor(
    private ctx: Context,
    private data: DataManager
  ) {
    // 注册系统内置权限
    this.registerPermission('*', '超级管理员', '拥有所有权限', '系统')
    
    // 初始化内置角色
    this.initBuiltinRoles()

    // 迁移旧版权限数据
    this.migrateAuthData()
  }

  private normalizeScope(scope?: AuthScope): AuthScope {
    if (!scope || !scope.type) return { type: 'global' }
    if (scope.type === 'guilds') {
      return {
        type: 'guilds',
        guildIds: Array.isArray(scope.guildIds) ? scope.guildIds : []
      }
    }
    if (scope.type === 'guildGroup') {
      return {
        type: 'guildGroup',
        guildGroupIds: Array.isArray(scope.guildGroupIds) ? scope.guildGroupIds : []
      }
    }
    return { type: 'global' }
  }

  private getRoleScope(role: Role): AuthScope {
    if (role.scope) return this.normalizeScope(role.scope)
    if (Array.isArray(role.guildIds) && role.guildIds.length > 0) {
      return { type: 'guilds', guildIds: role.guildIds }
    }
    return { type: 'global' }
  }

  private intersectScopes(a?: AuthScope, b?: AuthScope): AuthScope | null {
    const left = this.normalizeScope(a)
    const right = this.normalizeScope(b)

    if (left.type === 'global') return right
    if (right.type === 'global') return left

    if (left.type !== right.type) return null

    if (left.type === 'guilds') {
      const set = new Set(left.guildIds || [])
      const intersected = (right.guildIds || []).filter(id => set.has(id))
      return intersected.length ? { type: 'guilds', guildIds: intersected } : null
    }

    if (left.type === 'guildGroup') {
      const set = new Set(left.guildGroupIds || [])
      const intersected = (right.guildGroupIds || []).filter(id => set.has(id))
      return intersected.length ? { type: 'guildGroup', guildGroupIds: intersected } : null
    }

    return null
  }

  private isGuildInScope(scope: AuthScope, guildId?: string): boolean {
    if (!guildId) return false
    if (scope.type === 'global') return true
    if (scope.type === 'guilds') {
      return (scope.guildIds || []).includes(guildId)
    }
    if (scope.type === 'guildGroup') {
      const groups = this.data.guildGroups.get('groups') || {}
      const targetIds = scope.guildGroupIds || []
      for (const groupId of targetIds) {
        const group = groups[groupId]
        if (group && Array.isArray(group.guildIds) && group.guildIds.includes(guildId)) {
          return true
        }
      }
      return false
    }
    return false
  }

  private roleHasPermission(role: Role, node: string): boolean {
    const perms = role.permissions || []
    if (perms.includes(node)) return true
    if (perms.includes('*')) return true

    const parts = node.split('.')
    let current = ''
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : '.') + parts[i]
      if (perms.includes(current + '.*')) return true
    }

    return false
  }

  private mergeScopes(scopes: AuthScope[]): AuthScope[] {
    if (scopes.some(scope => scope.type === 'global')) {
      return [{ type: 'global' }]
    }

    const guilds = new Set<string>()
    const groups = new Set<string>()

    for (const scope of scopes) {
      if (scope.type === 'guilds') {
        for (const id of scope.guildIds || []) guilds.add(id)
      } else if (scope.type === 'guildGroup') {
        for (const id of scope.guildGroupIds || []) groups.add(id)
      }
    }

    const merged: AuthScope[] = []
    if (guilds.size) merged.push({ type: 'guilds', guildIds: Array.from(guilds) })
    if (groups.size) merged.push({ type: 'guildGroup', guildGroupIds: Array.from(groups) })
    return merged
  }

  getPermissionScopes(session: Session, node: string): AuthScope[] {
    const scopes: AuthScope[] = []
    const roles = this.data.authRoles.get('roles') || {}
    const authority = (session.user as any)?.authority || 0
    const guildId = session.guildId
    const userId = session.userId

    const addRoleScope = (roleId: string, bindingScope?: AuthScope, overrideScope?: AuthScope) => {
      const role = roles[roleId]
      if (!role) return
      if (!this.roleHasPermission(role, node)) return

      const roleScope = overrideScope || this.getRoleScope(role)
      const effectiveScope = bindingScope ? this.intersectScopes(roleScope, bindingScope) : roleScope
      if (!effectiveScope) return
      scopes.push(effectiveScope)
    }

    if (authority >= 1) addRoleScope('authority1')
    if (authority >= 2) addRoleScope('authority2')
    if (authority >= 3) addRoleScope('authority3')
    if (authority >= 4) addRoleScope('authority4+')

    const isGuildAdmin = this.checkGuildAdmin(session)
    if (isGuildAdmin && guildId) {
      addRoleScope('guild-admin', undefined, { type: 'guilds', guildIds: [guildId] })
    }

    if (userId) {
      const userBindings = this.getUserRoleBindings(userId)
      for (const binding of userBindings) {
        addRoleScope(binding.roleId, binding.scope)
      }
    }

    return this.mergeScopes(scopes)
  }

  getDefaultScopeForPermission(session: Session, node: string): AuthScope | null {
    const scopes = this.getPermissionScopes(session, node)
    if (scopes.length === 1) return scopes[0]
    return null
  }

  isScopeAllowed(allowedScopes: AuthScope[], requestedScope: AuthScope): boolean {
    if (requestedScope.type === 'global') {
      return allowedScopes.some(scope => scope.type === 'global')
    }

    for (const scope of allowedScopes) {
      if (scope.type === 'global') return true
      if (scope.type !== requestedScope.type) continue
      if (scope.type === 'guilds') {
        const allowed = new Set(scope.guildIds || [])
        const reqIds = requestedScope.guildIds || []
        if (reqIds.every(id => allowed.has(id))) return true
      } else if (scope.type === 'guildGroup') {
        const allowed = new Set(scope.guildGroupIds || [])
        const reqIds = requestedScope.guildGroupIds || []
        if (reqIds.every(id => allowed.has(id))) return true
      }
    }

    return false
  }

  private migrateAuthData(): void {
    const roles = this.data.authRoles.get('roles') || {}
    let rolesChanged = false
    const fallbackScope: AuthScope = { type: 'global' }

    for (const roleId of Object.keys(roles)) {
      const role = roles[roleId]
      if (!role.scope) {
        role.scope = this.getRoleScope(role)
        rolesChanged = true
      }
    }

    if (rolesChanged) {
      this.data.authRoles.set('roles', roles)
      this.data.authRoles.flush()
    }

    const users = this.data.authUsers.get('users') || {}
    let usersChanged = false

    for (const userId of Object.keys(users)) {
      const bindings = users[userId]
      if (!Array.isArray(bindings)) continue

      if (bindings.length === 0) {
        users[userId] = [] as UserRoleBinding[]
        continue
      }

      if (typeof bindings[0] === 'string') {
        const roleIds = bindings as unknown as string[]
        const migrated = roleIds.map(roleId => {
          const role = roles[roleId]
          return {
            roleId,
            scope: role ? this.getRoleScope(role) : fallbackScope
          }
        })
        users[userId] = migrated as unknown as UserRoleBinding[]
        usersChanged = true
        continue
      }

      const normalized: UserRoleBinding[] = []
      let changed = false
      for (const item of bindings as unknown as UserRoleBinding[]) {
        if (!item || typeof item !== 'object') continue
        const role = roles[item.roleId]
        const scope = item.scope ? this.normalizeScope(item.scope) : (role ? this.getRoleScope(role) : fallbackScope)
        if (!item.scope) changed = true
        normalized.push({ ...item, scope })
      }
      if (changed) {
        users[userId] = normalized
        usersChanged = true
      }
    }

    if (usersChanged) {
      this.data.authUsers.set('users', users)
      this.data.authUsers.flush()
    }
  }

  /**
   * 初始化内置角色（如果不存在则创建）
   */
  private initBuiltinRoles(): void {
    const roles = this.data.authRoles.get('roles') || {}
    let changed = false

    const builtinRoles: Role[] = [
      {
        id: 'authority1',
        name: 'Authority 1',
        color: '#67c23a',
        priority: 100,
        permissions: [],
        guildIds: [],
        builtin: true
      },
      {
        id: 'authority2',
        name: 'Authority 2',
        color: '#e6a23c',
        priority: 200,
        permissions: [],
        guildIds: [],
        builtin: true
      },
      {
        id: 'authority3',
        name: 'Authority 3',
        color: '#f56c6c',
        priority: 300,
        permissions: [],
        guildIds: [],
        builtin: true
      },
      {
        id: 'authority4+',
        name: 'Authority ≥4',
        color: '#9c27b0',
        priority: 400,
        permissions: [],
        guildIds: [],
        builtin: true
      },
      {
        id: 'guild-admin',
        name: '群管理员',
        color: '#409eff',
        priority: 50,
        permissions: [],
        guildIds: [],
        builtin: true
      }
    ]

    for (const role of builtinRoles) {
      if (!roles[role.id]) {
        roles[role.id] = role
        changed = true
        this.ctx.logger('grouphelper').info('创建内置角色:', role.id)
      } else {
        // 确保 builtin 标记存在
        if (!roles[role.id].builtin) {
          roles[role.id].builtin = true
          changed = true
        }
      }
    }

    if (changed) {
      this.data.authRoles.set('roles', roles)
      this.data.authRoles.flush()
    }
  }

  /**
   * 检查角色是否为内置角色
   */
  isBuiltinRole(roleId: string): boolean {
    return BUILTIN_ROLE_IDS.includes(roleId as BuiltinRoleId)
  }

  /**
   * 注册权限节点
   * @param id 权限节点ID（如 warn.add）
   * @param name 权限名称
   * @param description 权限描述
   * @param group 分组名称（用于前端显示）
   */
  registerPermission(id: string, name: string, description: string, group?: string): void {
    this._permissions.set(id, { id, name, description, group })
    
    // 自动注册模块级通配符权限（如 warn.* ）
    const moduleName = id.split('.')[0]
    if (moduleName && moduleName !== '*' && moduleName !== id && !this._moduleWildcards.has(moduleName)) {
      this._moduleWildcards.add(moduleName)
      const wildcardId = `${moduleName}.*`
      if (!this._permissions.has(wildcardId)) {
        this._permissions.set(wildcardId, {
          id: wildcardId,
          name: `${moduleName} 模块全部权限`,
          description: `拥有 ${moduleName} 模块的所有权限`,
          group: group || '通配符'
        })
      }
    }
  }

  /**
   * 获取所有已注册的权限节点
   */
  getPermissions(): PermissionNode[] {
    return Array.from(this._permissions.values())
  }

  /**
   * 注册命令信息（用于动态生成帮助）
   */
  registerCommand(cmd: RegisteredCommand): void {
    this._commands.set(cmd.name, cmd)
  }

  /**
   * 获取所有已注册的命令
   */
  getCommands(): RegisteredCommand[] {
    return Array.from(this._commands.values())
  }

  /**
   * 按模块分组获取命令
   */
  getCommandsByModule(): Map<string, RegisteredCommand[]> {
    const grouped = new Map<string, RegisteredCommand[]>()
    for (const cmd of this._commands.values()) {
      const key = cmd.moduleDesc || cmd.module
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(cmd)
    }
    return grouped
  }

  /**
   * 创建或更新角色
   */
  async saveRole(role: Role): Promise<void> {
    const roles = this.data.authRoles.get('roles') || {}
    roles[role.id] = role
    this.data.authRoles.set('roles', roles)
  }

  /**
   * 删除角色（内置角色不可删除）
   */
  async deleteRole(roleId: string): Promise<void> {
    // 内置角色不可删除
    if (this.isBuiltinRole(roleId)) {
      throw new Error('内置角色不可删除')
    }
    
    const roles = this.data.authRoles.get('roles') || {}
    if (roles[roleId]) {
      delete roles[roleId]
      this.data.authRoles.set('roles', roles)
      
      // 同时清理所有用户关联的该角色
      const users = this.data.authUsers.get('users') || {}
      let changed = false
      for (const userId in users) {
        const userRoles = users[userId] || []
        if (userRoles.some(binding => binding.roleId === roleId)) {
          users[userId] = userRoles.filter(binding => binding.roleId !== roleId)
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
   * 支持两种用户 ID 格式匹配：
   * - 完整格式: "onebot:123456"
   * - 简短格式: "123456" (纯 QQ 号)
   */
  getUserRoleIds(userId: string): string[] {
    return this.getUserRoleBindings(userId).map(binding => binding.roleId)
  }

  getUserRoleBindings(userId: string): UserRoleBinding[] {
    const users = this.data.authUsers.get('users') || {}

    // 优先精确匹配
    if (users[userId]) {
      return users[userId]
    }

    // 如果是 "platform:id" 格式，尝试匹配纯 id
    if (userId.includes(':')) {
      const pureId = userId.split(':').pop()
      if (pureId && users[pureId]) {
        return users[pureId]
      }
    }

    // 如果是纯 id 格式，尝试匹配各平台的完整格式
    for (const storedId in users) {
      if (storedId.endsWith(':' + userId)) {
        return users[storedId]
      }
    }

    return []
  }

  /**
   * 获取拥有某角色的所有用户ID
   */
  getRoleMembers(roleId: string): string[] {
    const users = this.data.authUsers.get('users') || {}
    const memberIds: string[] = []
    for (const userId in users) {
      if ((users[userId] || []).some(binding => binding.roleId === roleId)) {
        memberIds.push(userId)
      }
    }
    return memberIds
  }

  /**
   * 给用户分配角色（内置角色不可手动分配）
   */
  async assignRole(userId: string, roleId: string, scope?: AuthScope, assignedBy?: string): Promise<void> {
    // 内置角色不可手动分配
    if (this.isBuiltinRole(roleId)) {
      throw new Error('内置角色由系统自动分配，不支持手动添加成员')
    }
    
    const users = this.data.authUsers.get('users') || {}
    const userRoles = users[userId] || []
    if (!userRoles.some(binding => binding.roleId === roleId)) {
      const roles = this.data.authRoles.get('roles') || {}
      const role = roles[roleId]
      const roleScope = role ? this.getRoleScope(role) : { type: 'global' as const }
      const requestedScope = scope ? this.normalizeScope(scope) : roleScope
      const finalScope = this.intersectScopes(roleScope, requestedScope)
      if (!finalScope) {
        throw new Error('角色范围与分配范围无交集')
      }
      userRoles.push({
        roleId,
        scope: finalScope,
        assignedBy,
        assignedAt: Date.now()
      })
      users[userId] = userRoles
      this.data.authUsers.set('users', users)
    }
  }

  /**
   * 移除用户的角色（内置角色不可手动移除）
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    // 内置角色不可手动移除
    if (this.isBuiltinRole(roleId)) {
      throw new Error('内置角色由系统自动分配，不支持手动移除成员')
    }
    
    const users = this.data.authUsers.get('users') || {}
    const userRoles = users[userId] || []
    if (userRoles.some(binding => binding.roleId === roleId)) {
      users[userId] = userRoles.filter(binding => binding.roleId !== roleId)
      this.data.authUsers.set('users', users)
    }
  }

  async updateUserRoleScope(userId: string, roleId: string, scope: AuthScope, updatedBy?: string): Promise<void> {
    const users = this.data.authUsers.get('users') || {}
    const userRoles = users[userId] || []
    const index = userRoles.findIndex(binding => binding.roleId === roleId)
    if (index === -1) {
      throw new Error('用户未绑定该角色')
    }

    const roles = this.data.authRoles.get('roles') || {}
    const role = roles[roleId]
    const roleScope = role ? this.getRoleScope(role) : { type: 'global' as const }
    const requestedScope = this.normalizeScope(scope)
    const finalScope = this.intersectScopes(roleScope, requestedScope)
    if (!finalScope) {
      throw new Error('角色范围与分配范围无交集')
    }

    userRoles[index] = {
      ...userRoles[index],
      scope: finalScope,
      assignedBy: updatedBy || userRoles[index].assignedBy,
      assignedAt: Date.now()
    }
    users[userId] = userRoles
    this.data.authUsers.set('users', users)
  }

  /**
   * 获取用户的所有权限节点
   * @param session 会话对象
   *
   * 权限来源：
   * 1. 内置角色（authority1-4+）根据 Koishi 原生权限等级自动分配
   * 2. 内置角色（guild-admin）根据群管理员身份自动分配（仅当前群生效）
   * 3. 用户被手动分配的自定义角色
   */
  getUserPermissions(session: Session): Set<string> {
    const perms = new Set<string>()
    const user = session.userId
    const guildId = session.guildId
    if (!user) return perms

    const roles = this.data.authRoles.get('roles') || {}
    const authority = (session.user as any)?.authority || 0

    // 辅助函数：添加角色权限
    const addRolePermissions = (roleId: string, bindingScope?: AuthScope, checkGuildScope = true) => {
      const role = roles[roleId]
      if (!role) return

      const roleScope = this.getRoleScope(role)
      const effectiveScope = bindingScope ? this.intersectScopes(roleScope, bindingScope) : roleScope
      if (bindingScope && !effectiveScope) return
      
      if (checkGuildScope) {
        const scopeToCheck = effectiveScope || roleScope
        if (!this.isGuildInScope(scopeToCheck, guildId)) return
      }
      
      role.permissions?.forEach(p => perms.add(p))
    }

    // 1. 内置 Authority 角色（根据 Koishi 权限等级自动分配，全局生效）
    if (authority >= 1) addRolePermissions('authority1', undefined, false)
    if (authority >= 2) addRolePermissions('authority2', undefined, false)
    if (authority >= 3) addRolePermissions('authority3', undefined, false)
    if (authority >= 4) addRolePermissions('authority4+', undefined, false)

    // 2. 群管理员角色（根据群内身份自动分配，仅当前群生效）
    // 检查用户是否为群管理员或群主
    const isGuildAdmin = this.checkGuildAdmin(session)
    if (isGuildAdmin && guildId) {
      addRolePermissions('guild-admin', undefined, false) // guild-admin 的权限仅在群内触发
    }

    // 3. 用户手动分配的角色
    const userBindings = this.getUserRoleBindings(user)
    userBindings.forEach(binding => addRolePermissions(binding.roleId, binding.scope, true))

    return perms
  }

  /**
   * 检查用户是否为群管理员或群主
   */
  private checkGuildAdmin(session: Session): boolean {
    // Koishi session 中的 author 信息
    const author = session.author || (session.event as any)?.member
    if (!author) return false
    
    // 检查 roles 字段（通常包含 'admin', 'owner' 等）
    const roles = author.roles || []
    if (roles.includes('admin') || roles.includes('owner')) {
      return true
    }
    
    // OneBot 协议：检查 role 字段
    const role = (author as any).role
    if (role === 'admin' || role === 'owner') {
      return true
    }
    
    return false
  }

  /**
   * 检查用户是否有指定权限
   *
   * 权限来源（按优先级）：
   * 1. 用户被分配的角色权限
   * 2. Koishi 原生 authority 等级对应的默认权限（需在 WebUI 中配置）
   *
   * 注意：不再对高 authority 用户自动放行，必须在 WebUI 配置相应权限
   */
  check(session: Session, node: string): boolean {
    const perms = this.getUserPermissions(session)

    // 1. 精确匹配
    if (perms.has(node)) return true

    // 2. 超级通配符
    if (perms.has('*')) return true

    // 3. 逐级通配符匹配 (e.g. "warn.*" matches "warn.add")
    const parts = node.split('.')
    let current = ''
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : '.') + parts[i]
      if (perms.has(current + '.*')) return true
    }

    return false
  }
}
