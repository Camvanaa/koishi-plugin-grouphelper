<template>
  <div class="replies-view needs-scroll">
    <header class="view-header">
      <div>
        <h2 class="view-title">回复文案</h2>
        <p class="view-subtitle">按 preset 管理回复模板；每个自定义 preset 都独立保存自己的修改</p>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="createPreset" :disabled="loading">
          <k-icon name="grouphelper:octicons.plus" class="btn-icon" />
          <span>新建</span>
        </button>
        <button class="action-btn" @click="copyPreset" :disabled="loading">
          <k-icon name="grouphelper:octicons.copy" class="btn-icon" />
          <span>复制</span>
        </button>
        <button class="action-btn" @click="loadAll" :disabled="loading">
          <k-icon name="grouphelper:octicons.sync" class="btn-icon" />
          <span>重新加载</span>
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span class="loading-text">Loading...</span>
    </div>

    <div v-else class="replies-content">
      <aside class="replies-sidebar">
        <div class="preset-panel">
          <div class="panel-head">
            <label class="panel-label">Preset</label>
            <span class="panel-count">{{ presetItems.length }}</span>
          </div>
          <div class="preset-list">
            <button
              v-for="preset in presetItems"
              :key="preset.id"
              class="preset-item"
              :class="{ active: replies.activePreset === preset.id }"
              @click="replies.activePreset = preset.id"
            >
              <span class="preset-name">{{ preset.label }}</span>
              <span class="preset-desc">{{ preset.description }}</span>
            </button>
          </div>
        </div>

        <div class="preset-panel" v-if="activeCustomPreset">
          <label class="panel-label">当前自定义 preset</label>
          <input v-model="activeCustomPreset.label" class="name-input" />
          <div class="preset-actions">
            <button class="small-btn" @click="resetCurrentPreset" :disabled="!overrideCount">恢复默认</button>
            <button class="small-btn danger" @click="deleteCurrentPreset">删除</button>
          </div>
        </div>

        <div class="preset-panel" v-else>
          <label class="panel-label">当前为内置 preset</label>
          <p class="panel-note">内置 preset 不直接写入修改。编辑任意模板时会自动复制为新的自定义 preset。</p>
        </div>

        <div class="group-list">
          <button
            v-for="group in groups"
            :key="group.name"
            class="group-item"
            :class="{ active: activeGroup === group.name }"
            @click="activeGroup = group.name"
          >
            <span>{{ group.name }}</span>
            <span class="group-count">{{ group.count }}</span>
          </button>
        </div>
      </aside>

      <main class="replies-main">
        <div class="toolbar-row">
          <div class="search-box">
            <k-icon name="grouphelper:octicons.search" class="search-icon" />
            <input v-model="search" class="search-input" placeholder="搜索 key、名称或文案" />
          </div>
          <div class="summary-pill">
            <span>{{ activePresetLabel }}</span>
            <span class="divider"></span>
            <span>{{ overrideCount }}</span>
            <span>项修改</span>
          </div>
        </div>

        <div class="template-list">
          <section v-for="item in filteredTemplates" :key="item.key" class="template-row">
            <div class="template-meta">
              <div class="template-title-row">
                <span class="template-label">{{ item.label }}</span>
                <code class="template-key">{{ item.key }}</code>
                <span v-if="isOverridden(item.key)" class="override-badge">自定义</span>
              </div>
              <div class="template-default">默认：{{ baseText(item.key) }}</div>
              <div v-if="item.variables?.length" class="variables-row">
                <span v-for="variable in item.variables" :key="variable" class="variable-chip">{{ '{' + variable + '}' }}</span>
              </div>
            </div>

            <div class="editor-area">
              <textarea
                :value="effectiveText(item.key)"
                class="reply-textarea"
                rows="3"
                @input="setOverride(item.key, ($event.target as HTMLTextAreaElement).value)"
              ></textarea>
              <button class="small-btn" :disabled="!isOverridden(item.key)" @click="resetOne(item.key)">恢复默认</button>
            </div>
          </section>

          <div v-if="!filteredTemplates.length" class="empty-state">
            <k-icon name="grouphelper:octicons.inbox" />
            <span>没有匹配的回复模板</span>
          </div>
        </div>
      </main>
    </div>

    <transition name="slide-up">
      <div class="save-bar" v-if="hasChanges">
        <span class="save-bar-text">检测到未保存的修改</span>
        <div class="save-actions">
          <button class="save-bar-btn secondary" :disabled="saving" @click="discardChanges">放弃更改</button>
          <button class="save-bar-btn primary" :disabled="saving" @click="saveReplies">
            {{ saving ? '保存中...' : '保存更改' }}
          </button>
        </div>
      </div>
    </transition>

    <ConfirmDialog :state="confirmState" @accept="acceptConfirm" @cancel="cancelConfirm" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from '@koishijs/client'
import { repliesApi, settingsApi, type ReplyCatalog, type ReplyTemplateInfo } from '../api'
import { useConfirm } from '../composables/useConfirm'
import ConfirmDialog from './common/ConfirmDialog.vue'

type CustomPreset = { id: string; label: string; base: string; overrides: Record<string, string> }

const defaultReplies = () => ({ locale: 'zh-CN', activePreset: 'cyber-neko', customPresets: {} as Record<string, CustomPreset> })

const loading = ref(true)
const saving = ref(false)
const search = ref('')
const activeGroup = ref('全部')
const settings = ref<any>({})
const original = ref('')
const replies = reactive(defaultReplies())
const catalog = reactive<ReplyCatalog>({ presets: [], templates: [], defaults: {} })
const { confirmState, showConfirm, acceptConfirm, cancelConfirm } = useConfirm()

const builtinIds = computed(() => new Set(catalog.presets.map(item => item.id)))
const activeCustomPreset = computed(() => replies.customPresets[replies.activePreset])
const activeBaseId = computed(() => activeCustomPreset.value?.base || (builtinIds.value.has(replies.activePreset) ? replies.activePreset : 'cyber-neko'))
const activeOverrides = computed(() => activeCustomPreset.value?.overrides || {})

const presetItems = computed(() => [
  ...catalog.presets.map(item => ({ ...item, description: `内置 - ${item.description}` })),
  ...Object.values(replies.customPresets).map(item => ({
    id: item.id,
    label: item.label,
    description: `自定义 - 基于 ${presetLabel(item.base)}，${Object.keys(item.overrides || {}).length} 项修改`
  }))
])

const activePresetLabel = computed(() => presetItems.value.find(item => item.id === replies.activePreset)?.label || replies.activePreset)
const overrideCount = computed(() => Object.keys(activeOverrides.value).length)
const hasChanges = computed(() => original.value && JSON.stringify(cleanReplies()) !== original.value)

const groups = computed(() => {
  const counts = new Map<string, number>()
  for (const item of catalog.templates) counts.set(item.group, (counts.get(item.group) || 0) + 1)
  return [{ name: '全部', count: catalog.templates.length }, ...Array.from(counts.entries()).map(([name, count]) => ({ name, count }))]
})

const filteredTemplates = computed<ReplyTemplateInfo[]>(() => {
  const keyword = search.value.trim().toLowerCase()
  return catalog.templates.filter(item => {
    if (activeGroup.value !== '全部' && item.group !== activeGroup.value) return false
    if (!keyword) return true
    return [item.key, item.label, item.group, baseText(item.key), activeOverrides.value[item.key] || '']
      .join('\n')
      .toLowerCase()
      .includes(keyword)
  })
})

function presetLabel(id: string) {
  return catalog.presets.find(item => item.id === id)?.label || id
}

function normalizeReplies(input: any) {
  const normalized = defaultReplies()
  normalized.locale = input?.locale || normalized.locale
  normalized.activePreset = input?.activePreset || input?.preset || normalized.activePreset
  normalized.customPresets = { ...(input?.customPresets || {}) }

  if (input?.overrides && Object.keys(input.overrides).length) {
    const base = input?.preset || 'cyber-neko'
    const id = uniquePresetId(`custom-${base}`)
    normalized.customPresets[id] = {
      id,
      label: `${presetLabel(base)} 自定义`,
      base,
      overrides: { ...input.overrides }
    }
    normalized.activePreset = id
  }
  return normalized
}

function applyReplies(next: any) {
  const normalized = normalizeReplies(next)
  replies.locale = normalized.locale
  replies.activePreset = normalized.activePreset
  replies.customPresets = normalized.customPresets
}

function cleanReplies() {
  return JSON.parse(JSON.stringify({ locale: replies.locale, activePreset: replies.activePreset, customPresets: replies.customPresets }))
}

function uniquePresetId(prefix = 'custom') {
  let index = 1
  let id = `${prefix}-${Date.now().toString(36)}`
  while (builtinIds.value.has(id) || replies.customPresets[id]) id = `${prefix}-${index++}`
  return id
}

function baseText(key: string) {
  return catalog.defaults[activeBaseId.value]?.[key] || catalog.defaults['cyber-neko']?.[key] || ''
}

function effectiveText(key: string) {
  return activeOverrides.value[key] ?? baseText(key)
}

function isOverridden(key: string) {
  return Object.prototype.hasOwnProperty.call(activeOverrides.value, key)
}

function ensureEditablePreset() {
  if (activeCustomPreset.value) return activeCustomPreset.value
  const base = activeBaseId.value
  const id = uniquePresetId(`custom-${base}`)
  const next = {
    id,
    label: `${presetLabel(base)} 自定义`,
    base,
    overrides: {}
  }
  replies.customPresets[id] = next
  replies.activePreset = id
  return next
}

function setOverride(key: string, value: string) {
  const preset = ensureEditablePreset()
  const fallback = baseText(key)
  const next = { ...(preset.overrides || {}) }
  if (value === fallback) delete next[key]
  else next[key] = value
  preset.overrides = next
}

function resetOne(key: string) {
  if (!activeCustomPreset.value) return
  const next = { ...activeCustomPreset.value.overrides }
  delete next[key]
  activeCustomPreset.value.overrides = next
}

async function resetCurrentPreset() {
  if (!activeCustomPreset.value) return
  const confirmed = await showConfirm({
    title: '恢复 preset 默认',
    message: '确定要清空当前 preset 的所有自定义文案吗？',
    type: 'danger'
  })
  if (confirmed) activeCustomPreset.value.overrides = {}
}

function createPreset() {
  const base = activeBaseId.value
  const id = uniquePresetId('preset')
  replies.customPresets[id] = { id, label: `新 preset ${Object.keys(replies.customPresets).length + 1}`, base, overrides: {} }
  replies.activePreset = id
}

function copyPreset() {
  const base = activeBaseId.value
  const id = uniquePresetId('preset-copy')
  replies.customPresets[id] = {
    id,
    label: `${activePresetLabel.value} 副本`,
    base,
    overrides: { ...activeOverrides.value }
  }
  replies.activePreset = id
}

async function deleteCurrentPreset() {
  const current = activeCustomPreset.value
  if (!current) return
  const confirmed = await showConfirm({
    title: '删除 preset',
    message: `确定要删除 preset「${current.label}」吗？`,
    type: 'danger'
  })
  if (!confirmed) return
  delete replies.customPresets[current.id]
  replies.activePreset = current.base || 'cyber-neko'
}

function discardChanges() {
  applyReplies(JSON.parse(original.value))
}

async function loadAll() {
  loading.value = true
  try {
    const [catalogData, settingsData] = await Promise.all([repliesApi.catalog(), settingsApi.get()])
    Object.assign(catalog, catalogData)
    settings.value = settingsData || {}
    applyReplies(settings.value.replies)
    original.value = JSON.stringify(cleanReplies())
  } catch (e: any) {
    message.error(e.message || '加载回复文案失败')
  } finally {
    loading.value = false
  }
}

async function saveReplies() {
  saving.value = true
  try {
    const payload = { ...settings.value, replies: cleanReplies() }
    await settingsApi.update(payload)
    settings.value = payload
    original.value = JSON.stringify(cleanReplies())
    message.success('回复文案已保存')
  } catch (e: any) {
    message.error(e.message || '保存回复文案失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => loadAll())
</script>

<style scoped>
.replies-view { height: 100%; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; }
.view-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--k-color-divider); }
.view-title { font-size: 14px; font-weight: 500; color: var(--fg1); margin: 0; }
.view-subtitle { margin: 4px 0 0; font-size: 12px; color: var(--fg3); }
.header-actions, .save-actions, .preset-actions { display: flex; align-items: center; gap: 8px; }
.action-btn, .small-btn, .save-bar-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; font-weight: 500; font-family: inherit; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
.action-btn { padding: 5px 10px; color: var(--fg2); background: var(--bg2); border: 1px solid var(--k-color-border); }
.small-btn { height: 30px; padding: 0 9px; color: var(--fg2); background: var(--bg2); border: 1px solid var(--k-color-border); }
.action-btn:hover, .small-btn:hover { color: var(--fg1); background: var(--bg3); border-color: var(--fg3); }
.small-btn.danger { color: var(--k-color-danger); }
.action-btn:disabled, .small-btn:disabled, .save-bar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-icon { font-size: 13px; }
.loading-state, .empty-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 32px; color: var(--fg3); font-size: 12px; }
.loading-text { font-size: 12px; font-family: 'SF Mono', 'Consolas', monospace; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.replies-content { flex: 1; min-height: 0; display: grid; grid-template-columns: 260px 1fr; gap: 16px; }
.replies-sidebar, .replies-main { min-height: 0; }
.replies-sidebar { display: flex; flex-direction: column; gap: 12px; }
.preset-panel, .group-list, .replies-main { background: var(--k-card-bg); border: 1px solid var(--k-color-divider); border-radius: 6px; }
.preset-panel { padding: 12px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.panel-label { display: block; margin-bottom: 8px; font-size: 12px; color: var(--fg2); font-weight: 500; }
.panel-head .panel-label { margin-bottom: 0; }
.panel-count { color: var(--fg3); font-size: 11px; font-family: 'SF Mono', 'Consolas', monospace; }
.panel-note { margin: 0; color: var(--fg3); font-size: 12px; line-height: 1.5; }
.preset-list, .group-list { display: flex; flex-direction: column; gap: 4px; }
.preset-item, .group-item { width: 100%; border: 1px solid transparent; background: transparent; color: var(--fg2); cursor: pointer; font-family: inherit; text-align: left; }
.preset-item { padding: 8px; border-radius: 5px; }
.preset-item.active, .group-item.active { color: var(--fg1); background: var(--bg3); border-color: var(--k-color-divider); }
.preset-name { display: block; font-size: 12px; font-weight: 600; }
.preset-desc { display: block; margin-top: 3px; font-size: 11px; color: var(--fg3); line-height: 1.4; }
.name-input { width: 100%; height: 32px; padding: 0 9px; margin-bottom: 10px; color: var(--fg1); background: var(--bg2); border: 1px solid var(--k-color-border); border-radius: 6px; box-sizing: border-box; }
.group-list { padding: 6px; overflow: auto; }
.group-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 8px; border-radius: 5px; font-size: 12px; }
.group-count { color: var(--fg3); font-family: 'SF Mono', 'Consolas', monospace; }
.replies-main { display: flex; flex-direction: column; overflow: hidden; }
.toolbar-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-bottom: 1px solid var(--k-color-divider); }
.search-box { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--k-color-border); border-radius: 6px; padding: 0 10px; min-width: 0; }
.search-icon { color: var(--fg3); font-size: 13px; }
.search-input { flex: 1; height: 32px; min-width: 0; border: none; outline: none; background: transparent; color: var(--fg1); font-size: 12px; }
.summary-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 999px; background: var(--bg2); border: 1px solid var(--k-color-divider); color: var(--fg3); font-size: 12px; white-space: nowrap; }
.divider { width: 1px; height: 12px; background: var(--k-color-divider); }
.template-list { flex: 1; overflow: auto; }
.template-row { display: grid; grid-template-columns: minmax(260px, 0.9fr) minmax(320px, 1.1fr); gap: 16px; padding: 14px 12px; border-bottom: 1px solid var(--k-color-divider); }
.template-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.template-label { font-size: 13px; color: var(--fg1); font-weight: 600; }
.template-key { padding: 2px 5px; border-radius: 4px; background: var(--bg2); color: var(--fg3); font-size: 11px; }
.override-badge, .variable-chip { padding: 2px 6px; border-radius: 999px; font-size: 11px; line-height: 1.4; }
.override-badge { color: var(--k-color-primary); background: var(--k-color-primary-fade); }
.template-default { margin-top: 8px; color: var(--fg3); font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
.variables-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.variable-chip { color: var(--fg2); background: var(--bg2); border: 1px solid var(--k-color-divider); font-family: 'SF Mono', 'Consolas', monospace; }
.editor-area { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
.reply-textarea { width: 100%; min-height: 76px; resize: vertical; padding: 8px 10px; border: 1px solid var(--k-color-border); border-radius: 6px; background: var(--bg2); color: var(--fg1); font-size: 12px; font-family: 'SF Mono', 'Consolas', monospace; line-height: 1.5; box-sizing: border-box; }
.reply-textarea:focus, .name-input:focus { outline: none; border-color: var(--k-color-primary); box-shadow: 0 0 0 2px var(--k-color-primary-fade); }
.save-bar { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--k-card-bg); border: 1px solid var(--k-color-divider); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); z-index: 20; }
.save-bar-text { color: var(--fg2); font-size: 12px; }
.save-bar-btn { padding: 6px 12px; border: 1px solid var(--k-color-border); background: var(--bg2); color: var(--fg2); }
.save-bar-btn.primary { color: var(--fg0); background: var(--k-color-primary); border-color: var(--k-color-primary); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translate(-50%, 12px); }
@media (max-width: 900px) { .view-header, .toolbar-row { align-items: stretch; flex-direction: column; } .replies-content { grid-template-columns: 1fr; overflow: visible; } .group-list { max-height: 180px; } .template-row, .editor-area { grid-template-columns: 1fr; } .save-bar { left: 16px; right: 16px; bottom: 16px; transform: none; justify-content: space-between; } .slide-up-enter-from, .slide-up-leave-to { transform: translateY(12px); } }
</style>
