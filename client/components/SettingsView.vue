<template>
  <div class="settings-view">
    <div class="view-header">
      <h2 class="view-title">全局设置</h2>
      <div class="header-actions">
        <k-button type="primary" @click="saveSettings" :loading="saving">
          <template #icon><k-icon name="save" /></template>
          保存设置
        </k-button>
        <k-button @click="resetSettings" :loading="resetting">
          <template #icon><k-icon name="refresh-ccw" /></template>
          恢复默认
        </k-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 设置内容 -->
    <div v-else class="settings-content">
      <!-- 左侧侧边栏 -->
      <div class="settings-sidebar">
        <div
          v-for="section in sections"
          :key="section.id"
          class="sidebar-item"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <k-icon :name="section.icon" />
          <span>{{ section.label }}</span>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="settings-main">
        <!-- 警告设置 -->
        <div v-show="activeSection === 'warn'" class="config-section">
          <div class="section-header">
            <h3>警告设置</h3>
            <p class="section-desc">配置警告次数限制和自动禁言规则</p>
          </div>
          <div class="form-group">
            <label>警告次数限制</label>
            <el-input-number v-model="settings.warnLimit" :min="1" :max="99" />
            <span class="form-hint">达到此次数后触发自动禁言</span>
          </div>
          <div class="form-group">
            <label>禁言时长表达式</label>
            <el-input v-model="settings.banTimes.expression" placeholder="{t}^2h" />
            <span class="form-hint">{t}代表警告次数，如 {t}^2h 表示警告次数的平方小时</span>
          </div>
        </div>

        <!-- 禁言关键词 -->
        <div v-show="activeSection === 'forbidden'" class="config-section">
          <div class="section-header">
            <h3>禁言关键词</h3>
            <p class="section-desc">配置全局禁言关键词和自动处理规则</p>
          </div>
          <div class="form-group">
            <label>自动撤回</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.forbidden.autoDelete" />
              <span class="slider"></span>
            </label>
            <span class="form-hint">自动撤回包含禁言关键词的消息</span>
          </div>
          <div class="form-group">
            <label>自动禁言</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.forbidden.autoBan" />
              <span class="slider"></span>
            </label>
            <span class="form-hint">自动禁言发送禁言关键词的用户</span>
          </div>
          <div class="form-group">
            <label>自动踢出</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.forbidden.autoKick" />
              <span class="slider"></span>
            </label>
            <span class="form-hint">自动踢出发送禁言关键词的用户</span>
          </div>
          <div class="form-group">
            <label>禁言时长(ms)</label>
            <el-input-number v-model="settings.forbidden.muteDuration" :min="0" :step="60000" />
          </div>
          <div class="form-group full-width">
            <label>禁言关键词</label>
            <textarea
              v-model="forbiddenKeywordsText"
              rows="4"
              placeholder="每行一个关键词"
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <!-- 入群关键词 -->
        <div v-show="activeSection === 'keywords'" class="config-section">
          <div class="section-header">
            <h3>入群审核</h3>
            <p class="section-desc">配置入群审核关键词</p>
          </div>
          <div class="form-group full-width">
            <label>审核关键词</label>
            <textarea
              v-model="keywordsText"
              rows="6"
              placeholder="每行一个关键词"
              class="form-textarea"
            ></textarea>
            <span class="form-hint">入群申请需要包含这些关键词才能通过审核</span>
          </div>
        </div>

        <!-- 掷骰子 -->
        <div v-show="activeSection === 'dice'" class="config-section">
          <div class="section-header">
            <h3>掷骰子</h3>
            <p class="section-desc">配置掷骰子功能</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.dice.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>结果长度限制</label>
            <el-input-number v-model="settings.dice.lengthLimit" :min="100" :max="10000" />
            <span class="form-hint">超过此长度的结果将无法显示</span>
          </div>
        </div>

        <!-- Banme -->
        <div v-show="activeSection === 'banme'" class="config-section">
          <div class="section-header">
            <h3>Banme 自助禁言</h3>
            <p class="section-desc">配置自助禁言功能和金卡系统</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.banme.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>最小时长(秒)</label>
            <el-input-number v-model="settings.banme.baseMin" :min="1" />
          </div>
          <div class="form-group">
            <label>最大时长(分钟)</label>
            <el-input-number v-model="settings.banme.baseMax" :min="1" />
          </div>
          <div class="form-group">
            <label>递增系数</label>
            <el-input-number v-model="settings.banme.growthRate" :min="0" />
            <span class="form-hint">越大增长越快</span>
          </div>
          <div class="form-group">
            <label>自动禁言匹配</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.banme.autoBan" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="divider-text">金卡系统</div>
          <div class="form-group">
            <label>启用金卡</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.banme.jackpot.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>基础概率</label>
            <el-input-number v-model="settings.banme.jackpot.baseProb" :min="0" :max="1" :step="0.001" :precision="4" />
          </div>
          <div class="form-group">
            <label>软保底(抽)</label>
            <el-input-number v-model="settings.banme.jackpot.softPity" :min="0" />
          </div>
          <div class="form-group">
            <label>硬保底(抽)</label>
            <el-input-number v-model="settings.banme.jackpot.hardPity" :min="0" />
          </div>
          <div class="form-group">
            <label>UP奖励时长</label>
            <el-input v-model="settings.banme.jackpot.upDuration" placeholder="24h" />
          </div>
          <div class="form-group">
            <label>歪奖励时长</label>
            <el-input v-model="settings.banme.jackpot.loseDuration" placeholder="12h" />
          </div>
        </div>

        <!-- 好友申请 -->
        <div v-show="activeSection === 'friendRequest'" class="config-section">
          <div class="section-header">
            <h3>好友申请</h3>
            <p class="section-desc">配置好友申请验证</p>
          </div>
          <div class="form-group">
            <label>启用验证</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.friendRequest.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>拒绝消息</label>
            <el-input v-model="settings.friendRequest.rejectMessage" placeholder="请输入正确的验证信息" />
          </div>
          <div class="form-group full-width">
            <label>通过关键词</label>
            <textarea
              v-model="friendKeywordsText"
              rows="4"
              placeholder="每行一个关键词"
              class="form-textarea"
            ></textarea>
          </div>
        </div>

        <!-- 入群邀请 -->
        <div v-show="activeSection === 'guildRequest'" class="config-section">
          <div class="section-header">
            <h3>入群邀请</h3>
            <p class="section-desc">配置入群邀请处理</p>
          </div>
          <div class="form-group">
            <label>自动同意</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.guildRequest.enabled" />
              <span class="slider"></span>
            </label>
            <span class="form-hint">启用时同意所有邀请，禁用时拒绝所有</span>
          </div>
          <div class="form-group">
            <label>拒绝消息</label>
            <el-input v-model="settings.guildRequest.rejectMessage" placeholder="暂不接受入群邀请" />
          </div>
        </div>

        <!-- 精华消息 -->
        <div v-show="activeSection === 'essence'" class="config-section">
          <div class="section-header">
            <h3>精华消息</h3>
            <p class="section-desc">配置精华消息功能</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.setEssenceMsg.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>所需权限等级</label>
            <el-input-number v-model="settings.setEssenceMsg.authority" :min="1" :max="5" />
          </div>
        </div>

        <!-- 头衔设置 -->
        <div v-show="activeSection === 'title'" class="config-section">
          <div class="section-header">
            <h3>头衔设置</h3>
            <p class="section-desc">配置头衔功能</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.setTitle.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>所需权限等级</label>
            <el-input-number v-model="settings.setTitle.authority" :min="1" :max="5" />
          </div>
          <div class="form-group">
            <label>头衔最大长度</label>
            <el-input-number v-model="settings.setTitle.maxLength" :min="1" :max="50" />
          </div>
        </div>

        <!-- 反复读 -->
        <div v-show="activeSection === 'antiRepeat'" class="config-section">
          <div class="section-header">
            <h3>反复读</h3>
            <p class="section-desc">配置反复读检测功能</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.antiRepeat.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>触发阈值</label>
            <el-input-number v-model="settings.antiRepeat.threshold" :min="2" :max="20" />
            <span class="form-hint">超过该次数将撤回除第一条外的所有复读消息</span>
          </div>
        </div>

        <!-- 防撤回 -->
        <div v-show="activeSection === 'antiRecall'" class="config-section">
          <div class="section-header">
            <h3>防撤回</h3>
            <p class="section-desc">配置防撤回功能</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.antiRecall.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>保存天数</label>
            <el-input-number v-model="settings.antiRecall.retentionDays" :min="1" :max="30" />
          </div>
          <div class="form-group">
            <label>每用户最大记录数</label>
            <el-input-number v-model="settings.antiRecall.maxRecordsPerUser" :min="10" :max="200" />
          </div>
          <div class="form-group">
            <label>显示原消息时间</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.antiRecall.showOriginalTime" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- AI 功能 -->
        <div v-show="activeSection === 'openai'" class="config-section">
          <div class="section-header">
            <h3>AI 功能</h3>
            <p class="section-desc">配置 OpenAI 兼容 API</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.openai.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>启用对话</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.openai.chatEnabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>启用翻译</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.openai.translateEnabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>API 密钥</label>
            <el-input v-model="settings.openai.apiKey" type="password" show-password placeholder="sk-..." />
          </div>
          <div class="form-group">
            <label>API 地址</label>
            <el-input v-model="settings.openai.apiUrl" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-group">
            <label>模型名称</label>
            <el-input v-model="settings.openai.model" placeholder="gpt-3.5-turbo" />
          </div>
          <div class="form-group">
            <label>最大Token数</label>
            <el-input-number v-model="settings.openai.maxTokens" :min="256" :max="32768" />
          </div>
          <div class="form-group">
            <label>温度</label>
            <el-input-number v-model="settings.openai.temperature" :min="0" :max="2" :step="0.1" :precision="1" />
          </div>
          <div class="form-group">
            <label>上下文消息数</label>
            <el-input-number v-model="settings.openai.contextLimit" :min="1" :max="50" />
          </div>
          <div class="form-group full-width">
            <label>系统提示词</label>
            <textarea
              v-model="settings.openai.systemPrompt"
              rows="4"
              class="form-textarea"
              placeholder="你是一个有帮助的AI助手..."
            ></textarea>
          </div>
          <div class="form-group full-width">
            <label>翻译提示词</label>
            <textarea
              v-model="settings.openai.translatePrompt"
              rows="4"
              class="form-textarea"
              placeholder="翻译提示词..."
            ></textarea>
          </div>
        </div>

        <!-- 举报功能 -->
        <div v-show="activeSection === 'report'" class="config-section">
          <div class="section-header">
            <h3>举报功能</h3>
            <p class="section-desc">配置AI辅助举报审核</p>
          </div>
          <div class="form-group">
            <label>启用功能</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.report.enabled" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>所需权限等级</label>
            <el-input-number v-model="settings.report.authority" :min="1" :max="5" />
          </div>
          <div class="form-group">
            <label>自动处理</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.report.autoProcess" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label>举报时间限制(分)</label>
            <el-input-number v-model="settings.report.maxReportTime" :min="0" />
            <span class="form-hint">0表示不限制</span>
          </div>
          <div class="form-group">
            <label>冷却时间(分)</label>
            <el-input-number v-model="settings.report.maxReportCooldown" :min="0" />
          </div>
          <div class="form-group">
            <label>免冷却权限等级</label>
            <el-input-number v-model="settings.report.minAuthorityNoLimit" :min="1" :max="5" />
          </div>
          <div class="form-group full-width">
            <label>默认审核提示词</label>
            <textarea
              v-model="settings.report.defaultPrompt"
              rows="6"
              class="form-textarea"
              placeholder="AI审核提示词..."
            ></textarea>
          </div>
          <div class="form-group full-width">
            <label>带上下文审核提示词</label>
            <textarea
              v-model="settings.report.contextPrompt"
              rows="6"
              class="form-textarea"
              placeholder="带上下文的AI审核提示词..."
            ></textarea>
          </div>
        </div>

        <!-- 缓存管理 -->
        <div v-show="activeSection === 'cache'" class="config-section">
          <div class="section-header">
            <h3>缓存管理</h3>
            <p class="section-desc">管理群组、用户和成员信息缓存，提升页面加载速度</p>
          </div>

          <div v-if="cacheLoading" class="loading-state">
            <k-icon name="loader" class="spin" />
            <span>加载中...</span>
          </div>

          <div v-else-if="cacheStats" class="cache-stats">
            <div class="stat-row">
              <span class="stat-label">群组缓存:</span>
              <span class="stat-value">{{ cacheStats.guilds }} 个</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">用户缓存:</span>
              <span class="stat-value">{{ cacheStats.users }} 个</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">成员缓存:</span>
              <span class="stat-value">{{ cacheStats.members }} 个</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">最后刷新:</span>
              <span class="stat-value">{{ cacheStats.lastFullRefreshTime }}</span>
            </div>
          </div>

          <div class="cache-actions">
            <k-button type="primary" @click="refreshCache" :loading="cacheRefreshing">
              <template #icon><k-icon name="refresh-cw" /></template>
              强制刷新缓存
            </k-button>
            <k-button @click="clearCache">
              <template #icon><k-icon name="trash-2" /></template>
              清空缓存
            </k-button>
            <k-button @click="loadCacheStats">
              <template #icon><k-icon name="bar-chart-2" /></template>
              重新加载统计
            </k-button>
          </div>

          <div class="cache-info">
            <k-icon name="info" />
            <div>
              <p><strong>关于缓存:</strong></p>
              <ul>
                <li>缓存会在插件启动时自动预热，收集所有需要的群组和用户信息</li>
                <li>缓存有效期为 7 天，过期后会自动从 Bot 重新获取最新信息</li>
                <li>刷新缓存会强制更新所有已缓存的信息，适合在群组或用户信息变更后使用</li>
                <li>清空缓存会删除所有缓存数据，下次访问时会重新获取</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { message } from '@koishijs/client'
import { settingsApi, cacheApi, type CacheStats } from '../api'

// 默认配置结构
const defaultSettings = {
  keywords: [],
  warnLimit: 3,
  banTimes: { expression: '{t}^2h' },
  forbidden: {
    autoDelete: false,
    autoBan: false,
    autoKick: false,
    muteDuration: 600000,
    keywords: []
  },
  dice: { enabled: true, lengthLimit: 1000 },
  banme: {
    enabled: true,
    baseMin: 1,
    baseMax: 30,
    growthRate: 30,
    autoBan: false,
    jackpot: {
      enabled: true,
      baseProb: 0.006,
      softPity: 73,
      hardPity: 89,
      upDuration: '24h',
      loseDuration: '12h'
    }
  },
  friendRequest: {
    enabled: false,
    keywords: [],
    rejectMessage: '请输入正确的验证信息'
  },
  guildRequest: {
    enabled: false,
    rejectMessage: '暂不接受入群邀请'
  },
  setEssenceMsg: { enabled: true, authority: 3 },
  setTitle: { enabled: true, authority: 3, maxLength: 18 },
  antiRepeat: { enabled: false, threshold: 3 },
  openai: {
    enabled: false,
    chatEnabled: true,
    translateEnabled: true,
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个有帮助的AI助手，请简短、准确地回答问题。',
    translatePrompt: '',
    maxTokens: 2048,
    temperature: 0.7,
    contextLimit: 10
  },
  report: {
    enabled: true,
    authority: 1,
    autoProcess: true,
    defaultPrompt: '',
    contextPrompt: '',
    maxReportTime: 30,
    maxReportCooldown: 60,
    minAuthorityNoLimit: 2,
    guildConfigs: {}
  },
  antiRecall: {
    enabled: false,
    retentionDays: 7,
    maxRecordsPerUser: 50,
    showOriginalTime: true
  }
}

const loading = ref(true)
const saving = ref(false)
const resetting = ref(false)
const settings = ref<any>({ ...defaultSettings })
const activeSection = ref('warn')

// 将数组转换为文本
const keywordsText = computed({
  get: () => (settings.value.keywords || []).join('\n'),
  set: (val) => { settings.value.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) }
})

const forbiddenKeywordsText = computed({
  get: () => (settings.value.forbidden?.keywords || []).join('\n'),
  set: (val) => { 
    if (!settings.value.forbidden) settings.value.forbidden = {}
    settings.value.forbidden.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) 
  }
})

const friendKeywordsText = computed({
  get: () => (settings.value.friendRequest?.keywords || []).join('\n'),
  set: (val) => { 
    if (!settings.value.friendRequest) settings.value.friendRequest = {}
    settings.value.friendRequest.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) 
  }
})

const sections = [
  { id: 'warn', label: '警告设置', icon: 'alert-triangle' },
  { id: 'forbidden', label: '禁言关键词', icon: 'slash' },
  { id: 'keywords', label: '入群审核', icon: 'user-check' },
  { id: 'dice', label: '掷骰子', icon: 'dice' },
  { id: 'banme', label: 'Banme', icon: 'ban' },
  { id: 'friendRequest', label: '好友申请', icon: 'user-plus' },
  { id: 'guildRequest', label: '入群邀请', icon: 'users' },
  { id: 'essence', label: '精华消息', icon: 'star' },
  { id: 'title', label: '头衔设置', icon: 'award' },
  { id: 'antiRepeat', label: '反复读', icon: 'repeat' },
  { id: 'antiRecall', label: '防撤回', icon: 'eye' },
  { id: 'openai', label: 'AI功能', icon: 'cpu' },
  { id: 'report', label: '举报功能', icon: 'flag' },
  { id: 'cache', label: '缓存管理', icon: 'database' },
]

// 深度合并对象
const deepMerge = (target: any, source: any) => {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

const loadSettings = async () => {
  loading.value = true
  try {
    const data = await settingsApi.get()
    // 深度合并默认值和返回数据
    settings.value = deepMerge({ ...defaultSettings }, data || {})
  } catch (e: any) {
    message.error(e.message || '加载设置失败')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await settingsApi.update(settings.value)
    message.success('设置已保存')
  } catch (e: any) {
    message.error(e.message || '保存设置失败')
  } finally {
    saving.value = false
  }
}

const resetSettings = async () => {
  if (!confirm('确定要恢复默认设置吗？所有自定义设置都将丢失。')) return
  
  resetting.value = true
  try {
    await settingsApi.reset()
    message.success('设置已恢复默认')
    // 重新加载设置
    await loadSettings()
  } catch (e: any) {
    message.error(e.message || '重置设置失败')
  } finally {
    resetting.value = false
  }
}

// 缓存管理
const cacheStats = ref<CacheStats | null>(null)
const cacheLoading = ref(false)
const cacheRefreshing = ref(false)

const loadCacheStats = async () => {
  cacheLoading.value = true
  try {
    cacheStats.value = await cacheApi.stats()
  } catch (e: any) {
    message.error(e.message || '获取缓存统计失败')
  } finally {
    cacheLoading.value = false
  }
}

const refreshCache = async () => {
  if (!confirm('确定要强制刷新所有缓存吗？这可能需要一些时间。')) return
  
  cacheRefreshing.value = true
  try {
    const result = await cacheApi.refresh()
    cacheStats.value = result.stats
    message.success('缓存刷新完成')
  } catch (e: any) {
    message.error(e.message || '刷新缓存失败')
  } finally {
    cacheRefreshing.value = false
  }
}

const clearCache = async () => {
  if (!confirm('确定要清空所有缓存吗？')) return
  
  try {
    await cacheApi.clear()
    await loadCacheStats()
    message.success('缓存已清空')
  } catch (e: any) {
    message.error(e.message || '清空缓存失败')
  }
}

// 监听activeSection变化，切换到缓存管理时加载统计
watch(activeSection, (newVal) => {
  if (newVal === 'cache') {
    loadCacheStats()
  }
})

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-view {
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

.settings-content {
  flex: 1;
  display: flex;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  overflow: hidden;
}

.settings-sidebar {
  width: 180px;
  border-right: 1px solid var(--k-color-border);
  padding: 1rem 0.5rem;
  overflow-y: auto;
  background: var(--k-color-bg-2);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--k-color-text);
  font-size: 0.875rem;
  transition: all 0.2s;
  margin-bottom: 2px;
}

.sidebar-item:hover {
  background: var(--k-color-bg-1);
}

.sidebar-item.active {
  background: var(--k-color-active-bg, rgba(64, 158, 255, 0.1));
  color: var(--k-color-active);
  font-weight: 500;
}

.settings-main {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--k-color-border);
}

.section-header h3 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  color: var(--k-color-text);
}

.section-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--k-color-text-description);
}

.form-group {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.5rem 0;
}

.form-group.full-width {
  flex-direction: column;
}

.form-group > label:first-child {
  width: 140px;
  flex-shrink: 0;
  font-weight: 500;
  color: var(--k-color-text);
  padding-top: 6px;
}

.form-group.full-width > label:first-child {
  width: auto;
  padding-top: 0;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  margin-left: 0.5rem;
  flex: 1;
}

.form-group.full-width .form-hint {
  margin-left: 0;
  margin-top: 0.5rem;
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

.form-group .el-input,
.form-group .el-input-number,
.form-textarea {
  max-width: 600px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
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

.divider-text {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  margin: 1.5rem 0 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--k-color-border);
  font-weight: 500;
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
  transition: background-color 0.3s;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* 缓存管理样式 */
.cache-stats {
  background: var(--k-color-bg-1);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px dashed var(--k-color-border);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  font-weight: 500;
  color: var(--k-color-text);
}

.stat-value {
  color: var(--k-color-active);
  font-weight: 600;
}

.cache-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.cache-info {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(64, 158, 255, 0.05);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--k-color-text);
}

.cache-info .k-icon {
  flex-shrink: 0;
  color: var(--k-color-active);
  margin-top: 2px;
}

.cache-info p {
  margin: 0 0 0.5rem;
}

.cache-info ul {
  margin: 0;
  padding-left: 1.5rem;
}

.cache-info li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.cache-info li:last-child {
  margin-bottom: 0;
}
</style>