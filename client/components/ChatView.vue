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
            @contextmenu.prevent="showContextMenu($event, msg)"
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
          <!-- 待发送图片预览 -->
          <div class="pending-images" v-if="pendingImages.length > 0">
            <div
              v-for="(img, index) in pendingImages"
              :key="index"
              class="pending-image-item"
            >
              <img :src="img.dataUrl" />
              <button class="remove-image-btn" @click="removePendingImage(index)">×</button>
            </div>
          </div>
          <div class="input-row">
            <textarea
              ref="inputRef"
              v-model="inputText"
              class="chat-input"
              placeholder="发送消息... (Enter 发送, Shift+Enter 换行, 可粘贴图片)"
              @keydown.enter.exact.prevent="sendMessage"
              @paste="handlePaste"
            ></textarea>
            <button class="send-btn" @click="sendMessage" :disabled="(!inputText.trim() && pendingImages.length === 0) || sending">
              <k-icon name="send" v-if="!sending" />
              <k-icon name="loader" class="spin" v-else />
            </button>
          </div>
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

    <!-- 右侧：群成员列表（仅群聊显示） -->
    <div class="members-sidebar" v-if="currentSession?.type === 'group'" :class="{ collapsed: membersSidebarCollapsed }">
      <div class="members-header">
        <div class="members-title">
          <h3>群成员</h3>
          <span class="member-count" v-if="!loadingMembers">{{ members.length }}</span>
        </div>
        <button class="collapse-btn" @click="membersSidebarCollapsed = !membersSidebarCollapsed">
          {{ membersSidebarCollapsed ? '◀' : '▶' }}
        </button>
      </div>
      
      <template v-if="!membersSidebarCollapsed">
        <!-- 搜索框 -->
        <div class="members-search">
          <input
            type="text"
            v-model="memberSearch"
            placeholder="搜索成员..."
            class="search-input"
          />
        </div>

        <!-- 成员列表 -->
        <div class="members-list" v-if="!loadingMembers">
          <!-- 群主分组 -->
          <template v-if="filteredOwners.length > 0">
            <div class="member-group-header">
              <span class="crown-icon">👑</span> 群主 — {{ filteredOwners.length }}
            </div>
            <div
              v-for="member in filteredOwners"
              :key="member.id"
              class="member-item owner"
              @click="onMemberClick(member)"
            >
              <div class="member-avatar">
                <img :src="member.avatar" @error="handleMemberAvatarError" />
              </div>
              <div class="member-info">
                <div class="member-name">{{ member.name }}</div>
                <div class="member-title" v-if="member.title">{{ member.title }}</div>
              </div>
            </div>
          </template>

          <!-- 管理员分组 -->
          <template v-if="filteredAdmins.length > 0">
            <div class="member-group-header">
              <span class="admin-icon">⚙️</span> 管理员 — {{ filteredAdmins.length }}
            </div>
            <div
              v-for="member in filteredAdmins"
              :key="member.id"
              class="member-item admin"
              @click="onMemberClick(member)"
            >
              <div class="member-avatar">
                <img :src="member.avatar" @error="handleMemberAvatarError" />
              </div>
              <div class="member-info">
                <div class="member-name">{{ member.name }}</div>
                <div class="member-title" v-if="member.title">{{ member.title }}</div>
              </div>
            </div>
          </template>

          <!-- 普通成员分组 -->
          <template v-if="filteredNormalMembers.length > 0">
            <div class="member-group-header">
              <span class="member-icon">👤</span> 成员 — {{ filteredNormalMembers.length }}
            </div>
            <div
              v-for="member in filteredNormalMembers"
              :key="member.id"
              class="member-item"
              @click="onMemberClick(member)"
            >
              <div class="member-avatar">
                <img :src="member.avatar" @error="handleMemberAvatarError" />
              </div>
              <div class="member-info">
                <div class="member-name">{{ member.name }}</div>
                <div class="member-title" v-if="member.title">{{ member.title }}</div>
              </div>
            </div>
          </template>

          <!-- 无搜索结果 -->
          <div v-if="memberSearch && filteredMembers.length === 0" class="no-members">
            未找到匹配的成员
          </div>
        </div>

        <!-- 加载中 -->
        <div class="members-loading" v-else>
          <k-icon name="loader" class="spin" />
          <span>加载中...</span>
        </div>
      </template>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="handleReply">
          <span class="menu-icon">↩️</span>
          <span>回复</span>
        </div>
        <div class="context-menu-item" @click="handleAt">
          <span class="menu-icon">@</span>
          <span>@TA</span>
        </div>
        <div class="context-menu-item" @click="handleCopy">
          <span class="menu-icon">📋</span>
          <span>复制</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="handleForward">
          <span class="menu-icon">📤</span>
          <span>转发</span>
        </div>
        <div class="context-menu-item danger" @click="handleRecall" v-if="canRecall">
          <span class="menu-icon">🗑️</span>
          <span>撤回</span>
        </div>
      </div>
      <div v-if="contextMenu.visible" class="context-menu-overlay" @click="hideContextMenu"></div>
    </Teleport>

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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { receive, message } from '@koishijs/client'
import { chatApi, imageApi, GuildMember } from '../api'
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
const inputRef = ref<HTMLTextAreaElement | null>(null)
const showConnectDialog = ref(false)

// 待发送的图片列表
interface PendingImage {
  dataUrl: string
  file: File
}
const pendingImages = ref<PendingImage[]>([])
const connectForm = reactive({
  type: 'group' as 'group' | 'private',
  targetId: '',
  name: '',
  platform: 'onebot'
})

// 群成员相关
const members = ref<GuildMember[]>([])
const loadingMembers = ref(false)
const membersSidebarCollapsed = ref(false)
const memberSearch = ref('')

// 过滤后的成员列表
const filteredMembers = computed(() => {
  if (!memberSearch.value) return members.value
  const search = memberSearch.value.toLowerCase()
  return members.value.filter(m =>
    m.name?.toLowerCase().includes(search) ||
    m.id?.toLowerCase().includes(search) ||
    m.title?.toLowerCase().includes(search)
  )
})

// 分组成员
const filteredOwners = computed(() => filteredMembers.value.filter(m => m.isOwner))
const filteredAdmins = computed(() => filteredMembers.value.filter(m => m.isAdmin && !m.isOwner))
const filteredNormalMembers = computed(() => filteredMembers.value.filter(m => !m.isAdmin && !m.isOwner))

// 加载群成员
const loadGuildMembers = async (guildId: string) => {
  loadingMembers.value = true
  members.value = []
  
  try {
    const result = await chatApi.getGuildMembers(guildId)
    members.value = result.members || []
  } catch (e) {
    console.warn('Failed to load guild members:', e)
  } finally {
    loadingMembers.value = false
  }
}

// 处理成员头像加载错误
const handleMemberAvatarError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
}

// 点击成员
const onMemberClick = (member: GuildMember) => {
  // 使用 Koishi/OneBot 标准格式：<at id="用户ID" />
  const atElement = `<at id="${member.id}" />`
  if (inputText.value) {
    inputText.value += ` ${atElement} `
  } else {
    inputText.value = `${atElement} `
  }
}

// 右键菜单相关
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  targetMsg: null as ChatMessage | null
})

// 计算是否可以撤回（只有自己发的消息可以撤回）
const canRecall = computed(() => {
  if (!contextMenu.targetMsg) return false
  return contextMenu.targetMsg.userId === contextMenu.targetMsg.selfId
})

const showContextMenu = (e: MouseEvent, msg: ChatMessage) => {
  contextMenu.visible = true
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  contextMenu.targetMsg = msg
}

const hideContextMenu = () => {
  contextMenu.visible = false
  contextMenu.targetMsg = null
}

// 回复消息
const handleReply = () => {
  if (!contextMenu.targetMsg) return
  const msg = contextMenu.targetMsg
  // 使用 Koishi/OneBot 标准格式：<quote id="消息ID" />
  const quoteElement = `<quote id="${msg.id}" />`
  inputText.value = quoteElement + inputText.value
  hideContextMenu()
}

// @某人
const handleAt = () => {
  if (!contextMenu.targetMsg) return
  const msg = contextMenu.targetMsg
  // 使用 Koishi/OneBot 标准格式：<at id="用户ID" />
  const atElement = `<at id="${msg.userId}" />`
  if (inputText.value) {
    inputText.value += ` ${atElement} `
  } else {
    inputText.value = `${atElement} `
  }
  hideContextMenu()
}

// 复制消息内容
const handleCopy = async () => {
  if (!contextMenu.targetMsg) return
  const msg = contextMenu.targetMsg
  const text = msg.content || ''
  
  // 移除 HTML 标签，获取纯文本
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = text
  const plainText = tempDiv.textContent || tempDiv.innerText || ''
  
  try {
    await navigator.clipboard.writeText(plainText)
    message.success('已复制到剪贴板')
  } catch {
    // 回退方案
    const textarea = document.createElement('textarea')
    textarea.value = plainText
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    message.success('已复制到剪贴板')
  }
  hideContextMenu()
}

// 转发消息（暂时只是复制到输入框）
const handleForward = () => {
  if (!contextMenu.targetMsg) return
  const msg = contextMenu.targetMsg
  inputText.value = msg.content || ''
  hideContextMenu()
  message.info('消息已复制到输入框，选择其他会话发送即可转发')
}

// 处理粘贴事件
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string
          if (dataUrl) {
            pendingImages.value.push({ dataUrl, file })
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }
}

// 移除待发送图片
const removePendingImage = (index: number) => {
  pendingImages.value.splice(index, 1)
}

// 撤回消息
const handleRecall = async () => {
  if (!contextMenu.targetMsg || !currentSession.value) return
  const msg = contextMenu.targetMsg
  const session = currentSession.value
  
  try {
    await chatApi.recall(session.id, msg.id, session.platform)
    // 从本地消息列表中移除
    const index = session.messages.findIndex(m => m.id === msg.id)
    if (index !== -1) {
      session.messages.splice(index, 1)
    }
    message.success('消息已撤回')
  } catch (e: any) {
    message.error(e.message || '撤回失败')
  }
  hideContextMenu()
}

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
    
    // 如果是群聊，加载群成员
    if (session.type === 'group' && session.guildId) {
      loadGuildMembers(session.guildId)
    } else {
      members.value = []
    }
  } else {
    currentSession.value = undefined
    members.value = []
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
  const hasImages = pendingImages.value.length > 0
  
  if (!text && !hasImages) return
  if (!currentSession.value) return

  sending.value = true
  try {
    const session = currentSession.value
    
    // 构建消息内容
    let content = text
    
    // 添加图片（使用 base64 格式）
    for (const img of pendingImages.value) {
      // 使用 Koishi 的 img 元素格式，src 为 base64 dataUrl
      content += `<img src="${img.dataUrl}" />`
    }
    
    await chatApi.send(session.id, content, session.platform, session.guildId)
    
    // 清空输入框和待发送图片
    inputText.value = ''
    pendingImages.value = []
  } catch (e: any) {
    message.error(e.message || '发送失败')
  } finally {
    sending.value = false
    // 聚焦回输入框
    inputRef.value?.focus()
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

  // 4.5 替换引用 <quote id="..." user="..." content="..." /> 或 <quote>...</quote>
  html = html.replace(/<quote\s+([^>]*)(?:\/>|>([\s\S]*?)<\/quote>)/g, (match, attrs, innerContent) => {
    const idMatch = attrs.match(/id="([^"]+)"/)
    const userMatch = attrs.match(/user="([^"]+)"/)
    const contentMatch = attrs.match(/content="([^"]*)"/)
    const msgId = idMatch ? idMatch[1] : ''
    
    // 优先使用属性中的 user 和 content
    let quotedUser = userMatch ? userMatch[1] : ''
    let quotedContent = contentMatch ? contentMatch[1].replace(/&quot;/g, '"') : (innerContent || '')
    
    // 如果属性中没有，尝试从当前会话中找到被引用的消息
    if (msgId && currentSession.value && (!quotedUser || !quotedContent)) {
      const quotedMsg = currentSession.value.messages.find(m => m.id === msgId)
      if (quotedMsg) {
        if (!quotedUser) quotedUser = quotedMsg.username || ''
        // 获取纯文本预览
        if (!quotedContent) {
          const preview = quotedMsg.content?.replace(/<[^>]+>/g, '').substring(0, 50) || ''
          quotedContent = preview + (quotedMsg.content && quotedMsg.content.length > 50 ? '...' : '')
        }
      }
    }
    
    return `<div class="msg-quote"><span class="quote-user">${quotedUser ? '@' + quotedUser : ''}</span><span class="quote-content">${quotedContent || '[引用消息]'}</span></div>`
  })

  // 5. 简单的 CQ 码兼容 (以防万一)
  // [CQ:image,file=xxx,url=xxx] 格式 - 优先使用 url
  html = html.replace(/\[CQ:image,[^\]]*\]/g, (match) => {
    // 提取 url 参数
    const urlMatch = match.match(/url=([^,\]]+)/)
    // 提取 file 参数 (可能是本地文件名或 base64)
    const fileMatch = match.match(/file=([^,\]]+)/)
    
    let src = ''
    let file = ''
    
    if (urlMatch) {
      src = urlMatch[1]
    }
    if (fileMatch) {
      file = fileMatch[1]
      // 如果 file 是 base64 格式
      if (file.startsWith('base64://')) {
        src = `data:image/png;base64,${file.substring(9)}`
      } else if (!src) {
        // 如果没有 url，尝试用 file 作为 url（可能是远程地址）
        src = file
      }
    }
    
    if (!src) return match // 无法解析，保留原始
    return createImgTag(src, file)
  })
  html = html.replace(/\[CQ:at,[^\]]*qq=([^,\]]+)[^\]]*\]/g, (match, id) => {
    // 尝试从成员列表中获取名称
    let displayName = id
    const member = members.value.find(m => m.id === id)
    if (member && member.name) {
      displayName = member.name
    }
    return `<span class="msg-at">@${displayName}</span>`
  })
  
  // 5.5 CQ 码 reply 兼容: [CQ:reply,id=消息ID]
  html = html.replace(/\[CQ:reply,id=([^\],]+)[^\]]*\]/g, (match, msgId) => {
    // 尝试从当前会话中找到被引用的消息
    let quotedContent = ''
    let quotedUser = ''
    
    if (msgId && currentSession.value) {
      const quotedMsg = currentSession.value.messages.find(m => m.id === msgId)
      if (quotedMsg) {
        quotedUser = quotedMsg.username || ''
        // 获取纯文本预览（移除 CQ 码和 HTML 标签）
        const preview = quotedMsg.content
          ?.replace(/\[CQ:[^\]]+\]/g, '')
          ?.replace(/<[^>]+>/g, '')
          ?.trim()
          ?.substring(0, 50) || ''
        quotedContent = preview + (quotedMsg.content && quotedMsg.content.length > 50 ? '...' : '')
      }
    }
    
    return `<div class="msg-quote"><span class="quote-user">${quotedUser ? '@' + quotedUser : ''}</span><span class="quote-content">${quotedContent || '[引用消息]'}</span></div>`
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
  border-radius: 20px;
  overflow: hidden;
  animation: fadeInUp 0.4s ease-out backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-left: 3px solid transparent;
}

.session-item:hover {
  background: var(--k-color-bg-1);
  transform: translateX(4px);
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
  width: fit-content;
  max-width: 100%;
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

.message-bubble :deep(.msg-quote) {
  background: var(--k-color-bg-2);
  border-left: 3px solid var(--k-color-active);
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 0 6px 6px 0;
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-bubble :deep(.msg-quote .quote-user) {
  font-weight: 600;
  color: var(--k-color-active);
  font-size: 0.8rem;
}

.message-bubble :deep(.msg-quote .quote-content) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.message-row.self .message-bubble :deep(.msg-quote) {
  background: rgba(255, 255, 255, 0.15);
  border-left-color: rgba(255, 255, 255, 0.5);
}

.message-row.self .message-bubble :deep(.msg-quote .quote-user) {
  color: rgba(255, 255, 255, 0.9);
}

.message-row.self .message-bubble :deep(.msg-quote .quote-content) {
  color: rgba(255, 255, 255, 0.8);
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
  flex-direction: column;
  gap: 0.75rem;
}

.pending-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pending-image-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--k-color-border);
}

.pending-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  transition: background 0.2s;
}

.remove-image-btn:hover {
  background: #f56c6c;
}

.input-row {
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
  border-radius: 20px;
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

/* 群成员侧边栏 */
.members-sidebar {
  width: 220px;
  border-left: 1px solid var(--k-color-border);
  display: flex;
  flex-direction: column;
  background: var(--k-color-bg-2);
  transition: width 0.3s ease;
}

.members-sidebar.collapsed {
  width: 40px;
}

.members-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.members-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.members-sidebar.collapsed .members-title {
  display: none;
}

.members-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--k-color-text);
  font-weight: 600;
}

.member-count {
  font-size: 0.75rem;
  background: var(--k-color-active);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--k-color-text-description);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: var(--k-color-bg-3);
}

.members-search {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--k-color-border);
}

.members-search .search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  font-size: 0.8rem;
}

.members-search .search-input:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.members-search .search-input::placeholder {
  color: var(--k-color-text-description);
}

.members-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.member-group-header {
  padding: 8px 12px 4px;
  font-size: 0.7rem;
  color: var(--k-color-text-description);
  font-weight: 600;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.crown-icon {
  font-size: 10px;
}

.admin-icon {
  font-size: 10px;
}

.member-icon {
  font-size: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.member-item:hover {
  background: var(--k-color-bg-1);
  transform: translateX(4px);
}

.member-item.owner .member-name {
  color: #e6a23c;
  font-weight: 600;
}

.member-item.admin .member-name {
  color: #67c23a;
  font-weight: 500;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--k-color-bg-3);
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-info {
  flex: 1;
  overflow: hidden;
}

.member-name {
  font-size: 0.85rem;
  color: var(--k-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-title {
  font-size: 0.7rem;
  color: var(--k-color-text-description);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.members-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 0.5rem;
  color: var(--k-color-text-description);
  font-size: 0.85rem;
}

.no-members {
  padding: 2rem;
  text-align: center;
  color: var(--k-color-text-description);
  font-size: 0.85rem;
}

/* 响应式：小屏幕隐藏成员侧边栏 */
@media (max-width: 900px) {
  .members-sidebar {
    display: none;
  }
}

/* 右键菜单样式 */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  min-width: 140px;
  padding: 6px 0;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  color: var(--k-color-text);
  font-size: 0.9rem;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: var(--k-color-bg-1);
}

.context-menu-item.danger {
  color: #f56c6c;
}

.context-menu-item.danger:hover {
  background: rgba(245, 108, 108, 0.1);
}

.menu-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.context-menu-divider {
  height: 1px;
  background: var(--k-color-border);
  margin: 6px 0;
}
</style>