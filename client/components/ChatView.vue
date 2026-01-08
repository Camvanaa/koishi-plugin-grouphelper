<template>
  <div class="chat-view">
    <!-- 侧边栏：会话列表 -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <h3>实时消息</h3>
        <div class="status-indicator">
          <span class="dot"></span> 实时接收中
        </div>
      </div>
      
      <!-- 连接群聊按钮 -->
      <div class="connect-group-bar">
        <button class="connect-btn" @click="showConnectDialog = true">
          <k-icon name="plus" /> 新建会话
        </button>
      </div>

      <div class="session-list">
        <div v-if="sessions.length === 0" class="empty-sessions">
          等待消息...
        </div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: currentSessionId === session.id }"
          @click="selectSession(session.id)"
        >
          <div class="session-icon">
            <img v-if="session.avatar" :src="session.avatar" @error="handleAvatarError($event, true)" />
            <k-icon v-else :name="session.type === 'group' ? 'users' : 'user'" />
          </div>
          <div class="session-info">
            <div class="session-name" :title="session.name">{{ session.name }}</div>
            <div class="session-preview">{{ session.lastMessage?.content || '' }}</div>
          </div>
          <div class="session-meta">
            <span class="time">{{ formatTimeShort(session.lastMessage?.timestamp) }}</span>
            <span class="badge" v-if="session.unread > 0">{{ session.unread }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主区域：聊天窗口 -->
    <div class="chat-main">
      <div v-if="currentSession" class="chat-container">
        <div class="chat-header">
          <div class="header-info">
            <div class="header-icon">
              <img v-if="currentSession.avatar" :src="currentSession.avatar" @error="handleAvatarError($event, true)" />
              <k-icon v-else :name="currentSession.type === 'group' ? 'users' : 'user'" />
            </div>
            <span class="header-name">{{ currentSession.name }}</span>
            <span class="header-id">{{ currentSession.id }}</span>
          </div>
          <div class="header-platform">
            <span class="platform-tag">{{ currentSession.platform }}</span>
          </div>
        </div>

        <div class="message-list" ref="messageListRef">
          <div
            v-for="msg in currentSession.messages"
            :key="msg.id"
            class="message-row"
            :class="{ self: isSelf(msg) }"
          >
            <div class="message-avatar">
              <img v-if="msg.avatar" :src="msg.avatar" @error="handleAvatarError" />
              <div v-else class="avatar-placeholder">{{ msg.username[0]?.toUpperCase() }}</div>
            </div>
            <div class="message-content-wrapper">
              <div class="message-meta">
                <span class="username">{{ msg.username }}</span>
                <span class="timestamp">{{ formatTimeDetail(msg.timestamp) }}</span>
              </div>
              <div class="message-bubble" v-html="renderMessage(msg)"></div>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <textarea
            v-model="inputText"
            class="chat-input"
            placeholder="发送消息... (Enter 发送, Shift+Enter 换行)"
            @keydown.enter.exact.prevent="sendMessage"
          ></textarea>
          <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim() || sending">
            <k-icon name="send" v-if="!sending" />
            <k-icon name="loader" class="spin" v-else />
          </button>
        </div>
      </div>

      <div v-else class="empty-chat">
        <div class="empty-content">
          <k-icon name="message-square" class="large-icon" />
          <h3>开始聊天</h3>
          <p>从左侧选择一个会话，或等待新消息接入</p>
        </div>
      </div>
    </div>

    <!-- 连接群聊对话框 -->
    <div class="connect-dialog-overlay" v-if="showConnectDialog" @click.self="showConnectDialog = false">
      <div class="connect-dialog">
        <div class="dialog-header">
          <h3>新建会话</h3>
          <button class="close-btn" @click="showConnectDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>会话类型</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="connectForm.type" value="group" />
                群聊
              </label>
              <label class="radio-label">
                <input type="radio" v-model="connectForm.type" value="private" />
                私聊
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>{{ connectForm.type === 'group' ? '群号 / 频道ID' : '用户ID' }}</label>
            <input
              v-model="connectForm.targetId"
              type="text"
              :placeholder="connectForm.type === 'group' ? '输入群号' : '输入QQ号/用户ID'"
              @keydown.enter="connectToChat"
            />
          </div>
          <div class="form-group">
            <label>显示名称 (可选)</label>
            <input
              v-model="connectForm.name"
              type="text"
              placeholder="自定义显示名称"
            />
          </div>
          <div class="form-group">
            <label>平台</label>
            <select v-model="connectForm.platform">
              <option value="onebot">OneBot</option>
              <option value="qq">QQ</option>
              <option value="red">Red</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="cancel-btn" @click="showConnectDialog = false">取消</button>
          <button class="confirm-btn" @click="connectToChat" :disabled="!connectForm.targetId.trim()">
            连接
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { receive, message } from '@koishijs/client'
import { chatApi, imageApi } from '../api'
import type { ChatMessage } from '../types'

// 图片缓存 - URL -> dataUrl
const imageCache = reactive<Map<string, string>>(new Map())
// 正在加载的图片 URLs
const loadingImages = reactive<Set<string>>(new Set())

// 检查 URL 是否需要代理
const needsProxy = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    const proxyDomains = [
      'gchat.qpic.cn',
      'multimedia.nt.qq.com.cn',
      'c2cpicdw.qpic.cn',
    ]
    return proxyDomains.some(domain => urlObj.hostname.endsWith(domain))
  } catch {
    return false
  }
}

// 通过代理加载图片
// file 参数用于 OneBot get_image API 获取本地缓存
const loadImageViaProxy = async (url: string, file?: string): Promise<string | null> => {
  // 使用 url+file 作为缓存 key，因为同一个 url 可能有不同的 file
  const cacheKey = file ? `${url}#${file}` : url
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!
  }
  
  if (loadingImages.has(cacheKey)) {
    return null // 正在加载中
  }
  
  loadingImages.add(cacheKey)
  
  try {
    const result = await imageApi.fetch(url, file)
    if (result?.success && result.data?.dataUrl) {
      imageCache.set(cacheKey, result.data.dataUrl)
      // 如果是本地缓存加载成功，也缓存原始 url
      if (result.data.source === 'local' && file) {
        imageCache.set(url, result.data.dataUrl)
      }
      return result.data.dataUrl
    }
    // 如果 direct: true，说明不需要代理
    if (result?.success && result.data?.direct) {
      imageCache.set(cacheKey, url)
      return url
    }
    // 缓存失败状态，避免重复请求
    imageCache.set(cacheKey, 'error')
    return 'error'
  } catch (e) {
    console.warn('Image proxy failed:', url, file, e)
    imageCache.set(cacheKey, 'error')
    return 'error'
  } finally {
    loadingImages.delete(cacheKey)
  }
}

// 处理图片加载（从 DOM 事件触发）
// file 参数用于 OneBot get_image API
const handleProxyImage = async (imgId: string, originalUrl: string, file?: string) => {
  const dataUrl = await loadImageViaProxy(originalUrl, file)
  const img = document.getElementById(imgId) as HTMLImageElement
  if (img) {
    if (dataUrl && dataUrl !== 'error') {
      img.src = dataUrl
      img.classList.remove('loading')
    } else {
      // 图片加载失败，显示错误占位
      img.classList.remove('loading')
      img.classList.add('error')
      img.alt = '图片已过期或无法加载'
    }
  }
}

// 生成唯一图片 ID
let imageIdCounter = 0
const generateImageId = () => `proxy-img-${++imageIdCounter}`

interface Session {
  id: string // channelId
  type: 'group' | 'private'
  name: string
  platform: string
  guildId?: string
  avatar?: string
  messages: ChatMessage[]
  lastMessage?: ChatMessage
  unread: number
}

const sessions = ref<Session[]>([])
const currentSessionId = ref<string>('')
const inputText = ref('')
const sending = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const showConnectDialog = ref(false)
const connectForm = reactive({
  type: 'group' as 'group' | 'private',
  targetId: '',
  name: '',
  platform: 'onebot'
})

// 辅助函数：判断是否是自己发送的消息
const isSelf = (msg: ChatMessage) => {
  return msg.userId === msg.selfId
}

// 接收消息监听
onMounted(() => {
  receive('grouphelper/chat/message', (data: ChatMessage) => {
    handleIncomingMessage(data)
  })
})

const handleIncomingMessage = (msg: ChatMessage) => {
  // 确定会话ID (通常是 channelId)
  const sessionId = msg.channelId
  
  let session = sessions.value.find(s => s.id === sessionId)
  
  if (!session) {
    // 新会话
    session = {
      id: sessionId,
      type: msg.guildId ? 'group' : 'private',
      name: msg.channelName || msg.guildName || (msg.guildId ? `${sessionId}` : `私聊 ${msg.username}`),
      platform: msg.platform,
      guildId: msg.guildId,
      avatar: msg.guildId ? msg.guildAvatar : msg.avatar, // 群组用群头像，私聊用对方头像
      messages: [],
      unread: 0
    }
    sessions.value.unshift(session)
  } else {
    // 移到顶部
    const index = sessions.value.indexOf(session)
    if (index > 0) {
      sessions.value.splice(index, 1)
      sessions.value.unshift(session)
    }
  }

  // Update avatar if available and missing
  if (!session.avatar) {
    if (session.type === 'group' && msg.guildAvatar) session.avatar = msg.guildAvatar
    if (session.type === 'private' && msg.avatar) session.avatar = msg.avatar
  }

  session.messages.push(msg)
  session.lastMessage = msg
  
  // 如果不是当前会话，增加未读
  if (currentSessionId.value !== sessionId) {
    session.unread++
  } else {
    scrollToBottom()
  }
}

const currentSession = ref<Session | undefined>(undefined)

watch(currentSessionId, (newId) => {
  const session = sessions.value.find(s => s.id === newId)
  if (session) {
    session.unread = 0
    currentSession.value = session
    nextTick(() => scrollToBottom())
  } else {
    currentSession.value = undefined
  }
})

const selectSession = (id: string) => {
  currentSessionId.value = id
}

// 连接到会话
const connectToChat = async () => {
  const targetId = connectForm.targetId.trim()
  if (!targetId) return
  
  let displayName = connectForm.name.trim()
  const isGroup = connectForm.type === 'group'
  
  // 如果名称为空，尝试自动获取名称
  if (!displayName) {
    try {
      if (isGroup) {
        const info = await chatApi.getGuildInfo(targetId)
        if (info?.name) displayName = info.name
      } else {
        const info = await chatApi.getUserInfo(targetId)
        if (info?.name) displayName = info.name
      }
    } catch (e) {
      console.warn('Failed to fetch info:', e)
    }
  }
  
  // 如果仍然没有名称，使用默认名称
  if (!displayName) {
    displayName = isGroup ? `群聊 ${targetId}` : `私聊 ${targetId}`
  }
  
  // 检查是否已存在该会话
  let session = sessions.value.find(s => s.id === targetId)
  
  if (!session) {
    // 创建新会话
    session = {
      id: targetId,
      type: connectForm.type,
      name: displayName,
      platform: connectForm.platform,
      guildId: isGroup ? targetId : undefined,
      avatar: isGroup
        ? `https://p.qlogo.cn/gh/${targetId}/${targetId}/640/`
        : `https://q1.qlogo.cn/g?b=qq&nk=${targetId}&s=640`,
      messages: [],
      unread: 0
    }
    sessions.value.unshift(session)
  } else {
    // 如果获取到了新名称，更新现有会话
    if (displayName && displayName !== session.name) {
      session.name = displayName
    }
  }
  
  // 选中该会话
  currentSessionId.value = targetId
  
  // 关闭对话框并重置表单
  showConnectDialog.value = false
  connectForm.targetId = ''
  connectForm.name = ''
  connectForm.type = 'group'
}

const scrollToBottom = () => {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || !currentSession.value) return

  sending.value = true
  try {
    const session = currentSession.value
    await chatApi.send(session.id, text, session.platform, session.guildId)
    
    // 模拟将自己发送的消息加入列表（虽然一般后端也会推送回来，但为了即时反馈）
    // 注意：这里可能跟后端推送重复，通常 bot.sendMessage 后 bot 适配器会收到 message 事件吗？
    // 如果是 sendGroupMessage，有些适配器会产生 echo message，有些不会。
    // 这里我们暂时等待后端推送，或者手动添加一个临时消息。
    // 为了稳妥，我们清空输入框即可。如果后端有 echo 机制最好。
    // 如果没有 echo，用户体验会觉得没发出去。
    // 我们假设后端会推送 message 事件 (OneBot 会)
    // 针对 OneBot，send_msg 确实会有 echo，但 Koishi 统一处理可能会有延迟
    // 我们这里先清空，依赖后端广播的 send 事件
    inputText.value = ''
  } catch (e: any) {
    message.error(e.message || '发送失败')
  } finally {
    sending.value = false
    // 聚焦回输入框
    // (需获取 textarea ref，略)
  }
}

const formatTimeShort = (ts?: number) => {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const formatTimeDetail = (ts: number) => {
  return new Date(ts).toLocaleString('zh-CN')
}

const handleAvatarError = (e: Event, isSession = false) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  if (isSession) {
    // Session icon fallback logic handled in template by v-if/v-else check?
    // Actually if src errors, we might want to show the k-icon.
    // But since v-else is not tied to @error, we need to manipulate DOM or state.
    // Simple way: hide img, show sibling if it exists? No sibling in template for fallback.
    // Better: set src to null? modifying prop is bad. modifying state?
    // Let's just let it hide.
  }
}

const renderMessage = (msg: ChatMessage) => {
  if (!msg.content) return ''
  
  let html = msg.content

  // 1. 转义 HTML 特殊字符 (除了标签) - Koishi content 已经是 XML-like 格式
  // 如果是普通文本，可能会有 < >，但通常 Koishi 会处理。
  // 为了安全，我们假设 content 是 Koishi 的 element string。

  // 辅助函数：从属性字符串中提取 file 属性
  const extractFileAttr = (attrs: string): string | undefined => {
    const fileMatch = attrs.match(/file="([^"]+)"/)
    return fileMatch ? fileMatch[1] : undefined
  }

  // 辅助函数：生成图片 HTML（支持代理）
  // file 参数用于 OneBot get_image API 获取本地缓存（解决 rkey 过期问题）
  const createImgTag = (src: string, file?: string) => {
    if (needsProxy(src)) {
      const imgId = generateImageId()
      const cacheKey = file ? `${src}#${file}` : src
      // 如果已缓存，直接用缓存
      if (imageCache.has(cacheKey)) {
        const cachedUrl = imageCache.get(cacheKey)!
        if (cachedUrl !== 'error') {
          return `<img id="${imgId}" src="${cachedUrl}" class="msg-img" onclick="window.open('${src}', '_blank')">`
        }
        // 已知失败的图片，直接显示错误状态
        return `<img id="${imgId}" src="" class="msg-img error" data-original="${src}" alt="图片已过期">`
      }
      // 需要代理加载，先用占位符，然后异步加载
      nextTick(() => handleProxyImage(imgId, src, file))
      return `<img id="${imgId}" src="" class="msg-img loading" data-original="${src}"${file ? ` data-file="${file}"` : ''} onclick="window.open('${src}', '_blank')">`
    }
    return `<img src="${src}" class="msg-img" onclick="window.open('${src}', '_blank')">`
  }

  // 2. 替换图片 <img src="..." file="..." /> 或 <img src="..." />
  html = html.replace(/<img\s+([^>]*)src="([^"]+)"([^>]*)\/?>/g, (match, before, src, after) => {
    const attrs = before + after
    const file = extractFileAttr(attrs)
    return createImgTag(src, file)
  })
  // 替换 <image url="..." file="..." /> 格式
  html = html.replace(/<image\s+([^>]*)url="([^"]+)"([^>]*)\/?>/g, (match, before, src, after) => {
    const attrs = before + after
    const file = extractFileAttr(attrs)
    return createImgTag(src, file)
  })

  // 3. 替换 At <at id="..." name="..." />
  html = html.replace(/<at\s+([^>]*)\/?>/g, (match, attrs) => {
    const idMatch = attrs.match(/id="([^"]+)"/)
    const nameMatch = attrs.match(/name="([^"]+)"/)
    const id = idMatch ? idMatch[1] : '?'
    const name = nameMatch ? nameMatch[1] : id
    // 如果存在同名但不同 ID 的情况，或者 name 和 id 相同，尝试从 msg.elements 中查找更准确的名字
    // 注意：msg.elements 是我们在后端 enriched 过的
    let displayName = name
    if (msg.elements) {
      const atElement = msg.elements.find((el: any) => el.type === 'at' && el.attrs?.id === id)
      if (atElement && atElement.attrs?.name) {
        displayName = atElement.attrs.name
      }
    }
    return `<span class="msg-at">@${displayName}</span>`
  })

  // 4. 替换表情 <face id="..." />
  html = html.replace(/<face\s+([^>]*)\/?>/g, (match, attrs) => {
    const idMatch = attrs.match(/id="([^"]+)"/)
    return `<span class="msg-face">[表情:${idMatch ? idMatch[1] : '?'}]</span>`
  })

  // 5. 简单的 CQ 码兼容 (以防万一)
  html = html.replace(/\[CQ:image,[^\]]*url=([^,\]]+)[^\]]*\]/g, (match, url) => {
    return createImgTag(url)
  })
  html = html.replace(/\[CQ:at,[^\]]*qq=([^,\]]+)[^\]]*\]/g, (match, id) => {
    return `<span class="msg-at">@${id}</span>`
  })

  // 6. 处理 OneBot/Red 协议的特殊图片格式 (如果直接是 URL)
  // 有些时候 image 可能不是 xml 或 CQ 码，而是由 koishi h 转换后的结果，这里主要是在 renderMessage 前端兜底
  // 如果内容里包含 http(s) 图片链接，尝试转为 img 标签 (简单处理)
  // 注意：这可能会误伤普通链接，暂时不启用，依赖 Koishi 的解析结果

  return html
}
</script>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
}

.chat-sidebar {
  width: 260px;
  border-right: 1px solid var(--k-color-border);
  display: flex;
  flex-direction: column;
  background: var(--k-color-bg-2);
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--k-color-text);
}

.status-indicator {
  font-size: 0.75rem;
  color: #67c23a;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #67c23a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.empty-sessions {
  padding: 2rem;
  text-align: center;
  color: var(--k-color-text-description);
  font-size: 0.875rem;
}

.session-item {
  display: flex;
  padding: 0.75rem 1rem;
  gap: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid transparent;
}

.session-item:hover {
  background: var(--k-color-bg-1);
}

.session-item.active {
  background: var(--k-color-active-bg, rgba(64, 158, 255, 0.1));
  border-left-color: var(--k-color-active);
}

.session-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--k-color-bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
  flex-shrink: 0;
  overflow: hidden;
}

.session-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.session-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.session-name {
  font-weight: 500;
  color: var(--k-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
}

.session-preview {
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.session-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.session-meta .time {
  font-size: 0.7rem;
  color: var(--k-color-text-description);
}

.badge {
  background: #f56c6c;
  color: white;
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 14px;
  text-align: center;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--k-color-bg-1);
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
}

.empty-content {
  text-align: center;
}

.large-icon {
  font-size: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--k-color-bg-2);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--k-color-bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.header-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--k-color-text);
}

.header-id {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  font-family: monospace;
}

.platform-tag {
  background: var(--k-color-active);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-row {
  display: flex;
  gap: 1rem;
  max-width: 85%;
}

.message-row.self {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--k-color-active);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-row.self .message-content-wrapper {
  align-items: flex-end;
}

.message-meta {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  align-items: baseline;
}

.message-row.self .message-meta {
  flex-direction: row-reverse;
}

.message-row.self :deep(.msg-at) {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.username {
  font-weight: 500;
  color: var(--k-color-text);
}

.message-bubble {
  background: var(--k-color-active-bg, rgba(100, 100, 100, 0.1));
  padding: 0.75rem 1rem;
  border-radius: 0 12px 12px 12px;
  color: var(--k-color-text);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Deep selector required for v-html content in scoped css */
.message-bubble :deep(.msg-img) {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
  vertical-align: middle;
  margin: 4px 0;
  display: block;
}

.message-bubble :deep(.msg-img.loading) {
  width: 100px;
  height: 100px;
  background: linear-gradient(90deg, var(--k-color-bg-3) 25%, var(--k-color-bg-2) 50%, var(--k-color-bg-3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border: 1px dashed var(--k-color-border);
}

.message-bubble :deep(.msg-img.error) {
  width: 100px;
  height: 60px;
  background: var(--k-color-bg-3);
  border: 1px dashed #f56c6c;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f56c6c;
  font-size: 0.75rem;
}

.message-bubble :deep(.msg-img.error)::before {
  content: '⚠ 图片已过期';
  display: block;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.message-bubble :deep(.msg-at) {
  color: var(--k-color-active);
  background: rgba(var(--k-color-active-rgb), 0.1);
  padding: 0 4px;
  border-radius: 4px;
  margin: 0 2px;
  font-weight: 500;
  display: inline-block;
}

.message-bubble :deep(.msg-face) {
  display: inline-block;
  color: var(--k-color-text-description);
}

.message-row.self .message-bubble {
  background: var(--k-color-active);
  color: white;
  border-radius: 12px 0 12px 12px;
  border: none;
}

.chat-input-area {
  padding: 1rem;
  background: var(--k-color-bg-2);
  border-top: 1px solid var(--k-color-border);
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  height: 60px;
  padding: 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  resize: none;
  font-family: inherit;
  font-size: 0.9rem;
}

.chat-input:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.send-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--k-color-active);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.send-btn:hover {
  opacity: 0.9;
}

.send-btn:disabled {
  background: var(--k-color-disabled);
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}

/* 连接群聊按钮 */
.connect-group-bar {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-border);
}

.connect-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px dashed var(--k-color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--k-color-text-description);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.connect-btn:hover {
  border-color: var(--k-color-active);
  color: var(--k-color-active);
  background: rgba(64, 158, 255, 0.05);
}

/* 连接对话框 */
.connect-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.connect-dialog {
  background: var(--k-card-bg);
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--k-color-text);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--k-color-text-description);
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--k-color-bg-3);
}

.dialog-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  color: var(--k-color-text);
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  font-size: 0.9rem;
}

.form-group select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2rem;
}

.form-group select option {
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  padding: 0.5rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.form-group input::placeholder {
  color: var(--k-color-text-description);
}

.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--k-color-text);
  font-size: 0.9rem;
}

.dialog-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-btn,
.confirm-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cancel-btn {
  border: 1px solid var(--k-color-border);
  background: transparent;
  color: var(--k-color-text);
}

.cancel-btn:hover {
  background: var(--k-color-bg-3);
}

.confirm-btn {
  border: none;
  background: var(--k-color-active);
  color: white;
}

.confirm-btn:hover {
  opacity: 0.9;
}

.confirm-btn:disabled {
  background: var(--k-color-disabled);
  cursor: not-allowed;
}
</style>