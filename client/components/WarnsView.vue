<template>
  <div class="warns-view">
    <div class="view-header">
      <h2 class="view-title">警告记录</h2>
      <k-button type="primary" @click="refreshWarns">
        <template #icon><k-icon name="refresh-cw" /></template>
        刷新
      </k-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 警告列表 -->
    <div v-else class="warns-list">
      <div v-if="Object.keys(warns).length === 0" class="empty-state">
        <k-icon name="check-circle" class="empty-icon" />
        <p>暂无警告记录</p>
      </div>

      <div
        v-for="(record, key) in warns"
        :key="key"
        class="warn-card"
      >
        <div class="card-header">
          <div class="user-info">
            <k-icon name="user" class="user-icon" />
            <span class="user-key">{{ key }}</span>
          </div>
          <div class="warn-count" :class="getWarnLevel(record.count)">
            {{ record.count }} 次警告
          </div>
        </div>
        <div class="card-body">
          <div class="warn-item">
            <span class="item-label">群组ID</span>
            <span class="item-value">{{ record.guildId || '未知' }}</span>
          </div>
          <div class="warn-item">
            <span class="item-label">用户ID</span>
            <span class="item-value">{{ record.userId || '未知' }}</span>
          </div>
          <div class="warn-item">
            <span class="item-label">最后警告时间</span>
            <span class="item-value">{{ formatTime(record.lastWarnTime) }}</span>
          </div>
        </div>
        <div class="card-actions">
          <k-button size="small" type="danger" @click="clearWarn(key as string)">
            <k-icon name="trash-2" />
            清除警告
          </k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { warnsApi } from '../api'
import type { WarnRecord } from '../types'

const loading = ref(false)
const warns = ref<Record<string, WarnRecord>>({})

const refreshWarns = async () => {
  loading.value = true
  try {
    warns.value = await warnsApi.list()
  } catch (e: any) {
    message.error(e.message || '加载警告记录失败')
  } finally {
    loading.value = false
  }
}

const clearWarn = async (key: string) => {
  try {
    await warnsApi.clear(key)
    message.success('已清除警告')
    await refreshWarns()
  } catch (e: any) {
    message.error(e.message || '清除警告失败')
  }
}

const getWarnLevel = (count: number) => {
  if (count >= 3) return 'danger'
  if (count >= 2) return 'warning'
  return 'normal'
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
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.view-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.warns-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
  color: #67c23a;
}

.warn-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--k-color-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-icon {
  color: var(--k-color-active);
}

.user-key {
  font-weight: 600;
  color: var(--k-color-text);
  font-family: monospace;
}

.warn-count {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.warn-count.normal {
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.warn-count.warning {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.warn-count.danger {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.card-body {
  padding: 1rem;
}

.warn-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.warn-item:not(:last-child) {
  border-bottom: 1px dashed var(--k-color-border);
}

.item-label {
  color: var(--k-color-text-description);
  font-size: 0.875rem;
}

.item-value {
  font-weight: 500;
  color: var(--k-color-text);
}

.card-actions {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  justify-content: flex-end;
}
</style>