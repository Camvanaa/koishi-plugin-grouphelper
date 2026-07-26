import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  type?: 'normal' | 'danger'
}

interface ConfirmState extends Required<ConfirmOptions> {
  show: boolean
  resolve: (ok: boolean) => void
}

/**
 * Promise 化的确认弹窗状态。
 *
 * 此前 RolesView 与 SettingsView 各写了一份逐行相同的实现，
 * 而 WarnsView / BlacklistView 干脆没有确认就直接执行破坏性操作。
 *
 * 用法：
 *   const { confirmState, showConfirm, acceptConfirm, cancelConfirm } = useConfirm()
 *   if (await showConfirm({ message: '确定删除？', type: 'danger' })) { ... }
 * 模板里配合 <ConfirmDialog :state="confirmState" @accept="acceptConfirm" @cancel="cancelConfirm" />
 */
export function useConfirm() {
  const confirmState = ref<ConfirmState>({
    show: false,
    title: '确认',
    message: '',
    type: 'normal',
    resolve: () => {}
  })

  const showConfirm = (options: ConfirmOptions): Promise<boolean> =>
    new Promise<boolean>(resolve => {
      confirmState.value = {
        show: true,
        title: options.title || '确认',
        message: options.message,
        type: options.type || 'normal',
        resolve
      }
    })

  const settle = (ok: boolean) => {
    if (!confirmState.value.show) return
    confirmState.value.show = false
    confirmState.value.resolve(ok)
  }

  return {
    confirmState,
    showConfirm,
    acceptConfirm: () => settle(true),
    cancelConfirm: () => settle(false)
  }
}
