<template>
  <div class="config-view">
    <div class="view-header">
      <h2 class="view-title">群组配置</h2>
      <k-button type="primary" @click="refreshConfigs">
        <template #icon><k-icon name="refresh-cw" /></template>
        刷新
      </k-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 群组列表 -->
    <div v-else class="config-list">
      <div v-if="Object.keys(configs).length === 0" class="empty-state">
        <k-icon name="inbox" class="empty-icon" />
        <p>暂无群组配置</p>
      </div>

      <div
        v-for="(config, guildId) in configs"
        :key="guildId"
        class="config-card"
        @click="editConfig(guildId as string)"
      >
        <div class="card-header">
          <div class="guild-info">
            <k-icon name="users" class="guild-icon" />
            <span class="guild-id">{{ config.guildName ? `${config.guildName} (${guildId})` : guildId }}</span>
          </div>
          <div class="card-actions">
            <k-button size="small" @click.stop="editConfig(guildId as string)">
              <k-icon name="edit-2" />
            </k-button>
          </div>
        </div>
        <div class="card-body">
          <div class="config-item">
            <span class="item-label">欢迎消息</span>
            <span class="item-value" :class="{ enabled: config.welcomeEnabled }">
              {{ config.welcomeEnabled ? '已启用' : '已禁用' }}
            </span>
          </div>
          <div class="config-item">
            <span class="item-label">防撤回</span>
            <span class="item-value" :class="{ enabled: config.antiRecall?.enabled }">
              {{ config.antiRecall?.enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
          <div class="config-item">
            <span class="item-label">复读检测</span>
            <span class="item-value" :class="{ enabled: config.antiRepeat?.enabled }">
              {{ config.antiRepeat?.enabled ? (config.antiRepeat?.threshold + '条') : '已禁用' }}
            </span>
          </div>
          <div class="config-item">
            <span class="item-label">关键词数量</span>
            <span class="item-value">{{ config.keywords?.length || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑面板 -->
    <div v-if="showEditDialog" class="edit-overlay" @click.self="showEditDialog = false">
      <div class="edit-dialog">
        <div class="dialog-header">
          <h3>编辑群组配置 - {{ editingGuildId }}</h3>
          <button class="close-btn" @click="showEditDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div v-if="editingConfig" class="edit-form">
          <div class="form-group">
            <label>欢迎消息</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingConfig.welcomeEnabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group" v-if="editingConfig.welcomeEnabled">
            <label>欢迎语</label>
            <textarea
              v-model="editingConfig.welcomeMsg"
              rows="3"
              placeholder="输入欢迎消息..."
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label>防撤回</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingConfig.antiRecall.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>复读检测</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingConfig.antiRepeat.enabled" @change="handleRepeatSwitch" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group" v-if="editingConfig.antiRepeat.enabled">
            <label>复读阈值</label>
            <input
              type="number"
              v-model.number="editingConfig.antiRepeat.threshold"
              min="3"
              class="form-input"
              placeholder="至少3条"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showEditDialog = false">取消</k-button>
          <k-button type="primary" @click="saveConfig" :loading="saving">保存</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { configApi } from '../api'
import type { GroupConfig } from '../types'

const loading = ref(false)
const saving = ref(false)
const configs = ref<Record<string, GroupConfig>>({})
const showEditDialog = ref(false)
const editingGuildId = ref('')
const editingConfig = ref<GroupConfig | null>(null)

const refreshConfigs = async () => {
  loading.value = true
  try {
    configs.value = await configApi.list()
  } catch (e: any) {
    message.error(e.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

const editConfig = (guildId: string) => {
  editingGuildId.value = guildId
  const config = { ...configs.value[guildId] }
  
  // 初始化对象结构
  if (!config.antiRecall) config.antiRecall = { enabled: false }
  if (!config.antiRepeat) config.antiRepeat = { enabled: false, threshold: 0 }
  
  editingConfig.value = config
  showEditDialog.value = true
}

const handleRepeatSwitch = () => {
  if (!editingConfig.value?.antiRepeat) return
  
  if (editingConfig.value.antiRepeat.enabled) {
    if (!editingConfig.value.antiRepeat.threshold || editingConfig.value.antiRepeat.threshold < 3) {
      editingConfig.value.antiRepeat.threshold = 3
    }
  } else {
    editingConfig.value.antiRepeat.threshold = 0
  }
}

const saveConfig = async () => {
  if (!editingConfig.value) return

  // 验证欢迎语
  if (editingConfig.value.welcomeEnabled) {
    if (!editingConfig.value.welcomeMsg || !editingConfig.value.welcomeMsg.trim()) {
      message.error('开启欢迎语时内容不能为空')
      return
    }
  } else {
    // 关闭时自动置空
    editingConfig.value.welcomeMsg = ''
  }

  saving.value = true
  try {
    await configApi.update(editingGuildId.value, editingConfig.value)
    message.success('保存成功')
    showEditDialog.value = false
    await refreshConfigs()
  } catch (e: any) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  refreshConfigs()
})
</script>

<style scoped>
.config-view {
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

.config-list {
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

.config-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.config-card:hover {
  border-color: var(--k-color-active);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--k-color-border);
}

.guild-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guild-icon {
  color: var(--k-color-active);
}

.guild-id {
  font-weight: 600;
  color: var(--k-color-text);
}

.card-body {
  padding: 1rem;
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.config-item:not(:last-child) {
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

.item-value.enabled {
  color: #67c23a;
}

.edit-overlay {
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

.edit-dialog {
  background: var(--k-card-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
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

.edit-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.form-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.form-group label:first-child {
  font-weight: 500;
  color: var(--k-color-text);
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
}

.form-textarea:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.form-input {
  width: 100px;
  padding: 0.5rem;
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  text-align: center;
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--k-color-border);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-switch .slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .slider {
  background-color: var(--k-color-active);
}

.toggle-switch input:checked + .slider:before {
  transform: translateX(20px);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--k-color-border);
}
</style>