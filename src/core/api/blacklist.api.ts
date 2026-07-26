/**
 * 黑名单 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success } from './api-utils'

export function registerBlacklistAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 黑名单 API =====

  /** 获取黑名单 */
  addListener('grouphelper/blacklist/list', async () => {
    return success(data.blacklist.getAll())
  })

  /** 添加黑名单 */
  addListener('grouphelper/blacklist/add', async (params: { userId: string, record: any }) => {
    data.blacklist.set(params.userId, params.record)
    await data.blacklist.flush()
    return success({ success: true })
  })

  /** 移除黑名单 */
  addListener('grouphelper/blacklist/remove', async (params: { userId: string }) => {
    data.blacklist.delete(params.userId)
    await data.blacklist.flush()
    return success({ success: true })
  })
}
