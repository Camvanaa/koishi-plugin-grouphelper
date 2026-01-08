/**
 * WebUI API 客户端封装
 * 提供类型安全的 API 调用方法
 */

import { send } from '@koishijs/client'
import type { GroupConfig, WarnRecord, BlacklistRecord, Subscription, Role, PermissionNode, RoleMember } from './types'

// 重新导出类型
export type { GroupConfig, WarnRecord, BlacklistRecord, Subscription, Role, PermissionNode, RoleMember }

// 仪表盘统计数据类型
export interface DashboardStats {
  totalGroups: number
  totalWarns: number
  totalBlacklisted: number
  totalSubscriptions: number
  timestamp: number
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 通用调用封装
async function call<T>(event: keyof any, params?: any): Promise<T> {
  // @ts-ignore
  const result = await send(event, params) as ApiResponse<T>
  if (!result.success) {
    throw new Error(result.error || '请求失败')
  }
  // @ts-ignore
  return result.data
}

// 群组配置 API
export const configApi = {
  list: (fetchNames?: boolean) => call<Record<string, GroupConfig>>('grouphelper/config/list', { fetchNames }),
  get: (guildId: string) => call<GroupConfig | undefined>('grouphelper/config/get', { guildId }),
  update: (guildId: string, config: GroupConfig) => call<{ success: boolean }>('grouphelper/config/update', { guildId, config }),
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
  remove: (index: number) => call<{ success: boolean }>('grouphelper/subscriptions/remove', { index }),
  update: (index: number, subscription: Subscription) => call<{ success: boolean }>('grouphelper/subscriptions/update', { index, subscription }),
}

// 统计 API
export const statsApi = {
  dashboard: () => call<DashboardStats>('grouphelper/stats/dashboard'),
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
  assignRole: (userId: string, roleId: string) => call<{ success: boolean }>('grouphelper/auth/user/assign', { userId, roleId }),
  revokeRole: (userId: string, roleId: string) => call<{ success: boolean }>('grouphelper/auth/user/revoke', { userId, roleId }),
  getPermissions: () => call<PermissionNode[]>('grouphelper/auth/permission/list'),
  getRoleMembers: (roleId: string, fetchNames?: boolean) => call<RoleMember[]>('grouphelper/auth/role/members', { roleId, fetchNames }),
}