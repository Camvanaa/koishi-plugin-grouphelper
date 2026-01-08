/**
 * 类型扩展声明
 * 扩展 Koishi 框架和 Console 插件的类型
 */

import { Subscription, GroupConfig, WarnRecord, BlacklistRecord } from './types'
import { Context } from 'koishi'
import { Puppeteer } from 'koishi-plugin-puppeteer'
import { Status } from '@koishijs/plugin-status'

declare module 'koishi' {
  interface Context {
    puppeteer: Puppeteer
    status: Status
  }
}

/** API 响应格式 */
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

declare module '@koishijs/plugin-console' {
  interface Events {
    // 群组配置 API
    'grouphelper/config/list'(params?: { fetchNames?: boolean }): Promise<ApiResponse<Record<string, GroupConfig>>>
    'grouphelper/config/get'(params: { guildId: string }): Promise<ApiResponse<GroupConfig | undefined>>
    'grouphelper/config/update'(params: { guildId: string, config: GroupConfig }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/config/create'(params: { guildId: string }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/config/delete'(params: { guildId: string }): Promise<ApiResponse<{ success: boolean }>>

    // 警告记录 API
    'grouphelper/warns/list'(params?: { fetchNames?: boolean }): Promise<ApiResponse<any[]>>
    'grouphelper/warns/get'(params: { key: string }): Promise<ApiResponse<WarnRecord | undefined>>
    'grouphelper/warns/update'(params: { key: string, count: number }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/warns/add'(params: { guildId: string, userId: string }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/warns/clear'(params: { key: string }): Promise<ApiResponse<{ success: boolean }>>

    // 黑名单 API
    'grouphelper/blacklist/list'(): Promise<ApiResponse<Record<string, BlacklistRecord>>>
    'grouphelper/blacklist/add'(params: { userId: string, record: BlacklistRecord }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/blacklist/remove'(params: { userId: string }): Promise<ApiResponse<{ success: boolean }>>

    // 订阅 API
    'grouphelper/subscriptions/list'(): Promise<ApiResponse<Subscription[]>>
    'grouphelper/subscriptions/add'(params: { subscription: Subscription }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/subscriptions/remove'(params: { index: number }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/subscriptions/update'(params: { index: number, subscription: Subscription }): Promise<ApiResponse<{ success: boolean }>>

    // 统计 API
    'grouphelper/stats/dashboard'(): Promise<ApiResponse<{
      totalGroups: number
      totalWarns: number
      totalBlacklisted: number
      totalSubscriptions: number
      timestamp: number
    }>>

    // 日志 API
    'grouphelper/logs/search'(params: {
      startTime?: string | number
      endTime?: string | number
      command?: string
      userId?: string
      username?: string
      details?: string
      guildId?: string
      page?: number
      pageSize?: number
    }): Promise<ApiResponse<{
      list: any[]
      total: number
      page: number
      pageSize: number
    }>>

    // 设置 API
    'grouphelper/settings/get'(): Promise<ApiResponse<any>>
    'grouphelper/settings/update'(params: { settings: any }): Promise<ApiResponse<{ success: boolean }>>
    'grouphelper/settings/reset'(): Promise<ApiResponse<{ success: boolean }>>
  }
}