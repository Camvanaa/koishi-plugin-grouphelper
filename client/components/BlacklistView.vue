<template>
  <div class="blacklist-view">
    <div class="view-header">
      <h2 class="view-title">黑名单</h2>
      <div class="header-actions">
        <k-button @click="showAddDialog = true">
          <template #icon><k-icon name="user-plus" /></template>
          添加用户
        </k-button>
        <k-button type="primary" @click="refreshBlacklist">
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

    <!-- 黑名单列表 -->
    <div v-else class="blacklist-container">
      <div v-if="Object.keys(blacklist).length === 0" class="empty-state">
        <k-icon name="shield-check" class="empty-icon" />
        <p>黑名单为空</p>
      </div>

      <div class="blacklist-table" v-else>
        <div class="table-header">
          <div class="col-user">用户ID</div>
          <div class="col-time">添加时间</div>
          <div class="col-actions">操作</div>
        </div>
        <div
          v-for="(record, userId) in blacklist"
          :key="userId"
          class="table-row"
        >
          <div class="col-user">
            <k-icon name="user-x" class="user-icon" />
            <span>{{ formatUserId(userId as string) }}</span>
          </div>
          <div class="col-time">{{ formatTime(record.timestamp) }}</div>
          <div class="col-actions">
            <k-button size="small" type="danger" @click="removeUser(userId as string)">
              <k-icon name="trash-2" />
              移除
            </k-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加用户弹窗 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="add-dialog">
        <div class="dialog-header">
          <h3>添加黑名单用户</h3>
          <button class="close-btn" @click="showAddDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="add-form">
          <div class="form-group">
            <label>用户ID</label>
            <input
              v-model="newUser.userId"
              type="text"
              placeholder="输入用户ID..."
              class="form-input"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showAddDialog = false">取消</k-button>
          <k-button type="primary" @click="addUser" :loading="adding">添加</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { blacklistApi } from '../api'
import type { BlacklistRecord } from '../types'

const loading = ref(false)
const adding = ref(false)
const showAddDialog = ref(false)
const blacklist = ref<Record<string, BlacklistRecord>>({})

const newUser = reactive({
  userId: ''
})

const refreshBlacklist = async () => {
  loading.value = true
  try {
    blacklist.value = await blacklistApi.list()
  } catch (e: any) {
    message.error(e.message || '加载黑名单失败')
  } finally {
    loading.value = false
  }
}

const addUser = async () => {
  if (!newUser.userId.trim()) {
    message.warning('请输入用户ID')
    return
  }
  adding.value = true
  try {
    await blacklistApi.add(newUser.userId, {
      userId: newUser.userId,
      timestamp: Date.now()
    })
    message.success('已添加到黑名单')
    showAddDialog.value = false
    newUser.userId = ''
    await refreshBlacklist()
  } catch (e: any) {
    message.error(e.message || '添加失败')
  } finally {
    adding.value = false
  }
}

const removeUser = async (userId: string) => {
  try {
    await blacklistApi.remove(userId)
    message.success('已从黑名单移除')
    await refreshBlacklist()
  } catch (e: any) {
    message.error(e.message || '移除失败')
  }
}

const formatTime = (timestamp: number | undefined) => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatUserId = (id: string) => {
  if (id.startsWith('<at')) {
    const match = id.match(/id="(\d+)"/)
    return match ? match[1] : id
  }
  return id
}


onMounted(() => {
  refreshBlacklist()
})
</script>

<style scoped>
.blacklist-view {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
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

.blacklist-container {
  flex: 1;
  overflow-y: auto;
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

.blacklist-table {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--k-color-bg-2);
  border-bottom: 1px solid var(--k-color-border);
  font-weight: 600;
  color: var(--k-color-text);
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  padding: 1rem;
  align-items: center;
  border-bottom: 1px solid var(--k-color-border);
  transition: background 0.2s;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--k-color-bg-1);
}

.col-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-icon {
  color: #f56c6c;
}

.col-time {
  color: var(--k-color-text-description);
  font-size: 0.875rem;
}

.dialog-overlay {
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

.add-dialog {
  background: var(--k-card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
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

.add-form {
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

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  box-sizing: border-box;
}

.form-textarea:focus {
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