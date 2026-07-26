/**
 * 缓存管理 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'

export function registerCacheAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 缓存管理 API =====

  /** 获取缓存统计信息 */
  addListener('grouphelper/cache/stats' as any, async () => {
    try {
      const stats = service.cache.getStats()
      return success(stats)
    } catch (e) {
      ctx.logger('grouphelper').error('获取缓存统计失败:', e)
      return error(e instanceof Error ? e.message : '获取缓存统计失败')
    }
  })

  /** 强制刷新缓存 */
  addListener('grouphelper/cache/refresh' as any, async () => {
    try {
      ctx.logger('grouphelper').info('开始刷新缓存...')
      await service.cache.refreshAll()
      ctx.logger('grouphelper').info('缓存刷新完成')
      return success({ success: true, stats: service.cache.getStats() })
    } catch (e) {
      ctx.logger('grouphelper').error('刷新缓存失败:', e)
      return error(e instanceof Error ? e.message : '刷新缓存失败')
    }
  })

  /** 清空缓存 */
  addListener('grouphelper/cache/clear' as any, async () => {
    try {
      await service.cache.clearAll()
      ctx.logger('grouphelper').info('缓存已清空')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('清空缓存失败:', e)
      return error(e instanceof Error ? e.message : '清空缓存失败')
    }
  })

  /** 按需获取单个名称（会触发缓存） */
  addListener('grouphelper/cache/fetch-name' as any, async (params: {
    type: 'guild' | 'user' | 'member'
    guildId?: string
    userId?: string
  }) => {
    try {
      const { type, guildId, userId } = params
      
      if (type === 'guild' && guildId) {
        const info = await service.cache.getGuildInfo(guildId)
        return success({ name: info?.name || '', avatar: info?.avatar })
      } else if (type === 'user' && userId) {
        const info = await service.cache.getUserInfo(userId)
        return success({ name: info?.name || '', avatar: info?.avatar })
      } else if (type === 'member' && guildId && userId) {
        const info = await service.cache.getMemberInfo(guildId, userId)
        return success({
          name: info?.name || '',
          nick: info?.nick || '',
          avatar: info?.avatar
        })
      }
      
      return error('无效的参数')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取名称失败')
    }
  })
}
