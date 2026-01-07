import { Context, icons } from '@koishijs/client'

import Index from './pages/index.vue'
import GroupIcon from './icons/group.vue'

// 注册自定义图标
icons.register('grouphelper', GroupIcon)

export default (ctx: Context) => {
  ctx.page({
    name: '群管助手',
    path: '/grouphelper',
    icon: 'grouphelper',
    component: Index,
    order: 400,
  })
}