<template>
  <div class="warns-view">
    <div class="view-header">
      <h2 class="view-title">警告记录</h2>
      <div class="header-actions">
        <div class="toggle-wrapper">
          <label>解析名称</label>
          <el-switch v-model="fetchNames" @change="refreshWarns" />
        </div>
        <k-button @click="showAddDialog = true">
          <template #icon><k-icon name="plus" /></template>
          添加警告
        </k-button>
        <k-button @click="reloadWarns" :loading="reloading" title="从文件重新加载警告数据">
          <template #icon><k-icon name="database" /></template>
          重载
        </k-button>
        <k-button type="primary" @click="refreshWarns">
          <template #icon><k-icon name="refresh-cw" /></template>
          刷新
        </k-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 主布局：左右分栏 -->
    <div v-else-if="Object.keys(groupedWarns).length > 0" class="warns-layout">
      
      <!-- 左侧：群组列表 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span>群组列表 ({{ Object.keys(groupedWarns).length }})</span>
        </div>
        <div class="sidebar-list">
          <div
            v-for="(groupWarns, guildId, index) in groupedWarns"
            :key="guildId"
            class="sidebar-item"
            :class="{ active: selectedGuildId === guildId }"
            :style="{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }"
            @click="selectGuild(guildId as string)"
          >
            <div class="item-icon">
              <img
                v-if="fetchNames && groupWarns[0].guildAvatar"
                :src="groupWarns[0].guildAvatar"
                class="guild-avatar"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <k-icon v-else name="users" />
            </div>
            <div class="item-info">
              <div class="item-name" :title="getGuildName(groupWarns[0])">
                {{ getGuildName(groupWarns[0]) }}
              </div>
              <div class="item-meta">
                {{ groupWarns.length }} 条记录
              </div>
            </div>
            <div class="active-indicator"></div>
          </div>
        </div>
      </div>

      <!-- 右侧：详情列表 -->
      <div class="content-area">
        <div v-if="selectedGuildId && groupedWarns[selectedGuildId]" class="group-detail">
          <div class="detail-header">
            <div class="detail-title">
              <h3>{{ getGuildName(groupedWarns[selectedGuildId][0]) }}</h3>
              <span class="detail-subtitle">群号: {{ selectedGuildId }}</span>
            </div>
          </div>
          
          <div class="user-list">
            <div
              v-for="(item, index) in groupedWarns[selectedGuildId]"
              :key="item.key"
              class="user-row"
              :style="{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }"
            >
              <div class="user-info">
                <div class="avatar-placeholder">
                  <img
                    v-if="fetchNames && item.userAvatar"
                    :src="item.userAvatar"
                    class="user-avatar"
                    @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                  />
                  <k-icon v-else name="user" />
                </div>
                <div class="user-details">
                  <div class="user-name">{{ item.userName !== 'Unknown' ? item.userName : '未知用户' }}</div>
                  <div class="user-id">{{ item.userId }}</div>
                </div>
              </div>
              
              <div class="warn-stats">
                <div class="warn-time">
                  <k-icon name="clock" class="small-icon" />
                  {{ formatTime(item.timestamp) }}
                </div>
              </div>

              <div class="warn-control">
                <el-input-number 
                  v-model="item.count" 
                  :min="0" 
                  size="small"
                  @change="(val) => updateWarn(item, val)"
                />
                <k-button size="small" type="danger" @click="updateWarn(item, 0)" title="清除警告">
                  <template #icon><k-icon name="trash-2" /></template>
                  清除
                </k-button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-selection">
          <k-icon name="arrow-left" class="arrow-icon" />
          <p>请选择左侧群组查看详情</p>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <k-icon name="check-circle" class="empty-icon" />
      <p>暂无警告记录</p>
    </div>

    <!-- 添加警告弹窗 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>添加警告</h3>
          <button class="close-btn" @click="showAddDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>群号</label>
            <input
              v-model="newWarn.guildId"
              type="text"
              placeholder="输入群号..."
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>用户ID</label>
            <input
              v-model="newWarn.userId"
              type="text"
              placeholder="输入用户ID..."
              class="form-input"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showAddDialog = false">取消</k-button>
          <k-button type="primary" @click="addWarn" :loading="adding">添加</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from '@koishijs/client'
import { warnsApi } from '../api'
import type { WarnRecord } from '../types'

const loading = ref(false)
const adding = ref(false)
const reloading = ref(false)
const fetchNames = ref(true)
const showAddDialog = ref(false)
const selectedGuildId = ref<string>('')

const newWarn = reactive({
  guildId: '',
  userId: ''
})

interface ProcessedWarn {
  key: string
  userId: string
  userName: string
  userAvatar: string
  guildId: string
  guildName: string
  guildAvatar: string
  count: number
  timestamp: number
}

const groupedWarns = ref<Record<string, ProcessedWarn[]>>({})

const selectGuild = (guildId: string) => {
  selectedGuildId.value = guildId
}

const getGuildName = (item: ProcessedWarn | undefined) => {
  if (!item) return ''
  return (item.guildName && item.guildName !== 'Unknown') ? item.guildName : item.guildId
}

const refreshWarns = async () => {
  loading.value = true
  try {
    const data = await warnsApi.list(fetchNames.value)
    const groups: Record<string, ProcessedWarn[]> = {}
    
    // @ts-ignore
    data.forEach(item => {
      if (!groups[item.guildId]) groups[item.guildId] = []
      groups[item.guildId].push(item)
    })
    
    groupedWarns.value = groups
    
    // 如果当前选中的群组不在列表中（可能被清空了），或者还没选中，默认选中第一个
    const guildIds = Object.keys(groups)
    if (guildIds.length > 0) {
      if (!selectedGuildId.value || !groups[selectedGuildId.value]) {
        selectedGuildId.value = guildIds[0]
      }
    } else {
      selectedGuildId.value = ''
    }
    
  } catch (e: any) {
    message.error(e.message || '加载警告记录失败')
  } finally {
    loading.value = false
  }
}

const reloadWarns = async () => {
  reloading.value = true
  try {
    await warnsApi.reload()
    message.success('警告数据已重新加载')
    await refreshWarns()
  } catch (e: any) {
    message.error(e.message || '重新加载失败')
  } finally {
    reloading.value = false
  }
}

const addWarn = async () => {
  if (!newWarn.guildId.trim() || !newWarn.userId.trim()) {
    message.warning('请输入群号和用户ID')
    return
  }

  adding.value = true
  try {
    await warnsApi.add(newWarn.guildId, newWarn.userId)
    message.success('添加成功')
    showAddDialog.value = false
    
    // 自动切换到新添加的群组
    const targetGuildId = newWarn.guildId
    newWarn.guildId = ''
    newWarn.userId = ''
    
    await refreshWarns()
    selectedGuildId.value = targetGuildId
    
  } catch (e: any) {
    message.error(e.message || '添加失败')
  } finally {
    adding.value = false
  }
}

const updateWarn = async (item: ProcessedWarn, count: number | undefined) => {
  if (count === undefined) return
  try {
    await warnsApi.update(item.key, count)
    if (count <= 0) {
      message.success('警告已清除')
      await refreshWarns()
    }
  } catch (e: any) {
    message.error(e.message || '更新警告失败')
    await refreshWarns() 
  }
}

const formatTime = (timestamp: number | undefined) => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  refreshWarns()
})
</script>

<style scoped>
.warns-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

.view-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0;
}

/* 布局容器 */
.warns-layout {
  display: flex;
  flex: 1;
  border: 1px solid var(--k-color-border);
  border-radius: 20px;
  background: var(--k-card-bg);
  overflow: hidden;
  height: 0; /* 关键：触发 flex 高度计算 */
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

/* 左侧边栏 */
.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--k-color-border);
  background: var(--k-color-bg-1);
}

.sidebar-header {
  padding: 1rem;
  font-weight: 600;
  color: var(--k-color-text-description);
  border-bottom: 1px solid var(--k-color-border);
  font-size: 0.9rem;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  margin-bottom: 2px;
  animation: item-enter 0.4s ease-out backwards;
}

@keyframes item-enter {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-item:hover {
  background: var(--k-color-bg-2);
  transform: translateX(4px);
}

.sidebar-item.active {
  background: var(--k-color-active-bg, rgba(64, 158, 255, 0.1));
}

.item-icon {
  color: var(--k-color-text-description);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.guild-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar-item.active .item-icon {
  color: var(--k-color-active);
}

.item-info {
  flex: 1;
  min-width: 0; /* 文本截断需要 */
}

.item-name {
  font-weight: 500;
  color: var(--k-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
}

.sidebar-item.active .item-name {
  color: var(--k-color-active);
}

.item-meta {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  margin-top: 2px;
}

.active-indicator {
  width: 3px;
  height: 0;
  background: var(--k-color-active);
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 3px 0 0 3px;
  transition: height 0.2s;
}

.sidebar-item.active .active-indicator {
  height: 60%;
}

/* 右侧内容区 */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--k-card-bg);
  min-width: 0;
}

.group-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
}

.detail-title h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--k-color-text);
}

.detail-subtitle {
  font-size: 0.9rem;
  color: var(--k-color-text-description);
  margin-top: 0.25rem;
  display: block;
  font-family: monospace;
}

.user-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.user-row {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  animation: row-enter 0.4s ease-out backwards;
}

@keyframes row-enter {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.user-row:hover {
  background-color: var(--k-color-bg-1);
  transform: translateX(6px);
  box-shadow: -4px 0 0 var(--k-color-active);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 250px;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--k-color-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
  flex-shrink: 0;
  overflow: hidden;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  color: var(--k-color-text);
  font-size: 0.95rem;
}

.user-id {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--k-color-text-description);
}

.warn-stats {
  flex: 1;
  display: flex;
  align-items: center;
  color: var(--k-color-text-description);
  font-size: 0.9rem;
}

.warn-time {
  display: flex;
  align-items: center;
  gap: 6px;
}

.small-icon {
  font-size: 0.9rem;
}

.warn-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 滚动条美化 */
.sidebar-list::-webkit-scrollbar,
.user-list::-webkit-scrollbar {
  width: 6px;
}

.sidebar-list::-webkit-scrollbar-track,
.user-list::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-list::-webkit-scrollbar-thumb,
.user-list::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}

.sidebar-list::-webkit-scrollbar-thumb:hover,
.user-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}

/* 状态相关 */
.loading-state,
.empty-state,
.empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--k-color-text-description);
  gap: 1rem;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
  color: #67c23a;
}

.arrow-icon {
  font-size: 32px;
  opacity: 0.5;
  transform: translateX(-10px);
  animation: bounce-left 2s infinite;
}

@keyframes bounce-left {
  0%, 100% { transform: translateX(-10px); }
  50% { transform: translateX(-15px); }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 弹窗样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-card {
  background: var(--k-card-bg);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeInUp 0.3s ease-out;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--k-color-text);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--k-color-text-description);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--k-color-text);
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
  font-weight: 500;
  color: var(--k-color-text);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--k-color-border);
}
</style>