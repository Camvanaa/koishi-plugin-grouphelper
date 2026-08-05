/**
 * WebUI API 客户端封装
 * 提供类型安全的 API 调用方法
 */

import { send } from '@koishijs/client'
import type {
  GroupConfig,
  WarnRecord,
  BlacklistRecord,
  Subscription,
  Role,
  PermissionNode,
  RoleMember,
  AuthScope,
  UserRoleBinding,
  GuildGroup
} from './types'

// 重新导出类型
export type { GroupConfig, WarnRecord, BlacklistRecord, Subscription, Role, PermissionNode, RoleMember, AuthScope, UserRoleBinding, GuildGroup }

// 仪表盘统计数据类型
export interface DashboardStats {
  totalGroups: number
  totalWarns: number
  totalBlacklisted: number
  totalSubscriptions: number
  /** 插件版本号，由后端 stats/dashboard 返回 */
  version?: string
  timestamp: number
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 通用调用封装
async function call<T>(event: string, params?: any): Promise<T> {
  // send 在 WebSocket 未连接时直接返回 undefined 而不是 Promise，
  // 不先判空的话下面取 .success 会抛出难以理解的 TypeError
  const result = await send(event as any, params) as ApiResponse<T> | undefined
  if (!result) {
    throw new Error('与后端的连接已断开，请刷新页面重试')
  }
  if (!result.success) {
    throw new Error(result.error || '请求失败')
  }
  return result.data as T
}

// 群组配置 API
export const configApi = {
  list: (fetchNames?: boolean) => call<Record<string, GroupConfig>>('grouphelper/config/list', { fetchNames }),
  get: (guildId: string) => call<GroupConfig | undefined>('grouphelper/config/get', { guildId }),
  update: (guildId: string, config: GroupConfig) => call<{ success: boolean }>('grouphelper/config/update', { guildId, config }),
  groupGroupConfigList: () => call<Record<string, Partial<GroupConfig>>>('grouphelper/config/group-group-config/list'),
  groupGroupConfigGet: (groupId: string) => call<Partial<GroupConfig>>('grouphelper/config/group-group-config/get', { groupId }),
  groupGroupConfigUpdate: (groupId: string, config: Partial<GroupConfig>) =>
    call<{ success: boolean }>('grouphelper/config/group-group-config/update', { groupId, config }),
  create: (guildId: string) => call<{ success: boolean }>('grouphelper/config/create', { guildId }),
  delete: (guildId: string) => call<{ success: boolean }>('grouphelper/config/delete', { guildId }),
  /** 重新从文件加载配置 */
  reload: () => call<{ success: boolean; count: number }>('grouphelper/config/reload'),
}

// 警告记录 API
export const warnsApi = {
  list: (fetchNames?: boolean) => call<any[]>('grouphelper/warns/list', { fetchNames }),
  get: (key: string) => call<WarnRecord | undefined>('grouphelper/warns/get', { key }),
  add: (guildId: string, userId: string) => call<{ success: boolean }>('grouphelper/warns/add', { guildId, userId }),
  clear: (key: string) => call<{ success: boolean }>('grouphelper/warns/clear', { key }),
  update: (key: string, count: number) => call<{ success: boolean }>('grouphelper/warns/update', { key, count }),
  /** 重新从文件加载警告数据 */
  reload: () => call<{ success: boolean }>('grouphelper/warns/reload'),
}

// 黑名单 API
export const blacklistApi = {
  list: () => call<Record<string, BlacklistRecord>>('grouphelper/blacklist/list'),
  add: (userId: string, record: BlacklistRecord) => call<{ success: boolean }>('grouphelper/blacklist/add', { userId, record }),
  remove: (userId: string) => call<{ success: boolean }>('grouphelper/blacklist/remove', { userId }),
}

// 订阅 API
export const subscriptionApi = {
  list: (fetchNames?: boolean) => call<Subscription[]>('grouphelper/subscriptions/list', { fetchNames }),
  add: (subscription: Subscription) => call<{ success: boolean }>('grouphelper/subscriptions/add', { subscription }),
  // 按 type+id 定位，不用数组下标——下标会因他人增删而指向错误的订阅
  remove: (type: string, id: string) => call<{ success: boolean }>('grouphelper/subscriptions/remove', { type, id }),
  update: (type: string, id: string, subscription: Subscription) =>
    call<{ success: boolean }>('grouphelper/subscriptions/update', { type, id, subscription }),
}

export interface ModuleStatus {
  name: string
  description: string
  state: 'unloaded' | 'loading' | 'loaded' | 'error'
  error?: string
}

// 图表数据类型
export interface ChartTrendItem {
  date: string
  count: number
}

export interface ChartDistributionItem {
  command: string
  count: number
}

export interface ChartGuildRankItem {
  guildId: string
  count: number
  name?: string
}

export interface ChartUserRankItem {
  userId: string
  count: number
  name: string
}

export interface ChartData {
  trend: ChartTrendItem[]
  distribution: ChartDistributionItem[]
  successRate: { success: number; fail: number }
  guildRank: ChartGuildRankItem[]
  userRank: ChartUserRankItem[]
}

// 统计 API
export const statsApi = {
  dashboard: () => call<DashboardStats>('grouphelper/stats/dashboard'),
  modules: () => call<ModuleStatus[]>('grouphelper/stats/modules'),
  charts: (days?: number) => call<ChartData>('grouphelper/stats/charts', { days }),
}

// 日志 API
import type { LogSearchParams, LogResponse } from './types'
export const logsApi = {
  search: (params: LogSearchParams) => call<LogResponse>('grouphelper/logs/search', params),
}

// 全局设置 API
export const settingsApi = {
  get: () => call<any>('grouphelper/settings/get'),
  update: (settings: any) => call<{ success: boolean }>('grouphelper/settings/update', { settings }),
  reset: () => call<{ success: boolean }>('grouphelper/settings/reset'),
}

export interface ReplyPresetInfo {
  id: string
  label: string
  description: string
}

export interface ReplyTemplateInfo {
  key: string
  group: string
  label: string
  description?: string
  variables?: string[]
}

export interface ReplyCatalog {
  presets: ReplyPresetInfo[]
  templates: ReplyTemplateInfo[]
  defaults: Record<string, Record<string, string>>
}

export const repliesApi = {
  catalog: () => call<ReplyCatalog>('grouphelper/replies/catalog'),
}

// 群成员类型
export interface GuildMember {
  id: string
  name: string
  avatar?: string
  isAdmin?: boolean
  isOwner?: boolean
  title?: string
  joinedAt?: number
}

// 聊天 API
export const chatApi = {
  send: (channelId: string, content: string, platform?: string, guildId?: string) =>
    call<{ success: boolean }>('grouphelper/chat/send', { channelId, content, platform, guildId }),
  /** 获取群信息 */
  getGuildInfo: (guildId: string) =>
    call<{ name?: string; avatar?: string }>('grouphelper/chat/guild-info', { guildId }),
  /** 获取用户信息 */
  getUserInfo: (userId: string) =>
    call<{ name?: string; avatar?: string }>('grouphelper/chat/user-info', { userId }),
  /** 获取群成员列表 */
  getGuildMembers: (guildId: string) =>
    call<{ members: GuildMember[]; total: number }>('grouphelper/chat/guild-members', { guildId }),
  /** 撤回消息 */
  recall: (channelId: string, messageId: string, platform?: string) =>
    call<{ success: boolean }>('grouphelper/chat/recall', { channelId, messageId, platform }),
}

// 图片代理 API
export interface ImageProxyResult {
  success: boolean
  data?: {
    dataUrl?: string
    direct?: boolean
    source?: 'local' | 'proxy'
  }
  error?: string
}

export const imageApi = {
  /**
   * 获取图片（通过代理或本地缓存）
   * @param url 图片 URL
   * @param file 可选的文件标识（用于 OneBot get_image API）
   */
  fetch: async (url: string, file?: string): Promise<ImageProxyResult> => {
    try {
      // @ts-ignore - send 接受两个参数
      const result = await send('grouphelper/image/fetch', { url, file }) as ImageProxyResult
      return result
    } catch (e: any) {
      return { success: false, error: e.message || '图片加载失败' }
    }
  },
}

// 缓存管理 API
export interface CacheStats {
  guilds: number
  users: number
  members: number
  lastFullRefresh: number
  lastFullRefreshTime: string
}

export const cacheApi = {
  /** 获取缓存统计信息 */
  stats: () => call<CacheStats>('grouphelper/cache/stats'),
  /** 强制刷新所有缓存 */
  refresh: () => call<{ success: boolean; stats: CacheStats }>('grouphelper/cache/refresh'),
  /** 清空所有缓存 */
  clear: () => call<{ success: boolean }>('grouphelper/cache/clear'),
  /** 按需获取名称（会触发缓存） */
  fetchName: (type: 'guild' | 'user' | 'member', guildId?: string, userId?: string) =>
    call<{ name?: string; nick?: string; avatar?: string }>('grouphelper/cache/fetch-name', { type, guildId, userId }),
}

// 权限管理 API
export const authApi = {
  getRoles: () => call<Role[]>('grouphelper/auth/role/list'),
  updateRole: (role: Role) => call<{ success: boolean }>('grouphelper/auth/role/update', { role }),
  deleteRole: (roleId: string) => call<{ success: boolean }>('grouphelper/auth/role/delete', { roleId }),
  getUserRoles: (userId: string) => call<string[]>('grouphelper/auth/user/get', { userId }),
  getUserBindings: (userId: string) => call<UserRoleBinding[]>('grouphelper/auth/user/bindings', { userId }),
  assignRole: (userId: string, roleId: string, scope?: AuthScope, assignedBy?: string) =>
    call<{ success: boolean }>('grouphelper/auth/user/assign', { userId, roleId, scope, assignedBy }),
  revokeRole: (userId: string, roleId: string) => call<{ success: boolean }>('grouphelper/auth/user/revoke', { userId, roleId }),
  updateUserRoleScope: (userId: string, roleId: string, scope: AuthScope, updatedBy?: string) =>
    call<{ success: boolean }>('grouphelper/auth/user/scope-update', { userId, roleId, scope, updatedBy }),
  getPermissions: () => call<PermissionNode[]>('grouphelper/auth/permission/list'),
  getRoleMembers: (roleId: string, fetchNames?: boolean) => call<RoleMember[]>('grouphelper/auth/role/members', { roleId, fetchNames }),
  /** 批量导入成员到角色 */
  importMembers: (roleId: string, userIds: string[], scope?: AuthScope, assignedBy?: string) =>
    call<{ success: boolean; imported: number }>('grouphelper/auth/role/import-members', { roleId, userIds, scope, assignedBy }),
  /** 获取指定 authority 等级的用户列表 */
  getUsersByAuthority: (authority: number) => call<RoleMember[]>('grouphelper/auth/users-by-authority', { authority }),
  /** 获取指定群的管理员列表 */
  getGuildAdmins: (guildId: string) => call<RoleMember[]>('grouphelper/auth/guild-admins', { guildId }),
  /** 群组组管理 */
  getGuildGroups: () => call<GuildGroup[]>('grouphelper/auth/guild-group/list'),
  updateGuildGroup: (group: GuildGroup) => call<{ success: boolean }>('grouphelper/auth/guild-group/update', { group }),
  deleteGuildGroup: (groupId: string) => call<{ success: boolean }>('grouphelper/auth/guild-group/delete', { groupId }),
}

/** 上游信息 API（公告 / 版本 / 更新日志，均由后端代理并缓存） */
export const upstreamApi = {
  notice: () => call<{ notice: string }>('grouphelper/upstream/notice'),
  versions: () =>
    call<{ main: string | null; dev: string | null; npm: string | null }>('grouphelper/upstream/versions'),
  commits: () => call<{ commits: any[] }>('grouphelper/upstream/commits'),
}
