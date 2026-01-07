<template>
  <div class="subscription-view">
    <div class="view-header">
      <h2 class="view-title">订阅管理</h2>
      <div class="header-actions">
        <div class="toggle-wrapper">
          <label>解析名称</label>
          <el-switch v-model="fetchNames" @change="refreshSubscriptions" />
        </div>
        <k-button @click="showAddDialog = true">
          <template #icon><k-icon name="plus" /></template>
          添加订阅
        </k-button>
        <k-button type="primary" @click="refreshSubscriptions">
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

    <!-- 订阅列表 -->
    <div v-else class="sub-list">
      <div v-if="subscriptions.length === 0" class="empty-state">
        <k-icon name="bell-off" class="empty-icon" />
        <p>暂无订阅</p>
      </div>

      <div
        v-for="(sub, index) in subscriptions"
        :key="index"
        class="sub-card"
        @click="editSubscription(sub, index)"
      >
        <div class="card-header">
          <div class="sub-info">
            <k-icon :name="sub.type === 'group' ? 'users' : 'user'" class="sub-icon" />
            <span class="sub-id">{{ (sub as any).name ? `${(sub as any).name} (${sub.id})` : sub.id }}</span>
            <span class="sub-tag">{{ sub.type === 'group' ? '群组' : '私聊' }}</span>
          </div>
          <div class="card-actions">
            <k-button size="small" @click.stop="editSubscription(sub, index)">
              <k-icon name="edit-2" />
            </k-button>
          </div>
        </div>
        <div class="card-body">
          <div class="features-grid">
            <div class="feature-item" :class="{ active: sub.features.log }">
              <span class="dot"></span>
              日志推送
            </div>
            <div class="feature-item" :class="{ active: sub.features.warning }">
              <span class="dot"></span>
              警告通知
            </div>
            <div class="feature-item" :class="{ active: sub.features.blacklist }">
              <span class="dot"></span>
              黑名单变动
            </div>
            <div class="feature-item" :class="{ active: sub.features.muteExpire }">
              <span class="dot"></span>
              禁言解除
            </div>
            <div class="feature-item" :class="{ active: sub.features.memberChange }">
              <span class="dot"></span>
              成员变动
            </div>
            <div class="feature-item" :class="{ active: sub.features.antiRecall }">
              <span class="dot"></span>
              防撤回推送
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑订阅弹窗 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>{{ editMode ? '编辑订阅' : '添加订阅' }}</h3>
          <button class="close-btn" @click="showAddDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>类型</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="newSub.type" value="group" />
                群组
              </label>
              <label class="radio-label">
                <input type="radio" v-model="newSub.type" value="private" />
                私聊
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>目标ID</label>
            <input
              v-model="newSub.id"
              type="text"
              placeholder="输入群号或QQ号..."
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>订阅功能</label>
            <div class="checkbox-grid">
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.log" />
                日志推送
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.warning" />
                警告通知
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.blacklist" />
                黑名单变动
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.muteExpire" />
                禁言解除
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.memberChange" />
                成员变动
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="newSub.features.antiRecall" />
                防撤回推送
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

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteDialog" class="dialog-overlay" style="z-index: 1100" @click.self="showDeleteDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>删除订阅</h3>
          <button class="close-btn" @click="showDeleteDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <p class="warning-text">警告：此操作不可撤销！</p>
          <p class="info-text">
            请输入目标ID
            <code class="code-highlight" @click="copySubId">{{ newSub.id }}</code>
            以确认删除
          </p>
          <div class="form-group">
            <label>确认目标ID</label>
            <input
              v-model="deleteConfirmId"
              type="text"
              :placeholder="'请输入 ' + newSub.id"
              class="form-input"
              @keyup.enter="confirmRemove"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showDeleteDialog = false">取消</k-button>
          <k-button type="danger" @click="confirmRemove" :loading="deleting" :disabled="deleteConfirmId !== newSub.id">删除</k-button>
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
const fetchNames = ref(false)
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
.subscription-view {
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

.sub-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  align-content: start;
}

.empty-state {
  grid-column: 1 / -1;
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
}

.sub-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
}

.sub-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--k-color-border);
  background: var(--k-color-bg-2);
}

.sub-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-icon {
  color: var(--k-color-active);
}

.sub-id {
  font-weight: 600;
  color: var(--k-color-text);
}

.sub-tag {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--k-color-bg-3);
  color: var(--k-color-text-description);
}

.card-body {
  padding: 1rem;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--k-color-text-description);
  opacity: 0.5;
}

.feature-item.active {
  opacity: 1;
  color: var(--k-color-text);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--k-color-border);
}

.feature-item.active .dot {
  background: #67c23a;
}

/* Dialog Styles */
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

.dialog-card {
  background: var(--k-card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.warning-text {
  color: #f56c6c;
  margin-bottom: 1rem;
  font-weight: 500;
}

.info-text {
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

.code-highlight {
  background: var(--k-color-bg-2);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  user-select: all;
  border: 1px solid var(--k-color-border);
  margin: 0 4px;
}

.code-highlight:hover {
  border-color: var(--k-color-active);
  color: var(--k-color-active);
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
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--k-color-border);
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

.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}
</style>