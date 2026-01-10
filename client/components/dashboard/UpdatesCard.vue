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
.card {
  background: var(--k-card-bg);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  height: 360px;
  box-sizing: border-box;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.2);
  border-color: var(--k-color-primary-fade);
}

.updates-card {
  position: relative;
}

.commits-list {
  position: absolute;
  top: 76px;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 0.5rem;
  overflow-y: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--k-color-border);
  color: var(--k-color-text);
  font-weight: 600;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.commit-item {
  display: flex;
  gap: 1rem;
  padding: 0.875rem 0.75rem;
  position: relative;
  text-decoration: none;
  color: inherit;
  border-radius: 12px;
  transition: all 0.2s ease;
  margin-left: 0.5rem;
}

.commit-item:hover {
  background: var(--k-bg-light);
  transform: translateX(4px);
}

.commit-item::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 3rem;
  bottom: -0.25rem;
  width: 2px;
  background: var(--k-color-border);
  z-index: 0;
}

.commit-item:last-child::before {
  display: none;
}

.commit-avatar {
  position: relative;
  z-index: 1;
}

.commit-avatar img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--k-card-bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: transform 0.2s;
}

.commit-item:hover .commit-avatar img {
  transform: scale(1.1);
}

.commit-info {
  flex: 1;
  min-width: 0;
  padding-top: 0.25rem;
}

.commit-msg {
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--k-color-text);
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}

.commit-meta {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.commit-meta span:first-child {
  font-weight: 500;
  color: var(--k-color-primary);
}

.commits-list::-webkit-scrollbar {
  width: 4px;
}
.commits-list::-webkit-scrollbar-track {
  background: transparent;
}
.commits-list::-webkit-scrollbar-thumb {
  background: var(--k-color-border);
  border-radius: 2px;
}

.loading-text, .error-text {
  text-align: center;
  padding: 2rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>