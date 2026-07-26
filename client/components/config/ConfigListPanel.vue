<template>
      <div class="config-list">
    <div v-if="listItems.length === 0" class="empty-state">
      <k-icon name="inbox" class="empty-icon" />
      <p>{{ searchQuery ? '未找到匹配的群组' : '暂无群组配置' }}</p>
    </div>

    <!-- 列表视图 (使用 v-show 让 CSS 可以控制) -->
    <div v-show="viewMode === 'list'" class="list-table">
        <div class="list-header">
          <span class="col-guild">群组信息</span>
          <span class="col-features">功能开关</span>
          <span class="col-stats">统计</span>
          <span class="col-actions">操作</span>
        </div>
        <div
          v-for="item in listItems"
          :key="item.key"
          class="list-row"
          :class="{ 'group-row': item.type === 'group' }"
          @click="$emit('open', item)"
        >
          <div class="col-guild">
            <k-icon v-if="item.type === 'group'" name="layers" class="guild-icon-sm" />
            <img
              v-else-if="fetchNames && item.config?.guildAvatar"
              :src="item.config?.guildAvatar"
              class="guild-avatar-sm"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
            <k-icon v-else name="users" class="guild-icon-sm" />
            <div class="guild-text">
              <span class="guild-name">
                {{ item.type === 'group' ? item.group?.name : (item.config?.guildName || item.id) }}
                <span v-if="item.type === 'group'" class="tag">群组组</span>
              </span>
              <span class="guild-id-sub" v-if="item.type === 'group' || item.config?.guildName">{{ item.id }}</span>
            </div>
          </div>
          <div class="col-features">
            <span class="badge-sm" :class="{ active: item.config?.welcomeEnabled }" title="入群欢迎">迎</span>
            <span class="badge-sm" :class="{ active: item.config?.goodbyeEnabled }" title="退群欢送">送</span>
            <span class="badge-sm" :class="{ active: item.config?.antiRecall?.enabled }" title="防撤回">撤</span>
            <span class="badge-sm" :class="{ active: item.config?.antiRepeat?.enabled }" title="复读检测">复</span>
            <span class="badge-sm" :class="{ active: item.config?.dice?.enabled }" title="掷骰子">骰</span>
            <span class="badge-sm" :class="{ active: item.config?.banme?.enabled }" title="自我禁言">禁</span>
            <span class="badge-sm" :class="{ active: item.config?.openai?.enabled }" title="AI助手">AI</span>
            <span class="badge-sm" :class="{ active: item.config?.report?.enabled }" title="举报功能">报</span>
          </div>
          <div class="col-stats">
            <span v-if="item.type === 'group'" class="muted">包含 {{ item.group?.guildIds?.length || 0 }} 群</span>
            <template v-else>
              <span v-if="item.config?.approvalKeywords?.length" title="入群验证词"><b>{{ item.config?.approvalKeywords.length }}</b> 验证</span>
              <span v-if="item.config?.keywords?.length" title="违规词"><b>{{ item.config?.keywords.length }}</b> 违规</span>
              <span v-if="!item.config?.approvalKeywords?.length && !item.config?.keywords?.length" class="muted">-</span>
            </template>
          </div>
          <div class="col-actions" @click.stop>
            <button class="action-btn" @click="$emit('copy', item.id)" title="复制群号">
              <k-icon name="copy" />
              <span>复制</span>
            </button>
            <button class="action-btn" @click="$emit('open', item)" title="编辑配置">
              <k-icon name="edit-2" />
              <span>编辑</span>
            </button>
            <button class="action-btn danger" @click="$emit('remove', item)" title="删除配置">
              <k-icon name="trash-2" />
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>

    <!-- 卡片视图 (使用 v-show 让 CSS 可以控制) -->
    <div v-show="viewMode === 'grid'" class="card-grid">
        <div
          v-for="item in gridItems"
          :key="item.key"
          class="config-card"
          :class="{ 'group-card': item.type === 'group' }"
          @click="$emit('open', item)"
        >
          <div class="card-header">
            <div class="guild-info">
              <k-icon v-if="item.type === 'group'" name="layers" class="guild-icon" />
              <img
                v-else-if="fetchNames && item.config?.guildAvatar"
                :src="item.config?.guildAvatar"
                class="guild-avatar"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <k-icon v-else name="users" class="guild-icon" />
              <span class="guild-id">
                {{ item.type === 'group' ? `${item.group?.name} (${item.id})` : (item.config?.guildName ? `${item.config?.guildName} (${item.id})` : item.id) }}
                <span v-if="item.type === 'group'" class="tag">群组组</span>
              </span>
            </div>
          </div>
          <div class="card-body">
            <!-- 简化的功能指示器 -->
            <div class="feature-badges">
              <span class="badge" :class="{ active: item.config?.welcomeEnabled }" title="欢迎消息">迎</span>
              <span class="badge" :class="{ active: item.config?.goodbyeEnabled }" title="欢送消息">送</span>
              <span class="badge" :class="{ active: item.config?.antiRecall?.enabled }" title="防撤回">撤</span>
              <span class="badge" :class="{ active: item.config?.antiRepeat?.enabled }" title="复读检测">复</span>
              <span class="badge" :class="{ active: item.config?.openai?.enabled }" title="AI助手">AI</span>
              <span class="badge" :class="{ active: item.config?.report?.enabled }" title="举报功能">报</span>
            </div>

            <!-- 统计信息单行 -->
            <div class="card-stats">
              <template v-if="item.type === 'group'">
                <span class="stat-item">包含 {{ item.group?.guildIds?.length || 0 }} 群</span>
              </template>
              <template v-else>
                <span class="stat-item" v-if="item.config?.approvalKeywords?.length">
                  <span class="stat-num">{{ item.config?.approvalKeywords.length }}</span> 入群词
                </span>
                <span class="stat-item" v-if="item.config?.keywords?.length">
                  <span class="stat-num">{{ item.config?.keywords.length }}</span> 禁言词
                </span>
                <span class="stat-item placeholder" v-if="!item.config?.approvalKeywords?.length && !item.config?.keywords?.length">
                  暂无配置
                </span>
              </template>
            </div>
          </div>

          <div class="card-footer">
            <k-button size="small" @click.stop="$emit('copy', item.id)" title="复制群号">
              <template #icon><k-icon name="copy" /></template>
              复制
            </k-button>
            <k-button size="small" @click.stop="$emit('open', item)" title="编辑配置">
              <template #icon><k-icon name="edit-2" /></template>
              编辑
            </k-button>
            <k-button size="small" type="danger" @click.stop="$emit('remove', item)" title="删除配置">
              <template #icon><k-icon name="trash-2" /></template>
              删除
            </k-button>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 群组配置列表面板（列表视图 / 卡片视图）。
 *
 * 自 ConfigView 抽出。数据与筛选仍在父组件计算，这里只负责呈现与事件外发；
 * 样式随标记一并迁入——父组件的 scoped 样式命中不了子组件内部。
 */
import type { GroupConfig, GuildGroup } from '../../types'

export interface ConfigListItem {
  key: string
  type: 'guild' | 'group'
  id: string
  config?: GroupConfig
  group?: GuildGroup
}

defineProps<{
  listItems: ConfigListItem[]
  gridItems: ConfigListItem[]
  viewMode: 'list' | 'grid'
  fetchNames: boolean
  searchQuery: string
}>()

defineEmits<{
  (e: 'open', item: ConfigListItem): void
  (e: 'remove', item: ConfigListItem): void
  (e: 'copy', id: string): void
}>()
</script>

<style scoped>
.config-list {
  flex: 1;
  overflow-y: auto;
  align-content: start;
}


/* 列表表格视图 */
.list-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
}


.list-header {
  display: grid;
  grid-template-columns: 1fr 180px 120px 190px;
  gap: 1rem;
  padding: 0.625rem 1rem;
  background: var(--bg1);
  border-bottom: 1px solid var(--k-color-border);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}


.list-row {
  display: grid;
  grid-template-columns: 1fr 180px 120px 190px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-divider);
  cursor: pointer;
  transition: background-color 0.15s ease;
  align-items: center;
}


.group-row {
  background: rgba(116, 89, 255, 0.06);
}


.list-row:last-child {
  border-bottom: none;
}


.list-row:hover {
  background: var(--k-hover-bg);
}


.col-guild {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}


.guild-avatar-sm {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
}


.guild-icon-sm {
  font-size: 16px;
  color: var(--fg3);
  flex-shrink: 0;
}


.guild-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}


.guild-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.tag {
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  background: rgba(116, 89, 255, 0.18);
  color: var(--k-color-primary, #7459ff);
}


.guild-id-sub {
  font-size: 0.6875rem;
  color: var(--fg3);
  font-family: var(--font-family-code);
}


.col-features {
  display: flex;
  gap: 3px;
}


.badge-sm {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 0.5625rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg1);
  color: var(--fg3);
  border: 1px solid var(--k-color-divider);
}


.badge-sm.active {
  background: var(--k-color-success-fade);
  color: var(--k-color-success);
  border-color: var(--k-color-success);
}


.col-stats {
  display: flex;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--fg3);
}


.col-stats b {
  font-weight: 600;
  color: var(--fg1);
  font-family: var(--font-family-code);
}


.col-stats .muted {
  color: var(--fg3);
}


.col-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}


.action-btn {
  background: transparent;
  border: 1px solid var(--k-color-divider);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--fg3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.75rem;
  transition: all 0.15s ease;
}


.action-btn:hover {
  background: var(--bg3);
  border-color: var(--k-color-border);
  color: var(--fg1);
}


.action-btn.danger:hover {
  background: var(--k-color-danger-fade);
  border-color: var(--k-color-danger);
  color: var(--k-color-danger);
}


/* 卡片网格视图 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}


@media (max-width: 600px) {
  .list-header,
  .list-row {
    grid-template-columns: 1fr 40px;
    padding: 0.75rem 0.5rem;
    gap: 0.5rem;
  }

  .col-features,
  .col-stats {
    display: none;
  }

  .col-actions .action-btn {
    padding: 4px;
  }

  .col-actions .action-btn span {
    display: none;
  }

  .col-actions button:not(:nth-child(2)) {
    display: none; /* 只显示编辑按钮 */
  }
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


.group-card {
  border-color: rgba(116, 89, 255, 0.4);
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
  padding: 0.625rem 0.75rem;
}


/* 功能徽章 - 紧凑单行 */
.feature-badges {
  display: flex;
  gap: 4px;
  margin-bottom: 0.5rem;
}


.badge {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg1);
  color: var(--fg3);
  border: 1px solid var(--k-color-divider);
  transition: all 0.15s ease;
}


.badge.active {
  background: var(--k-color-success-fade);
  color: var(--k-color-success);
  border-color: var(--k-color-success);
}


/* 统计信息行 */
.card-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.6875rem;
  color: var(--fg3);
}


.stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
}


.stat-num {
  font-weight: 600;
  color: var(--fg1);
  font-family: var(--font-family-code);
}


.stat-item.placeholder {
  font-style: italic;
}
</style>
