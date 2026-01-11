<template>
  <div class="card version-card">
    <div class="card-header">
      <k-icon name="grouphelper:octicons.tag" />
      <h3>版本信息</h3>
    </div>
    <div class="version-grid">
      <div class="version-item">
        <span class="version-label">当前</span>
        <span class="version-value current">{{ stats.version || '...' }}</span>
      </div>
      <div class="version-item">
        <span class="version-label">NPM</span>
        <span class="version-value npm">{{ versions.npm || '...' }}</span>
      </div>
      <div class="version-item">
        <span class="version-label">Main</span>
        <span class="version-value main">{{ versions.main || '...' }}</span>
      </div>
      <div class="version-item">
        <span class="version-label">Dev</span>
        <span class="version-value dev">{{ versions.dev || '...' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  stats: any
  versions: any
}>()
</script>

<style scoped>
/* GitHub Dimmed 风格版本卡片 */
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
  margin-bottom: 0.875rem;
  color: var(--fg1, var(--k-color-text));
  font-weight: 500;
}

.card-header h3 {
  margin: 0;
  font-size: 0.875rem;
}

.version-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  flex: 1;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.625rem;
  background: var(--bg3, var(--k-color-bg-2));
  border-radius: 4px;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.3));
}

.version-label {
  font-size: 0.65rem;
  color: var(--fg3, var(--k-color-text-description));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 版本号 - 等宽字体 */
.version-value {
  font-size: 0.85rem;
  font-weight: 500;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  color: var(--fg2, var(--k-color-text));
}

/* 克制的颜色方案 */
.version-value.current {
  color: var(--k-color-primary, #7459ff);
}
.version-value.npm {
  color: #3fb950;
}
.version-value.main {
  color: #d29922;
}
.version-value.dev {
  color: #f85149;
}
</style>