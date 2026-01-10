<template>
  <div class="card version-card">
    <div class="card-header">
      <k-icon name="tag" />
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

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  color: var(--k-color-text);
  font-weight: 600;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.version-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: var(--k-color-bg-2);
  border-radius: 10px;
}

.version-label {
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  font-weight: 500;
}

.version-value {
  font-size: 0.9rem;
  font-weight: 600;
  font-family: monospace;
}

.version-value.current { color: var(--k-color-primary); }
.version-value.npm { color: #67c23a; }
.version-value.main { color: #e6a23c; }
.version-value.dev { color: #f56c6c; }
</style>