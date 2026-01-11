<template>
  <div class="subscription-view">
    <!-- Header -->
    <header class="view-header">
      <h2 class="view-title">订阅管理</h2>
      <div class="header-actions">
        <label class="toggle-wrapper">
          <span class="toggle-label">解析名称</span>
          <el-switch v-model="fetchNames" @change="refreshSubscriptions" size="small" />
        </label>
        <div class="btn-group">
          <button class="action-btn" @click="showAddDialog = true">
            <k-icon name="plus" class="btn-icon" />
            <span>添加</span>
          </button>
          <button class="action-btn" @click="refreshSubscriptions">
            <k-icon name="refresh-cw" class="btn-icon" :class="{ spin: loading }" />
            <span>刷新</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span class="loading-text">Loading...</span>
    </div>

    <!-- Subscription List -->
    <div v-else class="sub-list">
      <div v-if="subscriptions.length === 0" class="empty-state">
        <k-icon name="bell-off" class="empty-icon" />
        <p class="empty-text">暂无订阅</p>
      </div>

      <div
        v-for="(sub, index) in subscriptions"
        :key="index"
        class="sub-card"
        @click="editSubscription(sub, index)"
      >
        <div class="card-header">
          <div class="sub-info">
            <div class="sub-avatar">
              <img
                v-if="fetchNames && sub.avatar"
                :src="sub.avatar"
                class="avatar-img"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <k-icon v-else :name="sub.type === 'group' ? 'users' : 'user'" class="sub-icon" />
            </div>
            <div class="sub-meta">
              <span class="sub-id">{{ sub.name || sub.id }}</span>
              <span v-if="sub.name" class="sub-id-suffix">#{{ sub.id }}</span>
            </div>
          </div>
          <span class="sub-tag" :class="sub.type">{{ sub.type === 'group' ? 'GROUP' : 'DM' }}</span>
        </div>
        <div class="card-body">
          <div class="features-grid">
            <div class="feature-item" :class="{ active: sub.features.log }">
              <span class="status-dot"></span>
              <span class="feature-name">日志推送</span>
            </div>
            <div class="feature-item" :class="{ active: sub.features.warning }">
              <span class="status-dot"></span>
              <span class="feature-name">警告通知</span>
            </div>
            <div class="feature-item" :class="{ active: sub.features.blacklist }">
              <span class="status-dot"></span>
              <span class="feature-name">黑名单</span>
            </div>
            <div class="feature-item" :class="{ active: sub.features.muteExpire }">
              <span class="status-dot"></span>
              <span class="feature-name">禁言解除</span>
            </div>
            <div class="feature-item" :class="{ active: sub.features.memberChange }">
              <span class="status-dot"></span>
              <span class="feature-name">成员变动</span>
            </div>
            <div class="feature-item" :class="{ active: sub.features.antiRecall }">
              <span class="status-dot"></span>
              <span class="feature-name">防撤回</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ editMode ? '编辑订阅' : '添加订阅' }}</h3>
          <button class="close-btn" @click="showAddDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">类型</label>
            <div class="radio-group">
              <label class="radio-item" :class="{ active: newSub.type === 'group' }">
                <input type="radio" v-model="newSub.type" value="group" />
                <span class="radio-text">GROUP</span>
              </label>
              <label class="radio-item" :class="{ active: newSub.type === 'private' }">
                <input type="radio" v-model="newSub.type" value="private" />
                <span class="radio-text">DM</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">目标 ID</label>
            <input
              v-model="newSub.id"
              type="text"
              placeholder="e.g. 123456789"
              class="form-input mono"
            />
          </div>
          <div class="form-group">
            <label class="form-label">订阅功能</label>
            <div class="checkbox-grid">
              <label class="checkbox-item" :class="{ checked: newSub.features.log }">
                <input type="checkbox" v-model="newSub.features.log" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">日志推送</span>
              </label>
              <label class="checkbox-item" :class="{ checked: newSub.features.warning }">
                <input type="checkbox" v-model="newSub.features.warning" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">警告通知</span>
              </label>
              <label class="checkbox-item" :class="{ checked: newSub.features.blacklist }">
                <input type="checkbox" v-model="newSub.features.blacklist" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">黑名单</span>
              </label>
              <label class="checkbox-item" :class="{ checked: newSub.features.muteExpire }">
                <input type="checkbox" v-model="newSub.features.muteExpire" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">禁言解除</span>
              </label>
              <label class="checkbox-item" :class="{ checked: newSub.features.memberChange }">
                <input type="checkbox" v-model="newSub.features.memberChange" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">成员变动</span>
              </label>
              <label class="checkbox-item" :class="{ checked: newSub.features.antiRecall }">
                <input type="checkbox" v-model="newSub.features.antiRecall" />
                <span class="checkbox-indicator"></span>
                <span class="checkbox-text">防撤回</span>
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <div class="footer-left">
            <k-button v-if="editMode" type="danger" @click="removeSubscription(editingIndex)">删除</k-button>
          </div>
          <div class="footer-right">
            <k-button @click="showAddDialog = false">取消</k-button>
            <k-button type="primary" @click="saveSubscription" :loading="adding">{{ editMode ? '保存' : '添加' }}</k-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Dialog -->
    <div v-if="showDeleteDialog" class="dialog-overlay" style="z-index: 1100" @click.self="showDeleteDialog = false">
      <div class="dialog-card dialog-sm">
        <div class="dialog-header">
          <h3 class="dialog-title danger">删除订阅</h3>
          <button class="close-btn" @click="showDeleteDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="warning-box">
            <k-icon name="alert-triangle" class="warning-icon" />
            <span>此操作不可撤销</span>
          </div>
          <p class="confirm-text">
            请输入目标 ID
            <code class="code-inline" @click="copySubId">{{ newSub.id }}</code>
            以确认删除
          </p>
          <div class="form-group">
            <input
              v-model="deleteConfirmId"
              type="text"
              :placeholder="newSub.id"
              class="form-input mono"
              @keyup.enter="confirmRemove"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showDeleteDialog = false">取消</k-button>
          <k-button type="danger" @click="confirmRemove" :loading="deleting" :disabled="deleteConfirmId !== newSub.id">确认删除</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { subscriptionApi } from '../api'
import type { Subscription } from '../types'

const loading = ref(false)
const adding = ref(false)
const deleting = ref(false)
const fetchNames = ref(true)
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const deleteConfirmId = ref('')
const subscriptions = ref<Subscription[]>([])
const editMode = ref(false)
const editingIndex = ref(-1)

const newSub = reactive<Subscription>({
  type: 'group',
  id: '',
  features: {
    log: true,
    warning: true,
    blacklist: true,
    muteExpire: false,
    memberChange: false,
    antiRecall: false
  }
})

const refreshSubscriptions = async () => {
  loading.value = true
  try {
    subscriptions.value = await subscriptionApi.list(fetchNames.value)
  } catch (e: any) {
    message.error(e.message || '加载订阅失败')
  } finally {
    loading.value = false
  }
}

const saveSubscription = async () => {
  if (!newSub.id.trim()) {
    message.warning('请输入目标ID')
    return
  }

  adding.value = true
  try {
    if (editMode.value) {
      await subscriptionApi.update(editingIndex.value, { ...newSub })
      message.success('更新成功')
    } else {
      await subscriptionApi.add({ ...newSub })
      message.success('添加成功')
    }
    
    showAddDialog.value = false
    await refreshSubscriptions()
  } catch (e: any) {
    message.error(e.message || (editMode.value ? '更新失败' : '添加失败'))
  } finally {
    adding.value = false
  }
}

const editSubscription = (sub: Subscription, index: number) => {
  editMode.value = true
  editingIndex.value = index
  newSub.type = sub.type
  newSub.id = sub.id
  newSub.features = { ...sub.features }
  showAddDialog.value = true
}

// 监听弹窗关闭，重置状态
import { watch } from 'vue'
watch(showAddDialog, (val) => {
  if (!val) {
    setTimeout(() => {
      editMode.value = false
      editingIndex.value = -1
      newSub.id = ''
      newSub.type = 'group'
      newSub.features = {
        log: true,
        warning: true,
        blacklist: true,
        muteExpire: false,
        memberChange: false,
        antiRecall: false
      }
    }, 300)
  }
})

const removeSubscription = (index: number) => {
  // 如果是从编辑弹窗触发，直接使用当前的 newSub.id
  // 如果是从列表卡片触发，需要先设置 id
  if (!editMode.value) {
    // 列表触发（其实列表触发也应该进入编辑模式或者直接删除，这里假设列表删除按钮逻辑）
    // 为了统一，我们暂时不支持从列表直接删除，或者在列表点击删除时，先填充 info
    const sub = subscriptions.value[index]
    newSub.id = sub.id
    editingIndex.value = index
  }
  
  deleteConfirmId.value = ''
  showDeleteDialog.value = true
}

const confirmRemove = async () => {
  if (deleteConfirmId.value !== newSub.id) return

  deleting.value = true
  try {
    await subscriptionApi.remove(editingIndex.value)
    message.success('删除成功')
    showDeleteDialog.value = false
    showAddDialog.value = false
    await refreshSubscriptions()
  } catch (e: any) {
    message.error(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

const copySubId = () => {
  navigator.clipboard.writeText(newSub.id)
  message.success('已复制目标ID')
}

onMounted(() => {
  refreshSubscriptions()
})
</script>

<style scoped>
/* ========================================
   GitHub Dimmed / Vercel Style
   ======================================== */

.subscription-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--k-color-divider);
}

.view-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 12px;
  color: var(--fg3);
}

.btn-group {
  display: flex;
  gap: 6px;
}

/* Action Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg2);
  background: var(--bg2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
  border-color: var(--fg3);
}

.action-btn:active {
  background: var(--bg1);
}

.btn-icon {
  font-size: 13px;
  opacity: 0.7;
}

.action-btn:hover .btn-icon {
  opacity: 1;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px;
  color: var(--fg3);
}

.loading-text {
  font-size: 12px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--fg3);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

/* Subscription List */
.sub-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  align-content: start;
}

/* Subscription Card */
.sub-card {
  background: var(--bg2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.sub-card:hover {
  border-color: var(--fg3);
  background: var(--bg3);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--k-color-divider);
}

.sub-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.sub-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg3);
  border: 1px solid var(--k-color-divider);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sub-icon {
  font-size: 14px;
  color: var(--fg3);
}

.sub-meta {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.sub-id {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub-id-suffix {
  font-size: 11px;
  font-family: 'SF Mono', 'Consolas', monospace;
  color: var(--fg3);
  flex-shrink: 0;
}

.sub-tag {
  font-size: 10px;
  font-weight: 500;
  font-family: 'SF Mono', 'Consolas', monospace;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg3);
  color: var(--fg3);
  border: 1px solid var(--k-color-divider);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.sub-tag.group {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.1);
  border-color: rgba(88, 166, 255, 0.2);
}

.sub-tag.private {
  color: #a371f7;
  background: rgba(163, 113, 247, 0.1);
  border-color: rgba(163, 113, 247, 0.2);
}

.card-body {
  padding: 10px 12px;
}

/* Feature Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--fg3);
  opacity: 0.5;
}

.feature-item.active {
  opacity: 1;
  color: var(--fg2);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--k-color-divider);
  flex-shrink: 0;
}

.feature-item.active .status-dot {
  background: #347d39;
}

.feature-name {
  white-space: nowrap;
}

/* Dialog Styles */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-card {
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  width: 90%;
  max-width: 440px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.dialog-card.dialog-sm {
  max-width: 380px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg2);
}

.dialog-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
}

.dialog-title.danger {
  color: var(--k-color-danger);
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
  transition: background-color 0.15s ease;
}

.close-btn:hover {
  background: var(--bg3);
  color: var(--fg1);
}

.dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--k-color-divider);
  background: var(--bg2);
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Form Elements */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--bg0);
  color: var(--fg1);
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.form-input::placeholder {
  color: var(--fg3);
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.form-input.mono {
  font-family: 'SF Mono', 'Consolas', monospace;
  letter-spacing: 0.02em;
}

/* Radio Group */
.radio-group {
  display: flex;
  gap: 8px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px 10px;
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  background: var(--bg0);
  transition: all 0.15s ease;
}

.radio-item input {
  display: none;
}

.radio-item.active {
  border-color: var(--k-color-primary);
  background: var(--k-color-primary-fade);
}

.radio-text {
  font-size: 11px;
  font-weight: 500;
  font-family: 'SF Mono', 'Consolas', monospace;
  color: var(--fg2);
  text-transform: uppercase;
}

.radio-item.active .radio-text {
  color: var(--k-color-primary-tint);
}

/* Checkbox Grid */
.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--bg0);
  border: 1px solid var(--k-color-divider);
  transition: all 0.15s ease;
}

.checkbox-item:hover {
  border-color: var(--k-color-border);
}

.checkbox-item input {
  display: none;
}

.checkbox-indicator {
  width: 14px;
  height: 14px;
  border: 1px solid var(--k-color-border);
  border-radius: 3px;
  background: var(--bg0);
  flex-shrink: 0;
  position: relative;
  transition: all 0.15s ease;
}

.checkbox-item.checked .checkbox-indicator {
  background: var(--k-color-primary);
  border-color: var(--k-color-primary);
}

.checkbox-item.checked .checkbox-indicator::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 4px;
  width: 4px;
  height: 7px;
  border: solid var(--fg0);
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.checkbox-text {
  font-size: 12px;
  color: var(--fg2);
}

.checkbox-item.checked .checkbox-text {
  color: var(--fg1);
}

/* Warning Box */
.warning-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--k-color-danger-fade);
  border: 1px solid rgba(255, 89, 90, 0.2);
  border-radius: 6px;
  color: var(--k-color-danger);
  font-size: 12px;
}

.warning-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.confirm-text {
  font-size: 13px;
  color: var(--fg2);
  margin: 0;
  line-height: 1.6;
}

.code-inline {
  background: var(--bg3);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: all;
  border: 1px solid var(--k-color-divider);
  margin: 0 2px;
  color: var(--fg1);
  transition: border-color 0.15s ease;
}

.code-inline:hover {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary-tint);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--k-color-divider);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--fg3);
}
</style>