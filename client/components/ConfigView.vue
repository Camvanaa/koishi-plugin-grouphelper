<template>
  <div class="config-view">
    <div class="view-header">
      <div class="header-left">
        <h2 class="view-title">群组配置</h2>
        <div class="search-wrapper">
          <k-icon name="search" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索群号或群名..."
            class="search-input"
          />
        </div>
      </div>
      <div class="header-actions">
        <div class="toggle-wrapper">
          <label>解析群名</label>
          <el-switch v-model="fetchNames" @change="refreshConfigs" />
        </div>
        <k-button @click="showCreateDialog = true">
          <template #icon><k-icon name="plus" /></template>
          新建配置
        </k-button>
        <k-button @click="reloadConfigs" :loading="reloading" title="从文件重新加载配置数据">
          <template #icon><k-icon name="database" /></template>
          重载
        </k-button>
        <k-button type="primary" @click="refreshConfigs">
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

    <!-- 群组列表 -->
    <div v-else class="config-list">
      <div v-if="Object.keys(filteredConfigs).length === 0" class="empty-state">
        <k-icon name="inbox" class="empty-icon" />
        <p>{{ searchQuery ? '未找到匹配的群组' : '暂无群组配置' }}</p>
      </div>

      <div
        v-for="(config, guildId) in filteredConfigs"
        :key="guildId"
        class="config-card"
        @click="editConfig(guildId as string)"
      >
        <div class="card-header">
          <div class="guild-info">
            <img
              v-if="fetchNames && config.guildAvatar"
              :src="config.guildAvatar"
              class="guild-avatar"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
            <k-icon v-else name="users" class="guild-icon" />
            <span class="guild-id">{{ config.guildName ? `${config.guildName} (${guildId})` : guildId }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="features-grid">
            <div class="feature-item" :class="{ active: config.welcomeEnabled }">
              <span class="dot"></span>
              欢迎消息
            </div>
            <div class="feature-item" :class="{ active: config.goodbyeEnabled }">
              <span class="dot"></span>
              欢送消息
            </div>
            <div class="feature-item" :class="{ active: config.antiRecall?.enabled }">
              <span class="dot"></span>
              防撤回
            </div>
            <div class="feature-item" :class="{ active: config.antiRepeat?.enabled }">
              <span class="dot"></span>
              复读检测
            </div>
            <div class="feature-item" :class="{ active: config.dice?.enabled }">
              <span class="dot"></span>
              掷骰子
            </div>
            <div class="feature-item" :class="{ active: config.banme?.enabled }">
              <span class="dot"></span>
              Banme
            </div>
            <div class="feature-item" :class="{ active: config.openai?.enabled }">
              <span class="dot"></span>
              AI助手
            </div>
          </div>
          
          <div class="stats-row">
            <div class="stat-pill">
              <span class="stat-label">入群词</span>
              <span class="stat-value">{{ config.approvalKeywords?.length || 0 }}</span>
            </div>
            <div class="stat-pill">
              <span class="stat-label">禁言词</span>
              <span class="stat-value">{{ config.keywords?.length || 0 }}</span>
            </div>
            <div class="stat-pill" v-if="config.antiRepeat?.enabled">
              <span class="stat-label">复读阈值</span>
              <span class="stat-value">{{ config.antiRepeat.threshold }}</span>
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <k-button size="small" @click.stop="copyGuildId(guildId as string)" title="复制群号">
            <template #icon><k-icon name="copy" /></template>
            复制
          </k-button>
          <k-button size="small" @click.stop="editConfig(guildId as string)" title="编辑配置">
            <template #icon><k-icon name="edit-2" /></template>
            编辑
          </k-button>
          <k-button size="small" type="danger" @click.stop="deleteConfig(guildId as string)" title="删除配置">
            <template #icon><k-icon name="trash-2" /></template>
            删除
          </k-button>
        </div>
      </div>
    </div>

    <!-- 新建配置弹窗 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>新建群组配置</h3>
          <button class="close-btn" @click="showCreateDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>群号</label>
            <input
              v-model="newConfig.guildId"
              type="text"
              placeholder="输入群号..."
              class="form-input"
              @keyup.enter="createConfig"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showCreateDialog = false">取消</k-button>
          <k-button type="primary" @click="createConfig" :loading="creating">创建</k-button>
        </div>
      </div>
    </div>

    <!-- 编辑面板 -->
    <div v-if="showEditDialog" class="edit-overlay" @click.self="showEditDialog = false">
      <div class="edit-dialog large">
        <div class="dialog-header">
          <h3>编辑群组配置 - {{ editingGuildId }}</h3>
          <button class="close-btn" @click="showEditDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        
        <div v-if="editingConfig" class="edit-layout">
          <!-- 左侧侧边栏 -->
          <div class="edit-sidebar">
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'basic' }"
              @click="activeTab = 'basic'"
            >
              <k-icon name="settings" />
              <span>基础配置</span>
            </div>
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'plugins' }"
              @click="activeTab = 'plugins'"
            >
              <k-icon name="box" />
              <span>功能插件</span>
            </div>
          </div>

          <!-- 右侧内容区 -->
          <div class="edit-content">
            <!-- 基础配置 -->
            <div v-show="activeTab === 'basic'" class="config-section">
              <div class="section-title">入群欢迎</div>
              <div class="form-group">
                <label>启用欢迎消息</label>
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
                  placeholder="输入欢迎消息... ({at}提新成员)"
                  class="form-textarea"
                ></textarea>
              </div>

              <div class="section-title" style="margin-top: 2rem;">入群验证</div>
              <div class="form-group">
                <label>自动拒绝</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="autoReject" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="form-group">
                <label>拒绝回复</label>
                <el-input v-model="editingConfig.reject" placeholder="拒绝时的提示消息" />
              </div>
              <div class="form-group">
                <label>验证关键词</label>
                <textarea
                  v-model="editingApprovalKeywords"
                  rows="2"
                  placeholder="多个关键词用逗号分隔"
                  class="form-textarea"
                ></textarea>
              </div>
              <div class="form-group">
                <label>等级限制</label>
                <el-input-number v-model="editingConfig.levelLimit" :min="0" style="width: 100%" />
              </div>
               <div class="form-group">
                <label>退群冷却(天)</label>
                <el-input-number v-model="editingConfig.leaveCooldown" :min="0" style="width: 100%" />
              </div>

              <div class="section-title" style="margin-top: 2rem;">违规处理 (关键词/禁言)</div>
              <div class="form-group">
                <label>禁言关键词</label>
                <textarea
                  v-model="editingForbiddenKeywords"
                  rows="2"
                  placeholder="多个关键词用逗号分隔"
                  class="form-textarea"
                ></textarea>
              </div>
              <div class="form-group">
                <label>自动撤回</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="editingConfig.forbidden.autoDelete" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="form-group">
                <label>自动禁言</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="editingConfig.forbidden.autoBan" />
                  <span class="slider"></span>
                </label>
              </div>
               <div class="form-group">
                <label>自动踢出</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="editingConfig.forbidden.autoKick" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="form-group">
                <label>触发回显</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="editingConfig.forbidden.echo" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="form-group">
                <label>禁言时长(ms)</label>
                 <el-input-number v-model="editingConfig.forbidden.muteDuration" :min="0" :step="1000" style="width: 100%" />
              </div>

              <div class="section-title" style="margin-top: 2rem;">退群欢送</div>
              <div class="form-group">
                <label>启用欢送消息</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="editingConfig.goodbyeEnabled" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="form-group" v-if="editingConfig.goodbyeEnabled">
                <label>欢送语</label>
                <textarea
                  v-model="editingConfig.goodbyeMsg"
                  rows="3"
                  placeholder="输入欢送消息... ({at}提退群成员)"
                  class="form-textarea"
                ></textarea>
              </div>

            </div>

            <!-- 功能插件 -->
            <div v-show="activeTab === 'plugins'" class="config-section">

              <!-- 防撤回 -->
              <div class="plugin-card">
                <div class="plugin-header" @click="togglePlugin('antiRecall')">
                  <div class="plugin-title">
                    <k-icon name="eye" />
                    <span>防撤回</span>
                  </div>
                  <div class="plugin-status">
                    <label class="toggle-switch" @click.stop>
                      <input type="checkbox" v-model="editingConfig.antiRecall.enabled" />
                      <span class="slider"></span>
                    </label>
                    <k-icon :name="expandedPlugins['antiRecall'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['antiRecall']">
                   <div class="form-group">
                    <label>保存天数</label>
                    <el-input-number v-model="editingConfig.antiRecall.retentionDays" :min="1" :max="30" placeholder="默认使用全局设置" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>最大记录数</label>
                    <el-input-number v-model="editingConfig.antiRecall.maxRecordsPerUser" :min="10" :max="200" placeholder="默认使用全局设置" style="width: 100%" />
                  </div>
                </div>
              </div>
              
              <!-- 复读检测 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('repeat')">
                  <div class="plugin-title">
                    <k-icon name="repeat" />
                    <span>复读检测</span>
                  </div>
                  <div class="plugin-status">
                    <label class="toggle-switch" @click.stop>
                      <input type="checkbox" v-model="editingConfig.antiRepeat.enabled" @change="handleRepeatSwitch" />
                      <span class="slider"></span>
                    </label>
                    <k-icon :name="expandedPlugins['repeat'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['repeat']">
                   <div class="form-group">
                    <label>复读阈值</label>
                    <el-input-number
                      v-model="editingConfig.antiRepeat.threshold"
                      :min="3"
                      placeholder="至少3条"
                      style="width: 100%"
                    />
                  </div>
                </div>
              </div>

              <!-- 掷骰子 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('dice')">
                  <div class="plugin-title">
                    <k-icon name="dice" />
                    <span>掷骰子</span>
                  </div>
                  <div class="plugin-status">
                    <label class="toggle-switch" @click.stop>
                      <input type="checkbox" v-model="editingConfig.dice.enabled" />
                      <span class="slider"></span>
                    </label>
                    <k-icon :name="expandedPlugins['dice'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['dice']">
                   <div class="form-group">
                    <label>长度限制</label>
                    <el-input-number v-model="editingConfig.dice.lengthLimit" :min="10" style="width: 100%" />
                  </div>
                </div>
              </div>

              <!-- BanMe -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('banme')">
                  <div class="plugin-title">
                    <k-icon name="slash" />
                    <span>Banme</span>
                  </div>
                  <div class="plugin-status">
                    <label class="toggle-switch" @click.stop>
                      <input type="checkbox" v-model="editingConfig.banme.enabled" />
                      <span class="slider"></span>
                    </label>
                    <k-icon :name="expandedPlugins['banme'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['banme']">
                   <div class="form-group">
                    <label>自动检测</label>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="editingConfig.banme.autoBan" />
                      <span class="slider"></span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label>最小时长(s)</label>
                    <el-input-number v-model="editingConfig.banme.baseMin" :min="1" style="width: 100%" />
                  </div>
                   <div class="form-group">
                    <label>最大时长(m)</label>
                    <el-input-number v-model="editingConfig.banme.baseMax" :min="1" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>增长系数</label>
                    <el-input-number v-model="editingConfig.banme.growthRate" :min="0" style="width: 100%" />
                  </div>
                  
                  <div class="divider-text">金卡系统</div>
                  
                  <div class="form-group">
                    <label>启用金卡</label>
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="editingConfig.banme.jackpot.enabled" />
                      <span class="slider"></span>
                    </label>
                  </div>
                  <div class="form-group">
                    <label>基础概率</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.baseProb" :min="0" :max="1" :step="0.001" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>软保底(抽)</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.softPity" :min="0" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>硬保底(抽)</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.hardPity" :min="0" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>UP时长</label>
                    <el-input v-model="editingConfig.banme.jackpot.upDuration" placeholder="如 24h" />
                  </div>
                  <div class="form-group">
                    <label>歪时长</label>
                    <el-input v-model="editingConfig.banme.jackpot.loseDuration" placeholder="如 12h" />
                  </div>
                </div>
              </div>

              <!-- AI 对话 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('ai')">
                  <div class="plugin-title">
                    <k-icon name="bot" />
                    <span>AI 助手</span>
                  </div>
                  <div class="plugin-status">
                    <label class="toggle-switch" @click.stop>
                      <input type="checkbox" v-model="editingConfig.openai.enabled" />
                      <span class="slider"></span>
                    </label>
                    <k-icon :name="expandedPlugins['ai'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['ai']">
                  <div class="form-group">
                    <label>系统提示词</label>
                    <textarea
                      v-model="editingConfig.openai.systemPrompt"
                      rows="3"
                      class="form-textarea"
                    ></textarea>
                  </div>
                   <div class="form-group">
                    <label>翻译提示词</label>
                    <textarea
                      v-model="editingConfig.openai.translatePrompt"
                      rows="3"
                      class="form-textarea"
                    ></textarea>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <div class="footer-right">
            <k-button @click="showEditDialog = false">取消</k-button>
            <k-button type="primary" @click="saveConfig" :loading="saving">保存</k-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteDialog" class="dialog-overlay" style="z-index: 1100" @click.self="showDeleteDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>删除群组配置</h3>
          <button class="close-btn" @click="showDeleteDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <p class="warning-text">警告：此操作不可撤销！</p>
          <p class="info-text">
            请输入群号
            <code class="code-highlight" @click="() => copyGuildId()">{{ editingGuildId }}</code>
            以确认删除
          </p>
          <div class="form-group">
            <label>确认群号</label>
            <input
              v-model="deleteConfirmId"
              type="text"
              :placeholder="'请输入 ' + editingGuildId"
              class="form-input"
              @keyup.enter="confirmDelete"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showDeleteDialog = false">取消</k-button>
          <k-button type="danger" @click="confirmDelete" :loading="deleting" :disabled="deleteConfirmId !== editingGuildId">删除</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from '@koishijs/client'
import { configApi } from '../api'
import type { GroupConfig } from '../types'

const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const reloading = ref(false)
const fetchNames = ref(true)
const searchQuery = ref('')
const configs = ref<Record<string, GroupConfig>>({})

// 过滤后的配置列表
const filteredConfigs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return configs.value

  const result: Record<string, GroupConfig> = {}
  for (const [guildId, config] of Object.entries(configs.value)) {
    const guildName = config.guildName?.toLowerCase() || ''
    if (guildId.includes(query) || guildName.includes(query)) {
      result[guildId] = config
    }
  }
  return result
})
const showEditDialog = ref(false)
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const newConfig = ref({ guildId: '' })
const deleteConfirmId = ref('')
const editingGuildId = ref('')
const editingConfig = ref<GroupConfig | null>(null)
const editingApprovalKeywords = ref('')
const editingForbiddenKeywords = ref('')
const activeTab = ref('basic')
const expandedPlugins = ref<Record<string, boolean>>({})

// 自动拒绝 (Boolean <-> String 'true'/'false')
const autoReject = computed({
  get: () => editingConfig.value?.auto === 'true',
  set: (val) => { if (editingConfig.value) editingConfig.value.auto = val ? 'true' : 'false' }
})

const togglePlugin = (key: string) => {
  expandedPlugins.value[key] = !expandedPlugins.value[key]
}

const refreshConfigs = async () => {
  loading.value = true
  try {
    configs.value = await configApi.list(fetchNames.value)
  } catch (e: any) {
    message.error(e.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

const reloadConfigs = async () => {
  reloading.value = true
  try {
    const result = await configApi.reload()
    message.success(`已重新加载 ${result.count} 条配置`)
    await refreshConfigs()
  } catch (e: any) {
    message.error(e.message || '重新加载失败')
  } finally {
    reloading.value = false
  }
}

const editConfig = (guildId: string) => {
  editingGuildId.value = guildId
  const config = { ...configs.value[guildId] }
  
  // 初始化默认值
  if (!config.antiRecall) config.antiRecall = { enabled: false }
  if (!config.antiRepeat) config.antiRepeat = { enabled: false, threshold: 0 }
  if (!config.forbidden) config.forbidden = { autoDelete: false, autoBan: false, autoKick: false, muteDuration: 600000 }
  if (!config.dice) config.dice = { enabled: true, lengthLimit: 1000 }
  if (!config.banme) config.banme = {
    enabled: true, baseMin: 1, baseMax: 30, growthRate: 30,
    jackpot: { enabled: true, baseProb: 0.006, softPity: 73, hardPity: 89, upDuration: '24h', loseDuration: '12h' }
  }
  if (!config.openai) config.openai = { enabled: true }

  editingConfig.value = config
  editingApprovalKeywords.value = (config.approvalKeywords || []).join(', ')
  editingForbiddenKeywords.value = (config.keywords || []).join(', ')
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

  // 处理关键词
  editingConfig.value.approvalKeywords = editingApprovalKeywords.value
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(s => s)
  
  editingConfig.value.keywords = editingForbiddenKeywords.value
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(s => s)

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

const createConfig = async () => {
  const guildId = newConfig.value.guildId.trim()
  if (!guildId) {
    message.warning('请输入群号')
    return
  }

  creating.value = true
  try {
    await configApi.create(guildId)
    message.success('创建成功')
    showCreateDialog.value = false
    newConfig.value.guildId = ''
    await refreshConfigs()
    editConfig(guildId)
  } catch (e: any) {
    message.error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const deleteConfig = (guildId?: string) => {
  if (guildId) {
    editingGuildId.value = guildId
  }
  deleteConfirmId.value = ''
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (deleteConfirmId.value !== editingGuildId.value) return

  deleting.value = true
  try {
    await configApi.delete(editingGuildId.value)
    message.success('删除成功')
    showDeleteDialog.value = false
    showEditDialog.value = false
    await refreshConfigs()
  } catch (e: any) {
    message.error(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

const copyGuildId = (guildId?: string) => {
  const id = guildId || editingGuildId.value
  navigator.clipboard.writeText(id)
  message.success('已复制群号')
}

onMounted(() => {
  refreshConfigs()
})
</script>

<style scoped>
/* ========== 使用 Koishi 全局 CSS 变量 ========== */
.config-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-family);
}

/* ========== Header ========== */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--k-color-divider);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--fg3);
  margin-right: 0.75rem;
  padding-right: 0.75rem;
  border-right: 1px solid var(--k-color-divider);
}

.toggle-wrapper label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.view-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.25px;
}

/* ========== Header Left & Search ========== */
.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  margin-top: 10px;
  transition: border-color 0.15s ease;
}

.search-wrapper:focus-within {
  border-color: var(--k-color-primary);
}

.search-icon {
  color: var(--fg3);
  font-size: 14px;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  color: var(--fg1);
  font-size: 0.75rem;
  width: 140px;
  outline: none;
  font-family: var(--font-family);
}

.search-input::placeholder {
  color: var(--fg3);
}

/* ========== Header Buttons Override ========== */
.header-actions :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  border: 1px solid var(--k-color-divider);
  background: var(--bg3);
  color: var(--fg2);
  font-weight: 500;
  transition: all 0.15s ease;
}

.header-actions :deep(.k-button:hover) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.header-actions :deep(.k-button.primary),
.header-actions :deep(.k-button[type="primary"]) {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary-tint);
  color: var(--k-color-primary);
}

.header-actions :deep(.k-button.primary:hover),
.header-actions :deep(.k-button[type="primary"]:hover) {
  background: rgba(116, 89, 255, 0.25);
  border-color: rgba(116, 89, 255, 0.5);
}

.header-actions :deep(.k-icon) {
  font-size: 14px;
}

/* ========== El-Switch Override ========== */
.toggle-wrapper :deep(.el-switch) {
  --el-switch-on-color: var(--k-color-primary);
  --el-switch-off-color: var(--bg3);
  --el-switch-border-color: var(--k-color-border);
  height: 18px;
}

.toggle-wrapper :deep(.el-switch__core) {
  min-width: 32px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid var(--k-color-border);
}

.toggle-wrapper :deep(.el-switch__core .el-switch__action) {
  width: 14px;
  height: 14px;
}

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

.config-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
  align-content: start;
}

.empty-state {
  grid-column: 1 / -1;
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
}

/* ========== Config Card ========== */
.config-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  animation: fadeIn 0.2s ease-out backwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.config-card:hover {
  border-color: var(--fg3);
  background: var(--bg3);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--k-color-divider);
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--k-color-divider);
  background: var(--bg1);
}

/* Card Footer Button Override */
.card-footer :deep(.k-button) {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--k-color-border);
  background: transparent;
  color: var(--fg3);
  font-weight: 500;
  transition: all 0.15s ease;
}

.card-footer :deep(.k-button:hover) {
  border-color: var(--fg3);
  color: var(--fg1);
  background: var(--bg3);
}

.card-footer :deep(.k-button[type="danger"]) {
  color: var(--k-color-danger);
  border-color: transparent;
}

.card-footer :deep(.k-button[type="danger"]:hover) {
  background: rgba(248, 81, 73, 0.15);
  border-color: var(--k-color-danger);
}

.card-footer :deep(.k-icon) {
  font-size: 12px;
}

.guild-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.guild-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.guild-icon {
  color: var(--fg2);
  font-size: 20px;
}

.guild-id {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.375rem;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--fg3);
  padding: 2px 0;
}

.feature-item.active {
  color: var(--fg2);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--k-color-border);
  flex-shrink: 0;
}

.feature-item.active .dot {
  background: var(--k-color-success);
}

.stats-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  background: var(--bg1);
  border: 1px solid var(--k-color-divider);
  border-radius: 3px;
  padding: 2px 6px;
  gap: 4px;
}

.stat-label {
  color: var(--fg3);
}

.stat-value {
  font-weight: 600;
  color: var(--fg1);
  font-family: var(--font-family-code);
}

/* ========== Dialog & Overlay ========== */
.edit-overlay, .dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.edit-dialog {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  width: 90%;
  max-width: 380px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.15s ease-out;
}

.dialog-body {
  padding: 1rem 1.25rem;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
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

.edit-dialog.large {
  max-width: 760px;
  height: 75vh;
  border-radius: 8px;
  animation: fadeIn 0.15s ease-out;
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
  border-radius: 6px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.close-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
}

/* ========== Edit Layout ========== */
.edit-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.edit-sidebar {
  width: 140px;
  border-right: 1px solid var(--k-color-border);
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg1);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--fg2);
  font-size: 0.8125rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.sidebar-item:hover {
  background: var(--bg3);
  color: var(--fg1);
}

.sidebar-item.active {
  background: var(--bg3);
  color: var(--k-color-primary);
  font-weight: 500;
  border-left: 2px solid var(--k-color-primary);
  margin-left: -2px;
  padding-left: calc(0.75rem - 2px);
}

.edit-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  background: var(--k-card-bg);
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
  padding-left: 0.5rem;
  border-left: 2px solid var(--k-color-success);
}

.divider {
  height: 1px;
  background: var(--k-color-divider);
  margin: 0.75rem 0;
}

/* ========== Plugin Card ========== */
.plugin-card {
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--k-card-bg);
  transition: border-color 0.15s ease;
}

.plugin-card:hover {
  border-color: var(--fg3);
}

.plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--bg1);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.plugin-header:hover {
  background: var(--bg3);
}

.plugin-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--fg1);
}

.plugin-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--fg3);
}

.plugin-body {
  padding: 0.75rem;
  border-top: 1px solid var(--k-color-divider);
  background: var(--k-card-bg);
}

/* ========== Form Elements ========== */
.form-group {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 0.375rem 0;
}

.form-group label:first-child {
  width: 100px;
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg2);
}

.form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  resize: vertical;
  transition: border-color 0.15s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.form-textarea::placeholder {
  color: var(--fg3);
}

/* ========== El-Input Override ========== */
.config-section :deep(.el-input__wrapper),
.config-section :deep(.el-input-number),
.plugin-body :deep(.el-input__wrapper),
.plugin-body :deep(.el-input-number) {
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  box-shadow: none;
  transition: border-color 0.15s ease;
}

.config-section :deep(.el-input__wrapper:hover),
.config-section :deep(.el-input-number:hover),
.plugin-body :deep(.el-input__wrapper:hover),
.plugin-body :deep(.el-input-number:hover) {
  border-color: var(--fg3);
}

.config-section :deep(.el-input__wrapper.is-focus),
.plugin-body :deep(.el-input__wrapper.is-focus) {
  border-color: var(--k-color-primary) !important;
}

.config-section :deep(.el-input__inner),
.plugin-body :deep(.el-input__inner) {
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
}

.config-section :deep(.el-input__inner::placeholder),
.plugin-body :deep(.el-input__inner::placeholder) {
  color: var(--fg3);
}

.config-section :deep(.el-input-number__decrease),
.config-section :deep(.el-input-number__increase),
.plugin-body :deep(.el-input-number__decrease),
.plugin-body :deep(.el-input-number__increase) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg2);
}

.config-section :deep(.el-input-number__decrease:hover),
.config-section :deep(.el-input-number__increase:hover),
.plugin-body :deep(.el-input-number__decrease:hover),
.plugin-body :deep(.el-input-number__increase:hover) {
  color: var(--k-color-primary);
}

/* ========== Toggle Switch ========== */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
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
  background-color: var(--bg3);
  border: 1px solid var(--k-color-border);
  transition: background-color 0.15s ease, border-color 0.15s ease;
  border-radius: 10px;
}

.toggle-switch .slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: var(--fg2);
  transition: transform 0.15s ease, background-color 0.15s ease;
  border-radius: 50%;
}

.toggle-switch input:checked + .slider {
  background-color: var(--k-color-primary);
  border-color: var(--k-color-primary);
}

.toggle-switch input:checked + .slider:before {
  transform: translateX(16px);
  background-color: #fff;
}

.divider-text {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0.75rem 0 0.375rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--k-color-divider);
}

/* ========== Dialog Footer ========== */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--k-color-border);
  background: var(--bg1);
}

.footer-left {
  display: flex;
  gap: 6px;
}

.footer-right {
  display: flex;
  gap: 6px;
}

/* Dialog Footer Button Override */
.dialog-footer :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
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

.dialog-footer :deep(.k-button[type="danger"]) {
  background: rgba(248, 81, 73, 0.15);
  border-color: rgba(248, 81, 73, 0.3);
  color: var(--k-color-danger);
}

.dialog-footer :deep(.k-button[type="danger"]:hover) {
  background: rgba(248, 81, 73, 0.25);
  border-color: rgba(248, 81, 73, 0.5);
}

.dialog-footer :deep(.k-button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ========== Scrollbar ========== */
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
  background-color: var(--fg3);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ========== Delete Dialog ========== */
.warning-text {
  color: var(--k-color-danger);
  margin-bottom: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.info-text {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  color: var(--fg2);
}

.code-highlight {
  background: var(--bg1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  user-select: all;
  border: 1px solid var(--k-color-border);
  color: var(--fg1);
  transition: border-color 0.15s ease, color 0.15s ease;
}

.code-highlight:hover {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
</style>
