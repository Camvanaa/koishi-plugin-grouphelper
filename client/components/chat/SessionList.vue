<template>
      <div class="chat-sidebar">
    <div class="sidebar-header">
      <h3>实时消息</h3>
      <div class="status-indicator">
        <span class="dot"></span> 实时接收中
      </div>
    </div>
    
    <!-- 连接群聊按钮 -->
    <div class="connect-group-bar">
      <button class="connect-btn" @click="$emit('create')">
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
        :class="{ active: currentId === session.id }"
        @click="$emit('select', session.id)"
      >
        <div class="session-icon">
          <img v-if="session.avatar" :src="session.avatar" @error="hideBrokenAvatar" />
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
</template>

<script setup lang="ts">
/**
 * 聊天页左侧会话列表。自 ChatView 抽出，样式随标记一并迁入。
 */
import { formatTimeShort } from '../../utils/format'

defineProps<{
  sessions: Array<{
    id: string
    type: 'group' | 'private'
    name: string
    avatar?: string
    unread: number
    lastMessage?: { content?: string; timestamp?: number }
  }>
  currentId: string
}>()

defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
}>()

/** 头像加载失败就隐藏，露出下面的图标占位 */
const hideBrokenAvatar = (e: Event) => {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
</script>

<style scoped>
/* Sidebar */
.chat-sidebar {
  width: 240px;
  border-right: 1px solid var(--k-color-divider);
  display: flex;
  flex-direction: column;
  background: var(--bg2);
}



.sidebar-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--k-color-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}



.sidebar-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg1);
  letter-spacing: -0.01em;
}



.status-indicator {
  font-size: 11px;
  color: var(--k-color-success);
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-weight: 500;
}



.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--k-color-success);
  /* 实心小圆点，无发光效果 */
}



/* Session List */
.session-list {
  flex: 1;
  overflow-y: auto;
}



.empty-sessions {
  padding: 32px 16px;
  text-align: center;
  color: var(--fg3);
  font-size: 12px;
}



.session-item {
  display: flex;
  padding: 10px 12px;
  gap: 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-left: 2px solid transparent;
}



.session-item:hover {
  background: var(--bg3);
}



.session-item.active {
  background: var(--k-color-primary-fade);
  border-left-color: var(--k-color-primary);
}



.session-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg3);
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--k-color-divider);
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
  gap: 2px;
}



.session-name {
  font-weight: 500;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}



.session-preview {
  font-size: 11px;
  color: var(--fg3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}



.session-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}



.session-meta .time {
  font-size: 10px;
  color: var(--fg3);
  font-family: var(--font-mono);
}



.badge {
  background: var(--k-color-danger);
  color: #fff;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  min-width: 16px;
  text-align: center;
}



/* Connect Group Button */
.connect-group-bar {
  padding: 10px 12px;
  border-bottom: 1px solid var(--k-color-divider);
}



.connect-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--k-color-divider);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--fg3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-family: var(--font-sans);
  transition: all 0.15s ease;
}



.connect-btn:hover {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
  background: var(--k-color-primary-fade);
}
</style>
