<template>
      <aside class="sidebar">
    <div class="sidebar-header">
      <h2>角色</h2>
      <button class="icon-btn" @click="$emit('create')" title="创建角色">＋</button>
    </div>
    
    <div class="role-list">
      <div
        v-for="role in roles"
        :key="role.id"
        class="role-item"
        :class="{ active: currentId === role.id }"
        @click="$emit('select', role)"
        draggable="true"
        @dragstart="$emit('dragstart', $event, role)"
        @dragover.prevent
        @drop="$emit('drop', $event, role)"
      >
        <span class="role-color" :style="{ backgroundColor: role.color || '#999' }"></span>
        <span class="role-name">{{ role.name }}</span>
        <k-icon v-if="role.builtin" name="lock" class="builtin-icon" title="内置角色" />
        <k-icon v-else name="grip-vertical" class="drag-handle" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 角色列表侧边栏。自 RolesView 抽出，样式随标记一并迁入
 * （父组件的 scoped 样式命中不了子组件内部）。
 */
import type { Role } from '../../types'

defineProps<{
  roles: Role[]
  currentId?: string
}>()

defineEmits<{
  (e: 'select', role: Role): void
  (e: 'create'): void
  (e: 'dragstart', event: DragEvent, role: Role): void
  (e: 'drop', event: DragEvent, role: Role): void
}>()
</script>

<style scoped>
/* 侧边栏 */
.sidebar {
  width: 220px;
  background: var(--bg1, #1e1e20);
  border-right: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  display: flex;
  flex-direction: column;
}


.sidebar-header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  display: flex;
  justify-content: space-between;
  align-items: center;
}


.sidebar-header h2 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg3, rgba(255, 255, 245, .4));
}


.role-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.375rem;
}


/* 滚动条 - 细微克制 */
.role-list::-webkit-scrollbar {
  width: 4px;
}


.role-list::-webkit-scrollbar-track {
  background: transparent;
}


.role-list::-webkit-scrollbar-thumb {
  background: var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 2px;
}


.role-list::-webkit-scrollbar-thumb:hover {
  background: var(--fg3, rgba(255, 255, 245, .4));
}


/* 角色项 */
.role-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.625rem;
  margin-bottom: 1px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
}


.role-item:hover {
  background: var(--bg3, #313136);
}


.role-item.active {
  background: var(--k-color-primary-fade, rgba(116, 89, 255, 0.1));
  border-left: 2px solid var(--k-color-primary, #7459ff);
  margin-left: -2px;
}


/* 角色颜色指示器 - 实心小圆点 */
.role-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}


.role-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg2, rgba(255, 255, 245, .6));
}


.role-item.active .role-name {
  color: var(--fg1, rgba(255, 255, 245, .9));
}


.builtin-icon {
  color: var(--fg3, rgba(255, 255, 245, .4));
  font-size: 10px;
}


.drag-handle {
  color: var(--fg3, rgba(255, 255, 245, .4));
  cursor: grab;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s ease;
}


.role-item:hover .drag-handle {
  opacity: 1;
}


/* 通用按钮 - GitHub 风格 */
.icon-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: var(--k-color-primary, #7459ff);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
}


.icon-btn:hover {
  opacity: 0.85;
}
</style>
