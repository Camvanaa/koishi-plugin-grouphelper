<template>
  <div class="roles-view-container">
    <!-- 侧边栏：角色列表 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>角色</h2>
        <button class="icon-btn" @click="createRole" title="创建角色">＋</button>
      </div>
      
      <div class="role-list">
        <div
          v-for="role in roles"
          :key="role.id"
          class="role-item"
          :class="{ active: currentRole?.id === role.id }"
          @click="selectRole(role)"
          draggable="true"
          @dragstart="onDragStart($event, role)"
          @dragover.prevent
          @drop="onDrop($event, role)"
        >
          <span class="role-color" :style="{ backgroundColor: role.color || '#999' }"></span>
          <span class="role-name">{{ role.name }}</span>
          <k-icon v-if="role.id !== 'everyone'" name="grip-vertical" class="drag-handle" />
        </div>
      </div>
    </aside>

    <!-- 主内容区：编辑面板 -->
    <main class="main-content" v-if="currentRole">
      <div class="content-header">
        <h1>{{ currentRole.name }}</h1>
        <div class="header-actions" v-if="currentRole.id !== 'everyone'">
           <button class="danger-btn" @click="deleteRole">删除角色</button>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-item" :class="{ active: activeTab === 'display' }" @click="activeTab = 'display'">显示</div>
        <div class="tab-item" :class="{ active: activeTab === 'permissions' }" @click="activeTab = 'permissions'">权限</div>
        <div class="tab-item" :class="{ active: activeTab === 'members' }" @click="activeTab = 'members'">成员</div>
      </div>

      <div class="tab-content">
        <!-- 显示设置 -->
        <div v-if="activeTab === 'display'" class="display-settings">
          <div class="form-group">
            <label>角色名称</label>
            <input type="text" v-model="editingRole.name" :disabled="currentRole.id === 'everyone'" class="form-input">
          </div>

          <div class="form-group">
            <label>角色颜色</label>
            <div class="color-picker-wrapper">
              <input type="color" v-model="editingRole.color" class="color-input">
              <input type="text" v-model="editingRole.color" placeholder="#RRGGBB" class="form-input color-text">
            </div>
          </div>

          <div class="form-group checkbox-group">
             <label class="checkbox-label">
                <input type="checkbox" v-model="editingRole.hoist">
                在成员列表中单独显示角色
             </label>
          </div>
          
           <div class="form-group checkbox-group">
             <label class="checkbox-label">
                <input type="checkbox" v-model="editingRole.mentionable">
                允许任何人提及此角色 (@mention)
             </label>
          </div>
        </div>

        <!-- 权限设置 -->
        <div v-if="activeTab === 'permissions'" class="permissions-settings">
          <div class="search-bar">
            <input type="text" v-model="permSearch" placeholder="搜索权限..." class="form-input search-input">
            <button class="secondary-btn" @click="clearPermissions">清除所有</button>
          </div>

          <!-- 当前选中权限列表 -->
          <div class="current-perms" v-if="editingRole.permissions && editingRole.permissions.length > 0">
            <span class="perms-label">已选权限:</span>
            <span class="perm-tag" v-for="p in editingRole.permissions" :key="p">{{ p }}</span>
          </div>

          <!-- 权限为空的提示 -->
          <div v-if="permissions.length === 0" class="empty-tip">
            权限列表加载中或为空...
          </div>

          <div v-else class="permission-groups">
            <div v-for="(group, name) in groupedPermissions" :key="name" class="perm-group">
              <div class="group-header">{{ name }}</div>
              <div class="group-items">
                <div v-for="node in group" :key="node.id" class="permission-item">
                  <div class="perm-info">
                    <div class="perm-name">{{ node.name }}</div>
                    <div class="perm-desc">{{ node.description }}</div>
                    <div class="perm-id">{{ node.id }}</div>
                  </div>
                  <div
                    class="toggle-switch"
                    :class="{ active: hasPermission(node.id) }"
                    @click.stop="togglePermission(node.id)"
                  >
                    <span class="slider"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 成员管理 -->
        <div v-if="activeTab === 'members'" class="members-settings">
             <div class="add-member">
                 <input type="text" v-model="newMemberId" placeholder="输入用户 ID 添加..." class="form-input" @keyup.enter="addMember">
                 <button class="primary-btn" @click.stop="handleAddMember">添加成员</button>
             </div>
             
             <div class="member-list" v-if="currentRoleMembers.length > 0">
                 <div v-for="member in currentRoleMembers" :key="member.id" class="member-item">
                     <div class="member-info">
                        <img v-if="member.avatar" :src="member.avatar" class="member-avatar">
                        <div v-else class="member-icon">👤</div>
                        <div class="member-text">
                          <span class="member-name">{{ member.name || member.id }}</span>
                          <span class="member-id-sub">{{ member.id }}</span>
                        </div>
                     </div>
                     <button class="danger-btn" @click.stop="handleRemoveMember(member.id)">移除</button>
                 </div>
             </div>
             <div v-else class="empty-tip">暂无成员（输入用户 QQ 号添加）</div>
        </div>

      </div>
      
      <!-- 底部浮动保存栏 -->
      <transition name="slide-up">
        <div class="save-bar" v-if="hasChanges">
          <span>检测到未保存的修改</span>
          <div class="save-actions">
            <button class="reset-btn" @click="resetChanges">重置</button>
            <button class="save-btn" @click="saveChanges">保存更改</button>
          </div>
        </div>
      </transition>
    </main>
    
    <div v-else class="empty-state">
        <k-icon name="shield" class="empty-icon" />
        <div>选择一个角色进行编辑</div>
    </div>

    <!-- 自定义确认对话框 -->
    <transition name="fade">
      <div class="modal-overlay" v-if="confirmDialog.show" @click="cancelConfirm">
        <div class="modal-dialog" @click.stop>
          <div class="modal-header">
            <h3>{{ confirmDialog.title }}</h3>
          </div>
          <div class="modal-body">
            <p>{{ confirmDialog.message }}</p>
          </div>
          <div class="modal-footer">
            <button class="secondary-btn" @click="cancelConfirm">取消</button>
            <button :class="confirmDialog.type === 'danger' ? 'danger-btn' : 'primary-btn'" @click="doConfirm">确认</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { authApi } from '../api'
import type { Role, PermissionNode, RoleMember } from '../types'
import { message } from '@koishijs/client'

// 创建默认角色对象
const createDefaultRole = (): Role => ({
  id: '',
  name: '',
  color: '#999999',
  priority: 0,
  permissions: [],
  hoist: false,
  mentionable: false
})

// 状态
const roles = ref<Role[]>([])
const permissions = ref<PermissionNode[]>([])
const currentRole = ref<Role | null>(null)
const editingRole = ref<Role>(createDefaultRole())
const activeTab = ref<'display' | 'permissions' | 'members'>('display')
const permSearch = ref('')
const newMemberId = ref('')
const currentRoleMembers = ref<RoleMember[]>([])
const loading = ref(false)

// 确认对话框状态
const confirmDialog = ref({
  show: false,
  title: '确认',
  message: '',
  type: 'normal' as 'normal' | 'danger',
  onConfirm: () => {},
  onCancel: () => {}
})

// 显示确认对话框
const showConfirm = (options: { title?: string, message: string, type?: 'normal' | 'danger' }): Promise<boolean> => {
  return new Promise((resolve) => {
    confirmDialog.value = {
      show: true,
      title: options.title || '确认',
      message: options.message,
      type: options.type || 'normal',
      onConfirm: () => {
        confirmDialog.value.show = false
        resolve(true)
      },
      onCancel: () => {
        confirmDialog.value.show = false
        resolve(false)
      }
    }
  })
}

const cancelConfirm = () => {
  confirmDialog.value.onCancel()
}

const doConfirm = () => {
  confirmDialog.value.onConfirm()
}

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    console.log('[RolesView] Fetching roles and permissions...')
    roles.value = await authApi.getRoles()
    permissions.value = await authApi.getPermissions()
    console.log('[RolesView] Loaded', roles.value.length, 'roles and', permissions.value.length, 'permissions')
  } catch (e) {
    console.error('[RolesView] Failed to fetch data:', e)
    message.error('加载数据失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

// 计算属性
const hasChanges = computed(() => {
  if (!currentRole.value) return false
  // 使用更可靠的比较方式
  const original = JSON.stringify({
    name: currentRole.value.name,
    color: currentRole.value.color,
    priority: currentRole.value.priority,
    permissions: currentRole.value.permissions || [],
    hoist: currentRole.value.hoist,
    mentionable: currentRole.value.mentionable
  })
  const current = JSON.stringify({
    name: editingRole.value.name,
    color: editingRole.value.color,
    priority: editingRole.value.priority,
    permissions: editingRole.value.permissions || [],
    hoist: editingRole.value.hoist,
    mentionable: editingRole.value.mentionable
  })
  return original !== current
})

const groupedPermissions = computed(() => {
  const result: Record<string, PermissionNode[]> = {}
  const lower = permSearch.value.toLowerCase()
  
  const filtered = permissions.value.filter(p => 
    !lower || 
    p.name.toLowerCase().includes(lower) || 
    p.id.toLowerCase().includes(lower) ||
    p.description.toLowerCase().includes(lower)
  )

  filtered.forEach(p => {
    // 简单的分组逻辑：取第一个点号前的部分，或者根据 id 判断
    let groupName = '通用'
    if (p.id.startsWith('warn.')) groupName = '警告系统'
    else if (p.id.startsWith('config.')) groupName = '配置管理'
    else if (p.id.startsWith('auth.')) groupName = '权限管理'
    else if (p.id.startsWith('blacklist.')) groupName = '黑名单'
    else if (p.id.startsWith('log.')) groupName = '日志'
    else if (p.id.startsWith('chat.')) groupName = '聊天'
    else if (p.id.startsWith('subscription.')) groupName = '订阅'
    else if (p.id === '*') groupName = '系统'
    
    if (!result[groupName]) result[groupName] = []
    result[groupName].push(p)
  })
  
  return result
})

// 方法
const fetchRoleMembers = async (roleId: string) => {
  try {
    console.log('[RolesView] Fetching members for role:', roleId)
    currentRoleMembers.value = await authApi.getRoleMembers(roleId, true)
    console.log('[RolesView] Loaded', currentRoleMembers.value.length, 'members')
  } catch (e) {
    console.error('[RolesView] Failed to fetch role members:', e)
    currentRoleMembers.value = []
  }
}

const selectRole = async (role: Role) => {
  if (hasChanges.value) {
    const confirmed = await showConfirm({
      title: '未保存的修改',
      message: '当前有未保存的修改，是否放弃这些更改？',
      type: 'danger'
    })
    if (!confirmed) return
  }
  currentRole.value = role
  // 确保 role 有所有必要的字段
  const normalizedRole: Role = {
    ...createDefaultRole(),
    ...role,
    permissions: Array.isArray(role.permissions) ? [...role.permissions] : []
  }
  editingRole.value = normalizedRole
  console.log('[RolesView] Selected role:', normalizedRole)
  activeTab.value = 'display'
  fetchRoleMembers(role.id)
}

const createRole = async () => {
  const newRole: Role = {
    id: Date.now().toString(),
    name: '新角色',
    color: '#999999',
    priority: 1,
    permissions: [],
    hoist: false,
    mentionable: false
  }
  try {
    console.log('[RolesView] Creating new role:', newRole)
    await authApi.updateRole(newRole)
    await fetchData()
    // 从刷新后的列表中找到新角色
    const created = roles.value.find(r => r.id === newRole.id)
    if (created) {
      selectRole(created)
    }
    message.success('角色创建成功')
  } catch (e) {
    console.error('[RolesView] Failed to create role:', e)
    message.error('创建角色失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

const saveChanges = async () => {
  if (!currentRole.value) return
  
  try {
    console.log('[RolesView] Saving role changes:', editingRole.value)
    await authApi.updateRole(editingRole.value)
    message.success('保存成功')
    await fetchData()
    // 重新选中以更新 currentRole
    const updated = roles.value.find(r => r.id === editingRole.value.id)
    if (updated) {
      selectRole(updated)
    }
  } catch (e) {
    console.error('[RolesView] Failed to save role:', e)
    message.error('保存失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

const resetChanges = async () => {
  if (!currentRole.value) return
  
  const confirmed = await showConfirm({
    title: '重置更改',
    message: '确定要放弃当前所有未保存的修改吗？',
    type: 'normal'
  })
  
  if (confirmed) {
    // 直接重置 editingRole，不调用 selectRole（会触发重复确认）
    const normalizedRole: Role = {
      ...createDefaultRole(),
      ...currentRole.value,
      permissions: Array.isArray(currentRole.value.permissions) ? [...currentRole.value.permissions] : []
    }
    editingRole.value = normalizedRole
    message.success('已重置更改')
  }
}

const deleteRole = async () => {
  if (!currentRole.value) return
  
  const confirmed = await showConfirm({
    title: '删除角色',
    message: `确定要删除角色"${currentRole.value.name}"吗？此操作不可撤销。`,
    type: 'danger'
  })
  if (!confirmed) return
  
  try {
    console.log('[RolesView] Deleting role:', currentRole.value.id)
    await authApi.deleteRole(currentRole.value.id)
    message.success('删除成功')
    currentRole.value = null
    editingRole.value = createDefaultRole()
    await fetchData()
  } catch (e) {
    console.error('[RolesView] Failed to delete role:', e)
    message.error('删除失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// 权限操作
const hasPermission = (nodeId: string): boolean => {
  const perms = editingRole.value?.permissions
  if (!Array.isArray(perms)) return false
  return perms.includes(nodeId) || perms.includes('*')
}

const togglePermission = (nodeId: string) => {
  console.log('[RolesView] togglePermission called with:', nodeId)
  console.log('[RolesView] Current editingRole:', JSON.stringify(editingRole.value))
  
  // 确保 permissions 是数组
  const currentPerms = Array.isArray(editingRole.value.permissions)
    ? editingRole.value.permissions
    : []
  
  let newPerms: string[]
  if (currentPerms.includes(nodeId)) {
    // 移除权限
    newPerms = currentPerms.filter(p => p !== nodeId)
    console.log('[RolesView] Removing permission:', nodeId)
  } else {
    // 添加权限
    newPerms = [...currentPerms, nodeId]
    console.log('[RolesView] Adding permission:', nodeId)
  }
  
  // 使用新的对象替换整个 editingRole 以确保响应式更新
  editingRole.value = {
    ...editingRole.value,
    permissions: newPerms
  }
  
  console.log('[RolesView] Updated permissions:', editingRole.value.permissions)
  console.log('[RolesView] hasChanges:', hasChanges.value)
}

const clearPermissions = () => {
  console.log('[RolesView] Clearing all permissions')
  editingRole.value = {
    ...editingRole.value,
    permissions: []
  }
  console.log('[RolesView] Permissions cleared, hasChanges:', hasChanges.value)
}

// 成员操作
const addMember = async () => {
  console.log('[RolesView] addMember called, newMemberId:', newMemberId.value)
  
  if (!newMemberId.value.trim()) {
    message.warning('请输入用户 ID')
    return
  }
  if (!currentRole.value) {
    message.warning('请先选择一个角色')
    return
  }
  
  const userId = newMemberId.value.trim()
  const roleId = currentRole.value.id
  
  try {
    console.log('[RolesView] Adding member:', userId, 'to role:', roleId)
    await authApi.assignRole(userId, roleId)
    message.success('添加成员成功')
    newMemberId.value = ''
    await fetchRoleMembers(roleId)
  } catch (e) {
    console.error('[RolesView] Failed to add member:', e)
    message.error('添加成员失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// 包装函数，用于处理按钮点击
const handleAddMember = () => {
  console.log('[RolesView] handleAddMember triggered')
  addMember()
}

const removeMember = async (userId: string) => {
  console.log('[RolesView] removeMember called for:', userId)
  
  if (!currentRole.value) return
  
  const roleId = currentRole.value.id
  
  try {
    console.log('[RolesView] Removing member:', userId, 'from role:', roleId)
    await authApi.revokeRole(userId, roleId)
    message.success('移除成员成功')
    await fetchRoleMembers(roleId)
  } catch (e) {
    console.error('[RolesView] Failed to remove member:', e)
    message.error('移除成员失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// 包装函数，用于处理按钮点击
const handleRemoveMember = (userId: string) => {
  console.log('[RolesView] handleRemoveMember triggered for:', userId)
  removeMember(userId)
}

// 拖拽排序
const onDragStart = (e: DragEvent, role: Role) => {
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', role.id)
        e.dataTransfer.effectAllowed = 'move'
    }
}

const onDrop = async (e: DragEvent, targetRole: Role) => {
    const draggedId = e.dataTransfer?.getData('text/plain')
    if (!draggedId || draggedId === targetRole.id) return
    
    const draggedRole = roles.value.find(r => r.id === draggedId)
    if(draggedRole) {
        // 交换 priority
        const temp = draggedRole.priority
        draggedRole.priority = targetRole.priority
        targetRole.priority = temp
        
        await authApi.updateRole(draggedRole)
        await authApi.updateRole(targetRole)
        await fetchData()
    }
}

</script>

<style scoped>
.roles-view-container {
  display: flex;
  height: 100%;
  background-color: var(--k-card-bg);
  color: var(--k-color-text);
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--k-color-border);
}

.sidebar {
  width: 240px;
  background-color: var(--k-color-bg-2);
  border-right: 1px solid var(--k-color-border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.role-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.role-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin-bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.role-item:hover {
  background-color: var(--k-color-bg-1);
}

.role-item.active {
  background-color: var(--k-color-active-bg, rgba(64, 158, 255, 0.1));
}

.role-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
  border: 1px solid rgba(0,0,0,0.1);
}

.role-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.drag-handle {
  color: var(--k-color-text-description);
  cursor: grab;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
}

.role-item:hover .drag-handle {
  opacity: 1;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: var(--k-card-bg);
}

.content-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.content-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.tabs {
  display: flex;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--k-color-border);
  background-color: var(--k-color-bg-1);
}

.tab-item {
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  color: var(--k-color-text-description);
  font-weight: 500;
}

.tab-item:hover {
  color: var(--k-color-text);
}

.tab-item.active {
  border-bottom-color: var(--k-color-active);
  color: var(--k-color-active);
}

.tab-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  padding-bottom: 80px; /* Space for save bar */
}

/* Koishi 风格滚动条 */
.tab-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
  transition: background-color 0.3s;
}

.tab-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}

.tab-content::-webkit-scrollbar-corner {
  background: transparent;
}

.permission-groups {
  overflow-y: auto;
  max-height: calc(100vh - 350px);
}

.permission-groups::-webkit-scrollbar {
  width: 6px;
}

.permission-groups::-webkit-scrollbar-track {
  background: transparent;
}

.permission-groups::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}

.permission-groups::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}

.form-group {
  margin-bottom: 1.5rem;
  max-width: 600px;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--k-color-text-description);
  font-size: 0.9rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--k-color-bg-1);
  color: var(--k-color-text);
  font-family: inherit;
  font-size: 0.9rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-active);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--k-color-bg-1);
  padding: 8px;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  width: fit-content;
}

.color-input {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
}

.color-text {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  width: 100px;
  font-family: monospace;
}

.checkbox-group {
  margin-top: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--k-color-text);
}

/* 当前已选权限显示 */
.current-perms {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 12px;
  background: var(--k-color-bg-1);
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
}

.perms-label {
  font-size: 0.85rem;
  color: var(--k-color-text-description);
  margin-right: 8px;
}

.perm-tag {
  padding: 4px 10px;
  background: #67c23a;
  color: white;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
}

/* 权限列表 */
.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
}

.permission-groups {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.group-header {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--k-color-text-description);
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--k-color-border);
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--k-color-bg-1);
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
  margin-bottom: 0.5rem;
}

.perm-info .perm-name {
  font-weight: 600;
  font-size: 1rem;
}

.perm-id {
  font-family: monospace;
  color: var(--k-color-text-description);
  font-size: 0.8rem;
  margin-top: 4px;
}

.perm-desc {
  font-size: 0.9rem;
  color: var(--k-color-text);
  margin-top: 4px;
}

/* 开关样式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--k-color-border, #ccc);
  transition: .3s;
  border-radius: 34px;
}

.toggle-switch .slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle-switch.active .slider {
  background-color: #67c23a; /* Green */
}

.toggle-switch.active .slider:before {
  transform: translateX(20px);
}

.toggle-switch:hover .slider {
  opacity: 0.9;
}

/* 成员列表 */
.add-member {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  max-width: 500px;
}

.member-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--k-color-bg-1);
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.member-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--k-color-bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
}

.member-text {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.member-id-sub {
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  font-family: monospace;
}

/* 保存浮动条 */
.save-bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #202225; /* Dark background like discord */
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 100;
  width: 80%;
  max-width: 600px;
  justify-content: space-between;
}

.save-actions {
  display: flex;
  gap: 10px;
}

.reset-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px 16px;
}

.save-btn {
  background: #43b581; /* Discord Green */
  border: none;
  color: white;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #3ca374;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}

.empty-state, .empty-tip {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--k-color-text-description);
  font-size: 1.1rem;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 1rem;
  opacity: 0.3;
}

/* 通用按钮样式 */
.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--k-color-active, #409eff);
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.icon-btn:hover {
  opacity: 0.85;
}

.primary-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--k-color-active, #409eff);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.primary-btn:hover {
  opacity: 0.85;
}

.secondary-btn {
  padding: 6px 12px;
  border: 1px solid var(--k-color-border, #dcdfe6);
  border-radius: 4px;
  background: transparent;
  color: var(--k-color-text, #303133);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.secondary-btn:hover {
  border-color: var(--k-color-active, #409eff);
  color: var(--k-color-active, #409eff);
}

.danger-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #f56c6c;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.danger-btn:hover {
  opacity: 0.85;
}

/* 自定义确认对话框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: var(--k-card-bg, white);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 320px;
  max-width: 480px;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--k-color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--k-color-text);
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0;
  color: var(--k-color-text);
  line-height: 1.6;
}

.modal-footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--k-color-border);
  background: var(--k-color-bg-1);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .modal-dialog,
.fade-leave-active .modal-dialog {
  transition: transform 0.2s ease;
}

.fade-enter-from .modal-dialog,
.fade-leave-to .modal-dialog {
  transform: scale(0.95);
}
</style>