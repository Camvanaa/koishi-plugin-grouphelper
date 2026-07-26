<template>
      <div class="members-sidebar" :class="{ collapsed }">
    <div class="members-header">
      <div class="members-title">
        <h3>群成员</h3>
        <span class="member-count" v-if="!loading">{{ members.length }}</span>
      </div>
      <button class="collapse-btn" @click="$emit('update:collapsed', !collapsed)">
        {{ collapsed ? '◀' : '▶' }}
      </button>
    </div>
    
    <template v-if="!collapsed">
      <!-- 搜索框 -->
      <div class="members-search">
        <input
          type="text"
          :value="search"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
          placeholder="搜索成员..."
          class="search-input"
        />
      </div>

      <!-- 成员列表 -->
      <div class="members-list" v-if="!loading">
        <!-- 群主分组 -->
        <template v-if="filteredOwners.length > 0">
          <div class="member-group-header">
            <span class="crown-icon">👑</span> 群主 — {{ filteredOwners.length }}
          </div>
          <div
            v-for="member in filteredOwners"
            :key="member.id"
            class="member-item owner"
            @click="$emit('select', member)"
          >
            <div class="member-avatar">
              <img :src="member.avatar" @error="handleMemberAvatarError" />
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
              <div class="member-title" v-if="member.title">{{ member.title }}</div>
            </div>
          </div>
        </template>

        <!-- 管理员分组 -->
        <template v-if="filteredAdmins.length > 0">
          <div class="member-group-header">
            <span class="admin-icon">⚙️</span> 管理员 — {{ filteredAdmins.length }}
          </div>
          <div
            v-for="member in filteredAdmins"
            :key="member.id"
            class="member-item admin"
            @click="$emit('select', member)"
          >
            <div class="member-avatar">
              <img :src="member.avatar" @error="handleMemberAvatarError" />
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
              <div class="member-title" v-if="member.title">{{ member.title }}</div>
            </div>
          </div>
        </template>

        <!-- 普通成员分组 -->
        <template v-if="filteredNormalMembers.length > 0">
          <div class="member-group-header">
            <span class="member-icon">👤</span> 成员 — {{ filteredNormalMembers.length }}
          </div>
          <div
            v-for="member in filteredNormalMembers"
            :key="member.id"
            class="member-item"
            @click="$emit('select', member)"
          >
            <div class="member-avatar">
              <img :src="member.avatar" @error="handleMemberAvatarError" />
            </div>
            <div class="member-info">
              <div class="member-name">{{ member.name }}</div>
              <div class="member-title" v-if="member.title">{{ member.title }}</div>
            </div>
          </div>
        </template>

        <!-- 无搜索结果 -->
        <div v-if="search && filteredMembers.length === 0" class="no-members">
          未找到匹配的成员
        </div>
      </div>

      <!-- 加载中 -->
      <div class="members-loading" v-else>
        <k-icon name="loader" class="spin" />
        <span>加载中...</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 聊天页右侧群成员栏。
 *
 * 自 ChatView 抽出。分组与过滤仍由父组件计算后传入，
 * 这里只负责呈现与交互事件。样式随标记一并迁入——
 * 父组件的 scoped 样式命中不了子组件内部。
 */
import type { GuildMember } from '../../api'

withDefaults(
  defineProps<{
    members: GuildMember[]
    filteredOwners: GuildMember[]
    filteredAdmins: GuildMember[]
    filteredNormalMembers: GuildMember[]
    filteredMembers: GuildMember[]
    loading?: boolean
    collapsed?: boolean
    search?: string
  }>(),
  { loading: false, collapsed: false, search: '' }
)

defineEmits<{
  (e: 'update:collapsed', value: boolean): void
  (e: 'update:search', value: string): void
  (e: 'select', member: GuildMember): void
}>()

/** 头像取不到时退回到内置的灰色人形占位图 */
const handleMemberAvatarError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
}
</script>

<style scoped>
/* Members Sidebar */
.members-sidebar {
  width: 200px;
  border-left: 1px solid var(--k-color-divider);
  display: flex;
  flex-direction: column;
  background: var(--bg2);
  transition: width 0.2s ease;
}


.members-sidebar.collapsed {
  width: 36px;
}


.members-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--k-color-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}


.members-title {
  display: flex;
  align-items: center;
  gap: 6px;
}


.members-sidebar.collapsed .members-title {
  display: none;
}


.members-header h3 {
  margin: 0;
  font-size: 11px;
  color: var(--fg2);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}


.member-count {
  font-size: 10px;
  font-family: var(--font-mono);
  background: var(--bg3);
  color: var(--fg2);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--k-color-divider);
}


.collapse-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--fg3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s ease;
}


.collapse-btn:hover {
  background: var(--bg3);
  color: var(--fg1);
}


.members-search {
  padding: 8px 10px;
  border-bottom: 1px solid var(--k-color-divider);
}


.members-search .search-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--k-color-divider);
  border-radius: var(--radius-md);
  background: var(--bg1);
  color: var(--fg1);
  font-size: 11px;
  font-family: var(--font-sans);
}


.members-search .search-input:focus {
  outline: none;
  border-color: var(--k-color-primary);
}


.members-search .search-input::placeholder {
  color: var(--fg3);
}


.members-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}


.member-group-header {
  padding: 8px 10px 4px;
  font-size: 10px;
  color: var(--fg3);
  font-weight: 600;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.02em;
}


.crown-icon,
.admin-icon,
.member-icon {
  font-size: 10px;
}


.member-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}


.member-item:hover {
  background: var(--bg3);
}


.member-item.owner .member-name {
  color: var(--k-color-warning);
  font-weight: 600;
}


.member-item.admin .member-name {
  color: var(--k-color-success);
  font-weight: 500;
}


.member-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg3);
  border: 1px solid var(--k-color-divider);
}


.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}


.member-info {
  flex: 1;
  overflow: hidden;
}


.member-name {
  font-size: 12px;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.member-title {
  font-size: 10px;
  color: var(--fg3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}


.members-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  gap: 6px;
  color: var(--fg3);
  font-size: 11px;
}


.no-members {
  padding: 24px;
  text-align: center;
  color: var(--fg3);
  font-size: 11px;
}
</style>
