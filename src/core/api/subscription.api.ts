/**
 * 订阅 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'
import type { Subscription } from '../../types'

export function registerSubscriptionAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 订阅 API =====

  /** 获取订阅列表 */
  addListener('grouphelper/subscriptions/list', async (params?: { fetchNames?: boolean }) => {
    const subsData = data.subscriptions.get('list') || []
    
    if (params?.fetchNames) {
      // 开启解析：从缓存读取名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      const enrichedList = subsData.map((sub) => {
        let name = ''
        let avatar = ''
        if (sub.type === 'group') {
          const cached = cacheData.guilds[sub.id]
          name = cached?.name || ''
          avatar = cached?.avatar || `https://p.qlogo.cn/gh/${sub.id}/${sub.id}/640/`
        } else if (sub.type === 'private') {
          const cached = cacheData.users[sub.id]
          name = cached?.name || ''
          avatar = cached?.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${sub.id}&s=640`
        }
        return { ...sub, name, avatar }
      })
      return success(enrichedList)
    } else {
      // 关闭解析：不读取名称
      return success(subsData.map(sub => ({ ...sub, name: '', avatar: '' })))
    }
  })

  /** 添加订阅 */
  addListener('grouphelper/subscriptions/add', async (params: { subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    list.push(params.subscription)
    data.subscriptions.set('list', list)
    await data.subscriptions.flush()
    return success({ success: true })
  })

  // 订阅按 type+id 定位而非数组下标：前端持有的下标会因他人增删而失效，
  // 编辑弹窗开着的时候列表前面少一条，保存就会覆盖到另一条订阅上。
  const findSubscriptionIndex = (list: Subscription[], type: string, id: string) =>
    list.findIndex(sub => sub.type === type && sub.id === id)

  /** 移除订阅 */
  addListener('grouphelper/subscriptions/remove', async (params: { type: string, id: string }) => {
    const list = data.subscriptions.get('list') || []
    const index = findSubscriptionIndex(list, params.type, params.id)
    if (index < 0) return error('订阅不存在，可能已被删除')

    list.splice(index, 1)
    data.subscriptions.set('list', list)
    await data.subscriptions.flush()
    return success({ success: true })
  })

  /** 更新订阅 */
  addListener('grouphelper/subscriptions/update', async (params: { type: string, id: string, subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    const index = findSubscriptionIndex(list, params.type, params.id)
    if (index < 0) return error('订阅不存在，可能已被删除')

    list[index] = params.subscription
    data.subscriptions.set('list', list)
    await data.subscriptions.flush()
    return success({ success: true })
  })
}
