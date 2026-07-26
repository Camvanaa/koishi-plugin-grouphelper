/**
 * 前端共用的格式化工具。
 *
 * 时间格式化此前在 Blacklist / Warns / Logs / Dashboard / Chat 五个视图各写一份，
 * 对空值的处理还不一致（有的返回「未知」、有的直接渲染 Invalid Date）。
 */

/** 完整日期时间，空值返回「未知」 */
export function formatTime(timestamp: string | number | undefined | null): string {
  if (timestamp === undefined || timestamp === null || timestamp === '') return '未知'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN')
}

/**
 * 列表用的相对简短时间：今天只显示时分，今年显示月日，跨年显示年月日。
 */
export function formatTimeShort(timestamp: string | number | undefined | null): string {
  if (timestamp === undefined || timestamp === null || timestamp === '') return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN')
}

/** 消息详情用的时分秒 */
export function formatTimeDetail(timestamp: string | number | undefined | null): string {
  if (timestamp === undefined || timestamp === null || timestamp === '') return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 复制文本到剪贴板。
 *
 * 非 HTTPS 环境下 navigator.clipboard 不可用，降级到 execCommand，
 * 两者都失败时抛出，由调用方给出明确提示——不能让用户以为已复制。
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // 落到下面的降级方案
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    if (!document.execCommand('copy')) throw new Error('execCommand 返回 false')
  } finally {
    document.body.removeChild(textarea)
  }
}
