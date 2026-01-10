<template>
  <div class="card updates-card">
    <div class="card-header">
      <k-icon name="grouphelper:clock" />
      <h3>最近更新 (Dev)</h3>
    </div>
    <div class="commits-list">
      <div v-if="error" class="error-text">
        <k-icon name="alert-circle" />
        <span>无法获取更新记录: {{ error }}</span>
      </div>
      <div v-else-if="!commits || commits.length === 0" class="loading-text">
        <k-icon name="loader" class="spin" />
        <span>加载中...</span>
      </div>
      <a v-else v-for="commit in commits" :key="commit.sha" :href="commit.html_url" target="_blank" class="commit-item">
        <div class="commit-avatar">
          <img :src="commit.author?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" />
        </div>
        <div class="commit-info">
          <div class="commit-msg">{{ commit.commit.message }}</div>
          <div class="commit-meta">
            <span>{{ commit.commit.author.name }}</span>
            <span>{{ formatRelativeTime(commit.commit.author.date) }}</span>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  commits: any[]
  error: string
}>()

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`

  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
/* GitHub Dimmed 风格更新卡片 */
.card {
  background: var(--bg2, var(--k-card-bg));
  border-radius: 6px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  transition: border-color 0.15s ease;
  height: 100%;
  min-height: 320px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.card:hover {
  border-color: var(--k-color-border, rgba(82, 82, 89, 0.8));
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  color: var(--fg1, var(--k-color-text));
  font-weight: 500;
}

.card-header h3 {
  margin: 0;
  font-size: 0.875rem;
}

.commits-list {
  flex: 1;
  overflow-y: auto;
  margin: 0 -0.5rem;
  padding: 0 0.5rem;
}

/* 提交项 - hover 效果 */
.commit-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.625rem 0.5rem;
  position: relative;
  text-decoration: none;
  color: inherit;
  border-radius: 4px;
  transition: background 0.15s ease;
  margin-left: 0.375rem;
}

.commit-item:hover {
  background: var(--bg3, var(--k-hover-bg));
}

/* 时间轴线 */
.commit-item::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 2.25rem;
  bottom: -0.25rem;
  width: 1px;
  background: var(--k-color-divider, rgba(82, 82, 89, 0.5));
  z-index: 0;
}

.commit-item:last-child::before {
  display: none;
}

.commit-avatar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.commit-avatar img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--bg2, var(--k-card-bg));
}

.commit-info {
  flex: 1;
  min-width: 0;
  padding-top: 0.125rem;
}

.commit-msg {
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--fg1, var(--k-color-text));
  font-size: 0.8rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}

.commit-meta {
  font-size: 0.7rem;
  color: var(--fg3, var(--k-color-text-description));
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.commit-meta span:first-child {
  font-weight: 500;
  color: var(--k-color-primary, #7459ff);
}

/* 滚动条 */
.commits-list::-webkit-scrollbar {
  width: 4px;
}
.commits-list::-webkit-scrollbar-track {
  background: transparent;
}
.commits-list::-webkit-scrollbar-thumb {
  background: var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 2px;
}

.loading-text, .error-text {
  text-align: center;
  padding: 1.5rem;
  color: var(--fg3, var(--k-color-text-description));
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>