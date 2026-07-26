<template>
  <div class="blacklist-view">
    <div class="view-header">
      <h2 class="view-title">黑名单</h2>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="refreshBlacklist" title="刷新列表" :disabled="loading">
          <k-icon name="refresh-cw" :class="{ 'spin': loading }" />
          刷新
        </button>
        <button class="btn btn-primary" @click="showAddDialog = true">
          <k-icon name="user-plus" />
          添加用户
        </button>
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
  // 用 trim 后的值校验就必须用同一个值提交，
  // 否则带尾随空格的 ID 会以脏 key 落盘，后续按纯数字查询永远命中不了
  const userId = newUser.userId.trim()
  if (!userId) {
    message.warning('请输入用户ID')
    return
  }
  if (!/^\d+$/.test(userId)) {
    message.warning('用户ID应为纯数字')
    return
  }

  adding.value = true
  try {
    await blacklistApi.add(userId, {
      userId,
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
  // 移除是不可撤销的破坏性操作，列表 hover 时极易误点，必须二次确认
  if (!window.confirm(`确定要将 ${formatUserId(userId)} 移出黑名单吗？`)) return

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
/* ========== 使用 Koishi 全局 CSS 变量 ========== */
.blacklist-view {
  --radius: 6px;
  --border: 1px solid var(--k-color-divider);

  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-family);
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--k-color-divider);
}

.view-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.25px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Header Buttons Override */
.btn {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.12s ease;
  user-select: none;
  border: var(--border);
  line-height: 1;
}

.btn-secondary {
  background: var(--bg3);
  color: var(--fg2);
}

.btn-secondary:hover {
  background: var(--bg3);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.btn-primary {
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
  border-color: rgba(116, 89, 255, 0.2);
}

.btn-primary:hover {
  background: rgba(116, 89, 255, 0.18);
  border-color: rgba(116, 89, 255, 0.35);
  color: var(--k-color-primary);
}

.header-actions :deep(.k-icon) {
  font-size: 14px;
}

/* States */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 2.5rem;
  color: var(--fg3);
  font-size: 0.875rem;
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
  padding: 2.5rem;
  color: var(--fg3);
  font-size: 0.875rem;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 0.75rem;
  opacity: 0.4;
  color: var(--k-color-success);
}

/* Table */
.blacklist-table {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr 200px 120px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg1);
  border-bottom: 1px solid var(--k-color-border);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 200px 120px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  align-items: center;
  border-bottom: 1px solid var(--k-color-divider);
  transition: background-color 0.15s ease;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--bg3);
}

.col-user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  color: var(--fg1);
}

.user-icon {
  color: var(--k-color-danger);
  font-size: 16px;
}

.col-time {
  color: var(--fg3);
  font-size: 0.75rem;
  font-family: var(--font-family-code);
}

.col-actions {
  display: flex;
  justify-content: flex-end;
}

/* Row Buttons Override */
.col-actions :deep(.k-button) {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--k-color-danger);
  font-weight: 500;
  transition: all 0.15s ease;
}

.col-actions :deep(.k-button:hover) {
  background: var(--k-color-danger-fade);
  border-color: var(--k-color-danger);
}

.col-actions :deep(.k-icon) {
  font-size: 12px;
}

@media (max-width: 600px) {
  .table-header,
  .table-row {
    grid-template-columns: 1fr 80px;
  }
  .col-time {
    display: none;
  }
  .col-actions :deep(.k-button) span {
    display: none; /* 小屏幕隐藏按钮文字 */
  }
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.add-dialog {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  width: 90%;
  max-width: 380px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-border);
  background: var(--bg1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--fg1);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fg3);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
}

.add-form {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg2);
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  background: var(--bg1);
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.form-input::placeholder {
  color: var(--fg3);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--k-color-border);
  background: var(--bg1);
}

/* Dialog Footer Buttons Override */
.dialog-footer :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--k-color-divider);
  background: var(--bg3);
  color: var(--fg2);
  font-weight: 500;
  transition: all 0.15s ease;
}

.dialog-footer :deep(.k-button:hover) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.dialog-footer :deep(.k-button[type="primary"]) {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary-tint);
  color: var(--k-color-primary);
}

.dialog-footer :deep(.k-button[type="primary"]:hover) {
  background: rgba(116, 89, 255, 0.25);
  border-color: rgba(116, 89, 255, 0.5);
}

/* ========== Mobile Responsive ========== */
@media (max-width: 768px) {
  .blacklist-view {
    padding: 12px;
  }

  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .view-title {
    font-size: 1.25rem;
  }

  .header-actions {
    width: 100%;
    display: flex;
    gap: 8px;
  }

  .header-actions .btn {
    flex: 1;
    justify-content: center;
    padding: 8px 12px;
    font-size: 12px;
  }

  .blacklist-container {
    padding: 0;
  }

  /* Table to card layout */
  .table-header {
    display: none;
  }

  .blacklist-table {
    gap: 8px;
  }

  .table-row {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
    gap: 10px;
    border-radius: 8px;
    background: var(--bg2);
    border: 1px solid var(--k-color-divider);
  }

  .col-user {
    width: 100%;
    font-size: 13px;
  }

  .col-time {
    width: 100%;
    font-size: 12px;
    color: var(--fg3);
    padding-left: 24px; /* Align with text after icon */
  }

  .col-actions {
    width: 100%;
    padding-top: 8px;
    border-top: 1px solid var(--k-color-divider);
    justify-content: flex-end;
  }

  /* Dialog */
  .add-dialog {
    width: 95%;
    max-width: none;
    margin: 16px;
  }

  .dialog-header {
    padding: 12px 16px;
  }

  .dialog-header h3 {
    font-size: 1rem;
  }

  .add-form {
    padding: 16px;
  }

  .form-group label {
    font-size: 12px;
  }

  .form-input {
    font-size: 16px; /* Prevent iOS zoom */
    padding: 10px 12px;
  }

  .dialog-footer {
    padding: 12px 16px;
  }

  /* Empty state */
  .empty-state {
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 48px;
  }
}

@media (max-width: 480px) {
  .blacklist-view {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
  }

  .table-row {
    padding: 10px;
  }

  .user-icon {
    font-size: 14px;
  }

  .col-user span {
    font-size: 12px;
  }

  .col-time {
    font-size: 11px;
    padding-left: 22px;
  }
}
</style>