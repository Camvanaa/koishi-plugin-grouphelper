# 权限管理系统设计文档

## 1. 概述

本模块旨在为 GroupHelper 提供一个灵活、可视化的权限管理系统。设计参考 Discord 的角色（Role）权限体系，同时保持对 Koishi 原生数字权限（Authority 0-5）的完全兼容。

### 核心目标
- **细粒度控制**：通过权限节点（Permission Node）控制具体功能的访问（如 `grouphelper.warn.add`, `grouphelper.config.edit`）。
- **角色管理**：支持创建自定义角色，分配权限节点，并将角色授予用户。
- **兼容性**：Koishi 的原生权限等级（0-5）将作为基础“系统角色”存在，自动拥有对应等级的默认权限。
- **可视化**：提供类似 Discord 的 WebUI 进行角色管理和成员分配。

## 2. 核心概念

### 2.1 权限节点 (Permission Node)
权限节点是最小的控制单元，通常以字符串表示，例如：
- `auth.role.manage`: 管理角色的权限
- `warn.manage`: 管理警告记录
- `config.view`: 查看配置
- `config.edit`: 修改配置
- `*`: 超级管理员权限（所有权限）

### 2.2 角色 (Role)
角色是一组权限的集合。角色包含以下属性：
- **ID**: 唯一标识符
- **Name**: 角色名称（如 "管理员", "高级用户"）
- **Color**: 显示颜色（用于 WebUI）
- **Level**: 对应的 Koishi 权限等级（用于兼容，可选）
- **Permissions**: 权限节点列表 (List<string>)
- **Priority**: 优先级（用于排序和展示，高优先级覆盖低优先级显示）
- **Hoist**: 是否在成员列表中分开显示（UI 属性）
- **Mentionable**: 是否允许提及（UI 属性/Bot 行为）

### 2.3 权限计算策略
用户的最终权限由以下部分组合而成：
1. **原生等级映射**：根据用户的 Koishi `authority` (0-5)，自动获得该等级对应的基础权限集。
2. **自定义角色**：用户被显式分配的角色所包含的权限。
3. **独立权限**：直接赋予用户的特定权限节点（可选，作为覆盖）。

**判定逻辑**：
```typescript
function hasPermission(user: User, node: string): boolean {
  // 1. 检查是否是超级管理员 (Level 5)
  if (user.authority >= 5) return true;

  // 2. 获取用户的所有权限集合
  const perms = getUserPermissions(user);

  // 3. 检查集合中是否包含该节点，或包含通配符
  return perms.has(node) || perms.has('*') || checkWildcard(perms, node);
}
```

## 3. 数据结构设计

### 3.1 角色存储 (`auth_roles.json`)
```json
{
  "roles": {
    "admin": {
      "id": "admin",
      "name": "管理员",
      "color": "#ff0000",
      "priority": 100,
      "permissions": ["config.edit", "warn.manage", "blacklist.manage"],
      "hoist": true
    },
    "moderator": {
      "id": "moderator",
      "name": "协管员",
      "color": "#00ff00",
      "priority": 50,
      "permissions": ["warn.add", "warn.view"],
      "hoist": false
    }
  },
  "defaultLevels": {
    "1": ["warn.view"],
    "2": ["warn.add"],
    "3": ["config.view", "warn.manage"],
    "4": ["*"] 
  }
}
```

### 3.2 用户角色关联 (`auth_users.json`)
```json
{
  "users": {
    "12345678": ["admin"], // userId -> roleIds
    "87654321": ["moderator"]
  }
}
```

## 4. 功能模块设计

### 4.1 权限服务 (AuthService)
- `createRole(role)`: 创建角色
- `deleteRole(roleId)`: 删除角色
- `updateRole(roleId, data)`: 更新角色
- `assignRole(userId, roleId)`: 分配角色
- `revokeRole(userId, roleId)`: 移除角色
- `getPermissions(user)`: 获取用户的所有权限（计算后）
- `check(user, node)`: 检查权限

### 4.2 API 接口
提供给 WebUI 使用的 WebSocket API：
- `grouphelper/auth/role/list`: 获取所有角色
- `grouphelper/auth/role/update`: 创建/更新角色
- `grouphelper/auth/role/delete`: 删除角色
- `grouphelper/auth/user/get`: 获取某用户的角色列表
- `grouphelper/auth/user/assign`: 分配角色
- `grouphelper/auth/permission/list`: 获取系统所有可用的权限节点列表（用于前端选择）

## 5. WebUI 设计 (RolesView)

整体布局采用经典的两栏式设计，参考 Discord 角色管理界面。

### 5.1 侧边栏 (角色列表)
- **头部**：
  - 标题 "角色"
  - "创建角色" 按钮 (+)
- **列表区域**：
  - 显示所有角色列表。
  - 每个列表项显示：
    - 颜色圆点 (Color Dot)
    - 角色名称
    - 成员数量 (可选)
  - 支持 **拖拽排序**：直接拖动角色卡片上下移动来改变 `priority`。
- **底部**：搜索框 (可选)

### 5.2 主内容区 (编辑面板)
当在侧边栏选中一个角色时显示。

#### 顶部栏
- 角色名称（大标题）
- "保存更改" 按钮（仅在有未保存修改时显示/激活）
- "删除角色" 按钮（底部或顶部角落）

#### 标签页 (Tabs)

**1. 显示 (Display)**
- **角色名称**：文本输入框。
- **角色颜色**：
  - 颜色预览框。
  - 点击弹出颜色选择器 (Color Picker)。
  - 预设颜色块。
- **其他设置**：
  - [Switch] 允许任何人提及此角色 (@mention)
  - [Switch] 在成员列表中单独显示角色 (Hoist)

**2. 权限 (Permissions)**
- **搜索框**：搜索特定权限节点。
- **权限列表**：
  - 按类别分组（例如：通用、管理、功能）。
  - 每个权限项：
    - 标题 (e.g., "管理警告")
    - 描述 (e.g., "允许添加和删除警告记录")
    - 状态开关 (Toggle Switch)
  - "清除权限" 按钮。

**3. 成员 (Members)**
- **搜索添加**：
  - 输入框：输入用户 ID 或昵称。
  - 下拉选择或弹窗选择用户添加。
- **成员列表**：
  - 表格显示当前拥有该角色的成员。
  - 头像、昵称、ID。
  - 操作列：移除按钮 (X)。

## 6. 交互细节

- **未保存提醒**：如果修改了未保存，底部弹出浮动条 "检测到未保存的修改 - [重置] [保存更改]"。
- **默认角色**：`@everyone` 始终在列表最底部，不可移动，不可改名，但可编辑权限。
- **系统等级**：
  - 可以选择在列表中显示 Koishi Level 1-5 作为特殊角色（带锁图标？）。
  - 或者仅作为底层逻辑，不在角色列表中直接显示，避免混淆。建议采用后者，但在权限计算时合并。

## 7. 实施步骤

1. **后端实现**：
   - 创建 `AuthService`。
   - 实现数据存储 (`json.store`)。
   - 实现权限计算逻辑。
   - 注册 API。

2. **前端实现**：
   - 创建 `RolesView.vue`。
   - 实现角色列表和编辑器。
   - 实现权限选择器组件。

3. **集成**：
   - 在各功能模块（Warn, Config 等）的操作入口添加权限检查 (`ctx.auth.check(...)`)。
   - 更新 WebUI 现有的按钮（如“删除配置”），根据当前用户的权限禁用或隐藏。