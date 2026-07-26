/**
 * WebSocket API 模块
 *
 * 只负责装配：构造受权限保护的注册器，再把各域的注册函数依次接上。
 * 端点实现按域拆分在同目录的 *.api.ts 中。
 */

import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import { createListenerRegistrar } from './api-utils'

import { registerConfigAPI } from './config.api'
import { registerAuthAPI } from './auth.api'
import { registerWarnAPI } from './warn.api'
import { registerBlacklistAPI } from './blacklist.api'
import { registerSubscriptionAPI } from './subscription.api'
import { registerStatsAPI } from './stats.api'
import { registerLogsAPI } from './logs.api'
import { registerSettingsAPI } from './settings.api'
import { registerCacheAPI } from './cache.api'
import { registerChatAPI } from './chat.api'
import { registerUpstreamAPI } from './upstream.api'

export type { ApiResponse } from './api-utils'

/**
 * 注册所有 WebSocket API
 */
export function registerWebSocketAPI(ctx: Context, service: GroupHelperService) {
  // 确保 console 服务存在
  if (!ctx.console) {
    ctx.logger('grouphelper').warn('console 服务未启用，WebSocket API 跳过注册')
    return
  }

  const addListener = createListenerRegistrar(ctx)

  registerConfigAPI(ctx, service, addListener)
  registerAuthAPI(ctx, service, addListener)
  registerWarnAPI(ctx, service, addListener)
  registerBlacklistAPI(ctx, service, addListener)
  registerSubscriptionAPI(ctx, service, addListener)
  registerStatsAPI(ctx, service, addListener)
  registerLogsAPI(ctx, service, addListener)
  registerSettingsAPI(ctx, service, addListener)
  registerCacheAPI(ctx, service, addListener)
  registerChatAPI(ctx, service, addListener)
  registerUpstreamAPI(ctx, service, addListener)
}
