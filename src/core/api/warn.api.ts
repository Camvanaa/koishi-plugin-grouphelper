/**
 * 警告记录 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'

export function registerWarnAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 警告记录 API =====

  /** 重新加载警告数据 */
  addListener('grouphelper/warns/reload' as any, async () => {
    try {
      data.warns.reload()
      ctx.logger('grouphelper').info('警告数据已重新加载')
      return success({ success: true })
    } catch (e) {
      return error(e instanceof Error ? e.message : '重新加载失败')
    }
  })

  /** 获取所有警告记录 (Enriched) - 支持新格式 */
  addListener('grouphelper/warns/list', async (params?: { fetchNames?: boolean }) => {
    const allWarns = data.warns.getAll()
    const result: any[] = []

    if (params?.fetchNames) {
      // 开启解析：从缓存读取名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      
      for (const [guildId, guildWarns] of Object.entries(allWarns)) {
        if (!guildWarns || typeof guildWarns !== 'object') continue

        const guildCache = cacheData.guilds[guildId]
        const guildName = guildCache?.name || ''
        const guildAvatar = guildCache?.avatar || `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`

        // @ts-ignore
        for (const [userId, warnInfo] of Object.entries(guildWarns)) {
          if (!warnInfo || typeof warnInfo !== 'object' || !('count' in warnInfo)) continue
          const info = warnInfo as { count: number, timestamp: number }
          
          const memberKey = `${guildId}:${userId}`
          const memberCache = cacheData.members[memberKey]
          const userName = memberCache?.nick || memberCache?.name || ''
          const userAvatar = memberCache?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`

          result.push({
            key: memberKey,
            guildId,
            userId,
            guildName,
            guildAvatar,
            userName,
            userAvatar,
            count: info.count,
            timestamp: info.timestamp
          })
        }
      }
    } else {
      // 关闭解析：不读取名称
      for (const [guildId, guildWarns] of Object.entries(allWarns)) {
        if (!guildWarns || typeof guildWarns !== 'object') continue

        // @ts-ignore
        for (const [userId, warnInfo] of Object.entries(guildWarns)) {
          if (!warnInfo || typeof warnInfo !== 'object' || !('count' in warnInfo)) continue
          const info = warnInfo as { count: number, timestamp: number }

          result.push({
            key: `${guildId}:${userId}`,
            guildId,
            userId,
            guildName: '',
            guildAvatar: '',
            userName: '',
            userAvatar: '',
            count: info.count,
            timestamp: info.timestamp
          })
        }
      }
    }

    return success(result)
  })

  /** 更新警告次数 */
  addListener('grouphelper/warns/update', async (params: { key: string, count: number }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    
    const guildId = parts[0]
    const userId = parts[1]
    
    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        if (params.count <= 0) {
          // Count <= 0 means clear
          delete guildWarns[userId]
          if (Object.keys(guildWarns).length === 0) {
            data.warns.delete(guildId)
          } else {
            // @ts-ignore
            data.warns.set(guildId, guildWarns)
          }
        } else {
          guildWarns[userId].count = params.count
          guildWarns[userId].timestamp = Date.now() // 更新时间戳
          // @ts-ignore
          data.warns.set(guildId, guildWarns)
        }
        await data.warns.flush()
        return success({ success: true })
    }
    return error('Record not found')
  })

  /** 添加警告 */
  addListener('grouphelper/warns/add', async (params: { guildId: string, userId: string }) => {
    const guildWarns = data.warns.get(params.guildId) || {}
    
    if (!guildWarns[params.userId]) {
      guildWarns[params.userId] = { count: 0, timestamp: 0 }
    }
    
    guildWarns[params.userId].count++
    guildWarns[params.userId].timestamp = Date.now()
    
    // @ts-ignore
    data.warns.set(params.guildId, guildWarns)
    await data.warns.flush()
    return success({ success: true })
  })

  /** 获取用户警告记录 */
  addListener('grouphelper/warns/get', async (params: { key: string }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    const guildId = parts[0]
    const userId = parts[1]
    
    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        return success(guildWarns[userId])
    }
    return success(null)
  })

  /** 清除用户警告 */
  addListener('grouphelper/warns/clear', async (params: { key: string }) => {
    const parts = params.key.split(':')
    if (parts.length < 2) return error('Invalid key format')
    const guildId = parts[0]
    const userId = parts[1]

    const guildWarns = data.warns.get(guildId)
    if (guildWarns && guildWarns[userId]) {
        delete guildWarns[userId]
        if (Object.keys(guildWarns).length === 0) {
            data.warns.delete(guildId)
        } else {
            // @ts-ignore
            data.warns.set(guildId, guildWarns)
        }
        await data.warns.flush()
    }
    return success({ success: true })
  })
}
