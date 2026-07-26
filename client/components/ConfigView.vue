<template>
  <div class="config-view">
    <div class="view-header">
      <div class="header-left">
        <h2 class="view-title">群组配置</h2>
        <div class="search-wrapper">
          <k-icon name="search" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索群号或群名..."
            class="search-input"
          />
        </div>
      </div>
      <div class="header-actions">
        <div class="filter-tabs">
          <button class="filter-btn" :class="{ active: listFilter === 'all' }" @click="listFilter = 'all'">全部</button>
          <button class="filter-btn" :class="{ active: listFilter === 'guild' }" @click="listFilter = 'guild'">群组</button>
          <button class="filter-btn" :class="{ active: listFilter === 'group' }" @click="listFilter = 'group'">群组组</button>
        </div>
        <div class="toggle-wrapper" title="自动获取群名称和头像">
          <label>解析群名</label>
          <el-switch v-model="fetchNames" @change="refreshConfigs" />
        </div>
        <!-- 视图切换 -->
        <div class="view-toggle">
          <button class="view-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="卡片视图">
            <k-icon name="grid" />
            <span>卡片</span>
          </button>
          <button class="view-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="列表视图">
            <k-icon name="list" />
            <span>列表</span>
          </button>
        </div>

        <div class="divider-vertical"></div>

        <button class="btn btn-secondary" @click="reloadConfigs" :disabled="reloading" title="从文件重新加载配置数据">
          <k-icon name="loader" class="spin" v-if="reloading" />
          重载
        </button>
        <button class="btn btn-secondary" @click="refreshConfigs" title="刷新列表">
          <k-icon name="refresh-cw" />
          刷新
        </button>
        <button class="btn btn-primary" @click="showCreateDialog = true">
          <k-icon name="plus" />
          新建配置
        </button>
        <button class="btn btn-primary" @click="createGroupGroup">
          <k-icon name="layers" />
          新建群组组
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 群组列表 -->
    <div v-else class="config-list">
      <div v-if="combinedListItems.length === 0" class="empty-state">
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
            v-for="item in combinedListItems"
            :key="item.key"
            class="list-row"
            :class="{ 'group-row': item.type === 'group' }"
            @click="item.type === 'guild' ? editConfig(item.id) : openGroupGroupConfig(item.group!)"
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
              <button class="action-btn" @click="copyGuildId(item.id)" title="复制群号">
                <k-icon name="copy" />
                <span>复制</span>
              </button>
              <button class="action-btn" @click="item.type === 'guild' ? editConfig(item.id) : openGroupGroupConfig(item.group!)" title="编辑配置">
                <k-icon name="edit-2" />
                <span>编辑</span>
              </button>
              <button class="action-btn danger" @click="item.type === 'guild' ? deleteConfig(item.id) : deleteGroupGroup(item.group!)" title="删除配置">
                <k-icon name="trash-2" />
                <span>删除</span>
              </button>
            </div>
          </div>
        </div>

      <!-- 卡片视图 (使用 v-show 让 CSS 可以控制) -->
      <div v-show="viewMode === 'grid'" class="card-grid">
          <div
            v-for="item in combinedGridItems"
            :key="item.key"
            class="config-card"
            :class="{ 'group-card': item.type === 'group' }"
            @click="item.type === 'guild' ? editConfig(item.id) : openGroupGroupConfig(item.group!)"
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
              <k-button size="small" @click.stop="copyGuildId(item.id)" title="复制群号">
                <template #icon><k-icon name="copy" /></template>
                复制
              </k-button>
              <k-button size="small" @click.stop="item.type === 'guild' ? editConfig(item.id) : openGroupGroupConfig(item.group!)" title="编辑配置">
                <template #icon><k-icon name="edit-2" /></template>
                编辑
              </k-button>
              <k-button size="small" type="danger" @click.stop="item.type === 'guild' ? deleteConfig(item.id) : deleteGroupGroup(item.group!)" title="删除配置">
                <template #icon><k-icon name="trash-2" /></template>
                删除
              </k-button>
            </div>
          </div>
        </div>
    </div>

    <!-- 新建配置弹窗 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>新建群组配置</h3>
          <button class="close-btn" @click="showCreateDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>群号</label>
            <input
              v-model="newConfig.guildId"
              type="text"
              placeholder="输入群号..."
              class="form-input"
              @keyup.enter="createConfig"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showCreateDialog = false">取消</k-button>
          <k-button type="primary" @click="createConfig" :loading="creating">创建</k-button>
        </div>
      </div>
    </div>

    <!-- 编辑面板 -->
    <div v-if="showEditDialog" class="edit-overlay" @click.self="showEditDialog = false">
      <div class="edit-dialog large">
        <div class="dialog-header">
          <h3 v-if="editingMode === 'guild'">编辑群组配置 - {{ editingGuildId }}</h3>
          <h3 v-else>编辑群组组配置 - {{ editingGroupGroupId }}</h3>
          <button class="close-btn" @click="showEditDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        
        <div v-if="editingConfig" class="edit-layout">
          <!-- 左侧侧边栏 -->
          <div class="edit-sidebar">
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'entrance' }"
              @click="activeTab = 'entrance'"
            >
              <k-icon name="user-plus" />
              <span>入群设置</span>
            </div>
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'moderation' }"
              @click="activeTab = 'moderation'"
            >
              <k-icon name="shield" />
              <span>违规管理</span>
            </div>
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'exit' }"
              @click="activeTab = 'exit'"
            >
              <k-icon name="user-minus" />
              <span>退群设置</span>
            </div>
            <div class="divider" style="margin: 0.5rem 0.75rem; width: auto; opacity: 0.5;"></div>
            <div
              v-if="editingMode === 'group'"
              class="sidebar-item"
              :class="{ active: activeTab === 'group-meta' }"
              @click="activeTab = 'group-meta'"
            >
              <k-icon name="layers" />
              <span>群组组信息</span>
            </div>
            <div
              class="sidebar-item"
              :class="{ active: activeTab === 'plugins' }"
              @click="activeTab = 'plugins'"
            >
              <k-icon name="box" />
              <span>功能插件</span>
            </div>
          </div>

          <!-- 右侧内容区 -->
          <div class="edit-content">
            <div v-if="editingMode === 'group'" class="section-hint">
              群组组配置为局部合并，保存后将应用到该群组组包含的所有群聊。
            </div>
            <div v-if="editingMode === 'group' && activeTab === 'group-meta'" class="config-section">
              <div class="section-title">群组组信息</div>
              <div class="form-group">
                <label>群组组名称</label>
                <input type="text" v-model="editingGroupMeta.name" class="form-input" placeholder="群组组名称">
              </div>
              <div class="form-group">
                <label>群组组 ID</label>
                <input type="text" v-model="editingGroupMeta.id" class="form-input" :disabled="!isGroupGroupNew">
              </div>
              <div class="form-group">
                <label>描述</label>
                <input type="text" v-model="editingGroupMeta.description" class="form-input" placeholder="可选">
              </div>
              <div class="form-group">
                <label>包含的群聊</label>
                <div class="group-select-panel">
                  <div class="group-select-toolbar">
                    <input
                      type="text"
                      v-model="groupGuildSearch"
                      placeholder="搜索群号或群名..."
                      class="form-input"
                    >
                    <div class="group-actions">
                      <button class="btn btn-secondary" @click="selectAllGroupGuilds">全选</button>
                      <button class="btn btn-secondary" @click="clearGroupGuilds">清空</button>
                      <span class="group-count">已选 {{ editingGroupMeta.guildIds.length }}</span>
                    </div>
                  </div>
                  <div class="group-select-body">
                    <div class="group-checkbox-list" v-if="filteredGuildOptions.length">
                      <label v-for="item in filteredGuildOptions" :key="item.id" class="checkbox-label">
                        <input type="checkbox" :value="item.id" v-model="editingGroupMeta.guildIds">
                        <span>{{ item.label }}</span>
                      </label>
                    </div>
                    <div v-else class="empty-state">未找到匹配的群</div>
                    <div class="selected-chips" v-if="editingGroupMeta.guildIds.length">
                      <div class="chips-title">已选群聊</div>
                      <div class="chips-wrap">
                        <span class="chip" v-for="id in editingGroupMeta.guildIds" :key="id">{{ id }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>手动输入群聊 ID</label>
                <textarea v-model="editingGroupMetaGuildIds" class="form-textarea" rows="3" placeholder="每行一个群号，支持粘贴"></textarea>
                <div class="field-hint">输入内容会与已选合并并去重</div>
              </div>
            </div>
            <!-- 入群设置 -->
            <div v-show="activeTab === 'entrance'" class="config-section">
              <div class="section-title">入群欢迎</div>
              <div class="form-group">
                <label>启用欢迎消息</label>
                <ToggleSwitch v-model="editingConfig.welcomeEnabled" />
              </div>
              <div class="form-group" v-if="editingConfig.welcomeEnabled">
                <label>欢迎语</label>
                <textarea
                  v-model="editingConfig.welcomeMsg"
                  rows="3"
                  placeholder="输入欢迎消息... ({at}提新成员)"
                  class="form-textarea"
                ></textarea>
              </div>

              <div class="section-title" style="margin-top: 1.5rem;">入群验证</div>
              <div class="form-group">
                <label>自动拒绝</label>
                <ToggleSwitch v-model="autoReject" />
              </div>
              <div class="form-group">
                <label>拒绝回复</label>
                <el-input v-model="editingConfig.reject" placeholder="拒绝时的提示消息" />
              </div>
              <div class="form-group">
                <label>验证关键词</label>
                <textarea
                  v-model="editingApprovalKeywords"
                  rows="2"
                  placeholder="多个关键词用逗号分隔"
                  class="form-textarea"
                ></textarea>
              </div>
              <div class="form-group">
                <label>等级限制</label>
                <el-input-number v-model="editingConfig.levelLimit" :min="0" style="width: 100%" />
              </div>
            </div>

            <!-- 违规管理 -->
            <div v-show="activeTab === 'moderation'" class="config-section">
              <div class="section-title">警告设置</div>
              <div class="form-group">
                <label>警告阈值</label>
                <el-input-number v-model="editingConfig.warnLimit" :min="0" placeholder="留空使用全局设置" style="width: 100%" />
              </div>
              <div class="form-hint-row">
                <span class="form-hint">达到此次数后触发自动禁言（0=每次警告都禁言，留空则使用全局设置）</span>
              </div>

              <div class="section-title" style="margin-top: 1.5rem;">违规处理 (关键词/禁言)</div>
              <div class="form-group">
                <label>禁言关键词</label>
                <textarea
                  v-model="editingForbiddenKeywords"
                  rows="2"
                  placeholder="多个关键词用逗号分隔"
                  class="form-textarea"
                ></textarea>
              </div>
              <div class="form-group">
                <label>自动撤回</label>
                <ToggleSwitch v-model="editingConfig.forbidden.autoDelete" />
              </div>
              <div class="form-group">
                <label>自动禁言</label>
                <ToggleSwitch v-model="editingConfig.forbidden.autoBan" />
              </div>
               <div class="form-group">
                <label>自动踢出</label>
                <ToggleSwitch v-model="editingConfig.forbidden.autoKick" />
              </div>
              <div class="form-group">
                <label>触发回显</label>
                <ToggleSwitch v-model="editingConfig.forbidden.echo" />
              </div>
              <div class="form-group">
                <label>禁言时长(ms)</label>
                 <el-input-number v-model="editingConfig.forbidden.muteDuration" :min="0" :step="1000" style="width: 100%" />
              </div>
            </div>

            <!-- 退群设置 -->
            <div v-show="activeTab === 'exit'" class="config-section">
              <div class="section-title">退群欢送</div>
              <div class="form-group">
                <label>启用欢送消息</label>
                <ToggleSwitch v-model="editingConfig.goodbyeEnabled" />
              </div>
              <div class="form-group" v-if="editingConfig.goodbyeEnabled">
                <label>欢送语</label>
                <textarea
                  v-model="editingConfig.goodbyeMsg"
                  rows="3"
                  placeholder="输入欢送消息... ({at}提退群成员)"
                  class="form-textarea"
                ></textarea>
              </div>

              <div class="section-title" style="margin-top: 1.5rem;">其他设置</div>
              <div class="form-group">
                <label>退群冷却(天)</label>
                <el-input-number v-model="editingConfig.leaveCooldown" :min="0" style="width: 100%" />
              </div>
            </div>

            <!-- 功能插件 -->
            <div v-show="activeTab === 'plugins'" class="config-section">

              <!-- 防撤回 -->
              <div class="plugin-card">
                <div class="plugin-header" @click="togglePlugin('antiRecall')">
                  <div class="plugin-title">
                    <span>防撤回</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.antiRecall.enabled" @click.stop />
                    <k-icon :name="expandedPlugins['antiRecall'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['antiRecall']">
                   <div class="form-group">
                    <label>保存天数</label>
                    <el-input-number v-model="editingConfig.antiRecall.retentionDays" :min="1" :max="30" placeholder="默认使用全局设置" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>最大记录数</label>
                    <el-input-number v-model="editingConfig.antiRecall.maxRecordsPerUser" :min="10" :max="200" placeholder="默认使用全局设置" style="width: 100%" />
                  </div>
                </div>
              </div>
              
              <!-- 复读检测 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('repeat')">
                  <div class="plugin-title">
                    <span>复读检测</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.antiRepeat.enabled" @update:modelValue="handleRepeatSwitch" @click.stop />
                    <k-icon :name="expandedPlugins['repeat'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['repeat']">
                   <div class="form-group">
                    <label>复读阈值</label>
                    <el-input-number
                      v-model="editingConfig.antiRepeat.threshold"
                      :min="3"
                      placeholder="至少3条"
                      style="width: 100%"
                    />
                  </div>
                </div>
              </div>

              <!-- 掷骰子 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('dice')">
                  <div class="plugin-title">
                    <k-icon name="dice" />
                    <span>掷骰子</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.dice.enabled" @click.stop />
                    <k-icon :name="expandedPlugins['dice'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['dice']">
                   <div class="form-group">
                    <label>长度限制</label>
                    <el-input-number v-model="editingConfig.dice.lengthLimit" :min="10" style="width: 100%" />
                  </div>
                </div>
              </div>

              <!-- BanMe -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('banme')">
                  <div class="plugin-title">
                    <k-icon name="slash" />
                    <span>自我禁言</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.banme.enabled" @click.stop />
                    <k-icon :name="expandedPlugins['banme'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['banme']">
                   <div class="form-group">
                    <label>自动检测</label>
                    <ToggleSwitch v-model="editingConfig.banme.autoBan" />
                  </div>
                  <div class="form-group">
                    <label>最小时长(s)</label>
                    <el-input-number v-model="editingConfig.banme.baseMin" :min="1" style="width: 100%" />
                  </div>
                   <div class="form-group">
                    <label>最大时长(m)</label>
                    <el-input-number v-model="editingConfig.banme.baseMax" :min="1" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>增长系数</label>
                    <el-input-number v-model="editingConfig.banme.growthRate" :min="0" style="width: 100%" />
                  </div>
                  
                  <div class="divider-text">金卡系统</div>
                  
                  <div class="form-group">
                    <label>启用金卡</label>
                    <ToggleSwitch v-model="editingConfig.banme.jackpot.enabled" />
                  </div>
                  <div class="form-group">
                    <label>基础概率</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.baseProb" :min="0" :max="1" :step="0.001" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>软保底(抽)</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.softPity" :min="0" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>硬保底(抽)</label>
                    <el-input-number v-model="editingConfig.banme.jackpot.hardPity" :min="0" style="width: 100%" />
                  </div>
                  <div class="form-group">
                    <label>UP时长</label>
                    <el-input v-model="editingConfig.banme.jackpot.upDuration" placeholder="如 24h" />
                  </div>
                  <div class="form-group">
                    <label>歪时长</label>
                    <el-input v-model="editingConfig.banme.jackpot.loseDuration" placeholder="如 12h" />
                  </div>
                </div>
              </div>

              <!-- AI 对话 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('ai')">
                  <div class="plugin-title">
                    <k-icon name="bot" />
                    <span>AI 助手</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.openai.enabled" @click.stop />
                    <k-icon :name="expandedPlugins['ai'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['ai']">
                  <div class="form-group">
                    <label>启用对话</label>
                    <ToggleSwitch v-model="editingConfig.openai.chatEnabled" />
                  </div>
                  <div class="form-group">
                    <label>启用翻译</label>
                    <ToggleSwitch v-model="editingConfig.openai.translateEnabled" />
                  </div>
                  <div class="form-group">
                    <label>系统提示词</label>
                    <textarea
                      v-model="editingConfig.openai.systemPrompt"
                      rows="3"
                      class="form-textarea"
                      placeholder="留空使用全局设置"
                    ></textarea>
                  </div>
                   <div class="form-group">
                    <label>翻译提示词</label>
                    <textarea
                      v-model="editingConfig.openai.translatePrompt"
                      rows="3"
                      class="form-textarea"
                      placeholder="留空使用全局设置"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- 举报功能 -->
              <div class="plugin-card" style="margin-top: 1rem;">
                <div class="plugin-header" @click="togglePlugin('report')">
                  <div class="plugin-title">
                    <k-icon name="flag" />
                    <span>举报功能</span>
                  </div>
                  <div class="plugin-status">
                    <ToggleSwitch v-model="editingConfig.report.enabled" @click.stop />
                    <k-icon :name="expandedPlugins['report'] ? 'chevron-up' : 'chevron-down'" />
                  </div>
                </div>
                <div class="plugin-body" v-show="expandedPlugins['report']">
                  <div class="form-group">
                    <label>自动处理</label>
                    <ToggleSwitch v-model="editingConfig.report.autoProcess" />
                  </div>
                  <div class="form-group">
                    <label>包含上下文</label>
                    <ToggleSwitch v-model="editingConfig.report.includeContext" />
                  </div>
                  <div class="form-group" v-if="editingConfig.report.includeContext">
                    <label>上下文条数</label>
                    <el-input-number v-model="editingConfig.report.contextSize" :min="1" :max="50" style="width: 100%" />
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <div class="footer-right">
            <k-button @click="showEditDialog = false">取消</k-button>
            <k-button type="primary" @click="saveConfig" :loading="saving">保存</k-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteDialog" class="dialog-overlay" style="z-index: 1100" @click.self="showDeleteDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>删除群组配置</h3>
          <button class="close-btn" @click="showDeleteDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <p class="warning-text">警告：此操作不可撤销！</p>
          <p class="info-text">
            请输入群号
            <code class="code-highlight" @click="() => copyGuildId()">{{ editingGuildId }}</code>
            以确认删除
          </p>
          <div class="form-group">
            <label>确认群号</label>
            <input
              v-model="deleteConfirmId"
              type="text"
              :placeholder="'请输入 ' + editingGuildId"
              class="form-input"
              @keyup.enter="confirmDelete"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showDeleteDialog = false">取消</k-button>
          <k-button type="danger" @click="confirmDelete" :loading="deleting" :disabled="deleteConfirmId !== editingGuildId">删除</k-button>
        </div>
      </div>
    </div>
    <ConfirmDialog :state="confirmState" @accept="acceptConfirm" @cancel="cancelConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from '@koishijs/client'
import { configApi, authApi } from '../api'
import type { GroupConfig, GuildGroup } from '../types'
import { useConfirm } from '../composables/useConfirm'
import ConfirmDialog from './common/ConfirmDialog.vue'
import ToggleSwitch from './common/ToggleSwitch.vue'


const { confirmState, showConfirm, acceptConfirm, cancelConfirm } = useConfirm()
const loading = ref(false)
const saving = ref(false)
const creating = ref(false)
const deleting = ref(false)
const reloading = ref(false)
const fetchNames = ref(true)
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('list')
const configs = ref<Record<string, GroupConfig>>({})

const groupConfigs = ref<Record<string, Partial<GroupConfig>>>({})
const listFilter = ref<'all' | 'guild' | 'group'>('all')

const guildGroups = ref<GuildGroup[]>([])
const groupLoading = ref(false)
const groupSaving = ref(false)

// 过滤后的配置列表
const filteredConfigs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return configs.value

  const result: Record<string, GroupConfig> = {}
  for (const [guildId, config] of Object.entries(configs.value)) {
    const guildName = config.guildName?.toLowerCase() || ''
    if (guildId.includes(query) || guildName.includes(query)) {
      result[guildId] = config
    }
  }
  return result
})

const combinedListItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const items: Array<{ key: string; type: 'guild' | 'group'; id: string; config?: GroupConfig; group?: GuildGroup }> = []

  if (listFilter.value !== 'group') {
    for (const [guildId, config] of Object.entries(filteredConfigs.value)) {
      items.push({ key: `guild:${guildId}`, type: 'guild', id: guildId, config })
    }
  }

  if (listFilter.value !== 'guild') {
    for (const group of guildGroups.value) {
      const match = !query ||
        group.id.toLowerCase().includes(query) ||
        group.name.toLowerCase().includes(query)
      if (!match) continue
      const config = groupConfigs.value[group.id] as GroupConfig | undefined
      items.push({ key: `group:${group.id}`, type: 'group', id: group.id, group, config })
    }
  }

  return items
})

const combinedGridItems = computed(() => combinedListItems.value)
const showEditDialog = ref(false)
const editingMode = ref<'guild' | 'group'>('guild')
const editingGroupGroupId = ref('')
const editingGroupMeta = ref<GuildGroup>({ id: '', name: '', description: '', guildIds: [] })
const groupGuildSearch = ref('')
const isGroupGroupNew = computed(() => !editingGroupGroupId.value)
const editingGroupMetaGuildIds = computed({
  get: () => editingGroupMeta.value.guildIds.join('\n'),
  set: (val: string) => {
    const incoming = val.split('\n').map(s => s.trim()).filter(Boolean)
    const merged = Array.from(new Set([...editingGroupMeta.value.guildIds, ...incoming]))
    editingGroupMeta.value = { ...editingGroupMeta.value, guildIds: merged }
  }
})
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const newConfig = ref({ guildId: '' })
const deleteConfirmId = ref('')
const editingGuildId = ref('')
const editingConfig = ref<GroupConfig | null>(null)
const originalGroupGroupConfig = ref<Partial<GroupConfig>>({})
const editingApprovalKeywords = ref('')
const editingForbiddenKeywords = ref('')
const activeTab = ref('entrance')
const expandedPlugins = ref<Record<string, boolean>>({})

// 自动拒绝 (Boolean <-> String 'true'/'false')
const autoReject = computed({
  get: () => editingConfig.value?.auto === 'true',
  set: (val) => { if (editingConfig.value) editingConfig.value.auto = val ? 'true' : 'false' }
})

const togglePlugin = (key: string) => {
  expandedPlugins.value[key] = !expandedPlugins.value[key]
}

const refreshConfigs = async () => {
  loading.value = true
  try {
    configs.value = await configApi.list(fetchNames.value)
  } catch (e: any) {
    message.error(e.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

const refreshGuildGroups = async () => {
  groupLoading.value = true
  try {
    guildGroups.value = await authApi.getGuildGroups()
    groupConfigs.value = await configApi.groupGroupConfigList()
  } catch (e: any) {
    message.error(e.message || '加载群组组失败')
  } finally {
    groupLoading.value = false
  }
}

const createGroupGroup = () => {
  editingMode.value = 'group'
  editingGroupGroupId.value = ''
  editingGroupMeta.value = { id: '', name: '', description: '', guildIds: [] }
  const base = applyConfigDefaults({})
  originalGroupGroupConfig.value = cloneConfig(base)
  editingConfig.value = cloneConfig(base)
  editingApprovalKeywords.value = ''
  editingForbiddenKeywords.value = ''
  activeTab.value = 'group-meta'
  showEditDialog.value = true
}

const reloadConfigs = async () => {
  reloading.value = true
  try {
    const result = await configApi.reload()
    message.success(`已重新加载 ${result.count} 条配置`)
    await refreshConfigs()
  } catch (e: any) {
    message.error(e.message || '重新加载失败')
  } finally {
    reloading.value = false
  }
}

const editConfig = (guildId: string) => {
  editingMode.value = 'guild'
  editingGuildId.value = guildId
  const config = applyConfigDefaults({ ...configs.value[guildId] })

  editingConfig.value = config
  editingApprovalKeywords.value = (config.approvalKeywords || []).join(', ')
  editingForbiddenKeywords.value = (config.keywords || []).join(', ')
  activeTab.value = 'entrance'
  showEditDialog.value = true
}

const cloneConfig = <T,>(value: T): T => JSON.parse(JSON.stringify(value || {}))

/**
 * 补齐配置的各个功能分区，返回与入参完全独立的对象。
 *
 * 必须深拷贝：入参往往直接来自 configs.value[guildId]，而这里只在分区“缺失”时
 * 才新建对象——已存在的 forbidden / banme / openai 等会被原样引用出去，
 * 于是表单的 v-model 会直接改到列表数据上，用户点「取消」也撤不回来。
 */
const applyConfigDefaults = (config: Partial<GroupConfig>): GroupConfig => {
  const shaped: any = cloneConfig(config)
  if (!shaped.antiRecall) shaped.antiRecall = { enabled: false }
  if (!shaped.antiRepeat) shaped.antiRepeat = { enabled: false, threshold: 0 }
  if (!shaped.forbidden) shaped.forbidden = { autoDelete: false, autoBan: false, autoKick: false, muteDuration: 600000 }
  if (!shaped.dice) shaped.dice = { enabled: true, lengthLimit: 1000 }
  if (!shaped.banme) shaped.banme = {
    enabled: true, baseMin: 1, baseMax: 30, growthRate: 30,
    jackpot: { enabled: true, baseProb: 0.006, softPity: 73, hardPity: 89, upDuration: '24h', loseDuration: '12h' }
  }
  if (!shaped.openai) shaped.openai = { enabled: true, chatEnabled: true, translateEnabled: true }
  if (!shaped.report) shaped.report = { enabled: true, autoProcess: true, includeContext: false, contextSize: 10 }
  return shaped as GroupConfig
}

const openGroupGroupConfig = (group: GuildGroup) => {
  editingMode.value = 'group'
  editingGroupGroupId.value = group.id
  editingGroupMeta.value = {
    id: group.id,
    name: group.name,
    description: group.description || '',
    guildIds: Array.isArray(group.guildIds) ? [...group.guildIds] : []
  }
  const base = groupConfigs.value[group.id] || {}
  const shapedBase = applyConfigDefaults({ ...base })
  originalGroupGroupConfig.value = cloneConfig(shapedBase)
  editingConfig.value = cloneConfig(shapedBase)
  editingApprovalKeywords.value = (editingConfig.value.approvalKeywords || []).join(', ')
  editingForbiddenKeywords.value = (editingConfig.value.keywords || []).join(', ')
  activeTab.value = 'group-meta'
  showEditDialog.value = true
}

const guildOptions = computed(() => {
  return Object.entries(configs.value).map(([guildId, config]) => ({
    id: guildId,
    label: config.guildName ? `${config.guildName} (${guildId})` : guildId
  }))
})

const filteredGuildOptions = computed(() => {
  const query = groupGuildSearch.value.trim().toLowerCase()
  if (!query) return guildOptions.value
  return guildOptions.value.filter(item =>
    item.id.toLowerCase().includes(query) || item.label.toLowerCase().includes(query)
  )
})

const selectAllGroupGuilds = () => {
  editingGroupMeta.value.guildIds = filteredGuildOptions.value.map(item => item.id)
}

const clearGroupGuilds = () => {
  editingGroupMeta.value.guildIds = []
}

const handleRepeatSwitch = () => {
  if (!editingConfig.value?.antiRepeat) return
  
  if (editingConfig.value.antiRepeat.enabled) {
    if (!editingConfig.value.antiRepeat.threshold || editingConfig.value.antiRepeat.threshold < 3) {
      editingConfig.value.antiRepeat.threshold = 3
    }
  } else {
    editingConfig.value.antiRepeat.threshold = 0
  }
}

const saveConfig = async () => {
  if (!editingConfig.value) return

  // 验证欢迎语
  if (editingConfig.value.welcomeEnabled) {
    if (!editingConfig.value.welcomeMsg || !editingConfig.value.welcomeMsg.trim()) {
      message.error('开启欢迎语时内容不能为空')
      return
    }
  } else {
    // 关闭时自动置空
    editingConfig.value.welcomeMsg = ''
  }

  // 处理关键词
  editingConfig.value.approvalKeywords = editingApprovalKeywords.value
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(s => s)
  
  editingConfig.value.keywords = editingForbiddenKeywords.value
    .split(/[,，\n]/)
    .map(s => s.trim())
    .filter(s => s)

  saving.value = true
  try {
    if (editingMode.value === 'guild') {
      await configApi.update(editingGuildId.value, editingConfig.value)
      message.success('保存成功')
      showEditDialog.value = false
      await refreshConfigs()
      return
    }

    if (!editingGroupMeta.value.id.trim()) {
      message.warning('请填写群组组 ID')
      saving.value = false
      return
    }
    if (!editingGroupMeta.value.name.trim()) {
      message.warning('请填写群组组名称')
      saving.value = false
      return
    }

    editingGroupGroupId.value = editingGroupMeta.value.id.trim()

    const base = originalGroupGroupConfig.value || {}
    const current = editingConfig.value
    const diff = buildConfigDiff(base, current)
    await authApi.updateGuildGroup({
      id: editingGroupMeta.value.id.trim(),
      name: editingGroupMeta.value.name.trim(),
      description: editingGroupMeta.value.description?.trim() || '',
      guildIds: editingGroupMeta.value.guildIds
    })
    await configApi.groupGroupConfigUpdate(editingGroupGroupId.value, diff)
    message.success('群组组配置已保存')
    showEditDialog.value = false
    await refreshGuildGroups()
  } catch (e: any) {
    message.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const buildConfigDiff = (base: any, current: any): Partial<GroupConfig> => {
  const diff: any = Array.isArray(current) ? [] : {}

  if (Array.isArray(current)) {
    return JSON.stringify(current) === JSON.stringify(base) ? undefined as any : current
  }

  for (const key of Object.keys(current)) {
    const value = (current as any)[key]
    const baseValue = (base as any)?.[key]

    if (typeof value === 'undefined') continue

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const child = buildConfigDiff(baseValue || {}, value)
      if (typeof child !== 'undefined' && Object.keys(child).length > 0) {
        diff[key] = child
      }
      continue
    }

    if (JSON.stringify(value) !== JSON.stringify(baseValue)) {
      diff[key] = value
    }
  }

  return diff
}

const createConfig = async () => {
  const guildId = newConfig.value.guildId.trim()
  if (!guildId) {
    message.warning('请输入群号')
    return
  }

  creating.value = true
  try {
    await configApi.create(guildId)
    message.success('创建成功')
    showCreateDialog.value = false
    newConfig.value.guildId = ''
    await refreshConfigs()
    editConfig(guildId)
  } catch (e: any) {
    message.error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const deleteConfig = (guildId?: string) => {
  if (guildId) {
    editingGuildId.value = guildId
  }
  deleteConfirmId.value = ''
  showDeleteDialog.value = true
}

const deleteGroupGroup = async (group: GuildGroup) => {
  const ok = await showConfirm({
    title: '删除群组组',
    message: `确定要删除群组组 "${group.name}" 吗？`,
    type: 'danger'
  })
  if (!ok) return
  groupSaving.value = true
  try {
    await authApi.deleteGuildGroup(group.id)
    message.success('已删除群组组')
    await refreshGuildGroups()
  } catch (e: any) {
    message.error(e.message || '删除群组组失败')
  } finally {
    groupSaving.value = false
  }
}

const confirmDelete = async () => {
  if (deleteConfirmId.value !== editingGuildId.value) return

  deleting.value = true
  try {
    await configApi.delete(editingGuildId.value)
    message.success('删除成功')
    showDeleteDialog.value = false
    showEditDialog.value = false
    await refreshConfigs()
  } catch (e: any) {
    message.error(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

const copyGuildId = (guildId?: string) => {
  const id = guildId || editingGuildId.value
  navigator.clipboard.writeText(id)
  message.success('已复制群号')
}

onMounted(() => {
  refreshConfigs()
  refreshGuildGroups()
})
</script>

<style scoped>
/* ========== 使用 Koishi 全局 CSS 变量 ========== */
.config-view {
  --radius: 6px;
  --border: 1px solid var(--k-color-divider);

  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: var(--font-family);
}

/* ========== Guild Groups ========== */
.guild-groups-panel {
  margin-bottom: 16px;
  background: var(--k-color-card, rgba(24, 24, 28, 0.7));
  border: var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.groups-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
}

.groups-list {
  background: var(--k-color-card, rgba(24, 24, 28, 0.7));
  border: var(--border);
  border-radius: var(--radius);
  padding: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.group-item {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-item:hover {
  background: rgba(120, 120, 130, 0.08);
}

.group-item.active {
  border-color: var(--k-color-primary, #7459ff);
  background: rgba(116, 89, 255, 0.08);
}

.group-name {
  font-size: 0.85rem;
}

.group-id {
  font-size: 0.7rem;
  color: var(--k-color-text-secondary);
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}

.group-row-actions {
  display: flex;
  gap: 6px;
}

.section-hint {
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(120, 120, 130, 0.08);
  color: var(--k-color-text-secondary);
  font-size: 0.8rem;
}

.group-editor {
  background: var(--k-color-card, rgba(24, 24, 28, 0.7));
  border: var(--border);
  border-radius: var(--radius);
  padding: 12px;
}

.group-actions {
  display: flex;
  gap: 8px;
}

.group-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.group-count {
  font-size: 0.75rem;
  color: var(--k-color-text-secondary);
  align-self: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--k-color-text-secondary);
}

.group-select-panel {
  border: 1px solid var(--k-color-divider);
  border-radius: 8px;
  background: var(--k-card-bg);
  padding: 10px;
}

.group-select-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.group-select-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.selected-chips {
  border-left: 1px dashed var(--k-color-divider);
  padding-left: 12px;
  min-height: 120px;
}

.chips-title {
  font-size: 0.75rem;
  color: var(--k-color-text-secondary);
  margin-bottom: 6px;
}

.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(116, 89, 255, 0.12);
  color: var(--k-color-primary, #7459ff);
  font-size: 0.7rem;
  border: 1px solid rgba(116, 89, 255, 0.3);
}

.field-hint {
  margin-top: 4px;
  font-size: 0.7rem;
  color: var(--k-color-text-secondary);
}

/* ========== Header ========== */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--k-color-divider);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-tabs {
  display: flex;
  gap: 6px;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  padding: 4px;
}

.filter-btn {
  background: transparent;
  border: none;
  color: var(--fg3);
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.filter-btn.active {
  background: rgba(116, 89, 255, 0.15);
  color: var(--k-color-primary, #7459ff);
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--fg3);
  margin-right: 0.75rem;
  padding-right: 0.75rem;
  border-right: 1px solid var(--k-color-divider);
}

.toggle-wrapper label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* 视图切换按钮 */
.view-toggle {
  display: flex;
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  overflow: hidden;
  margin-right: 0.5rem;
}

.view-btn {
  background: var(--bg3);
  border: none;
  padding: 5px 8px;
  cursor: pointer;
  color: var(--fg3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.view-btn:first-child {
  border-right: 1px solid var(--k-color-divider);
}

.view-btn:hover {
  background: var(--k-card-bg);
  color: var(--fg1);
}

.view-btn.active {
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
}

.view-btn :deep(.k-icon) {
  font-size: 14px;
}

.view-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.25px;
}

/* ========== Header Left & Search ========== */
.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  margin-top: 10px;
  transition: border-color 0.15s ease;
}

.search-wrapper:focus-within {
  border-color: var(--k-color-primary);
}

.search-icon {
  color: var(--fg3);
  font-size: 14px;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  color: var(--fg1);
  font-size: 0.75rem;
  width: 200px;
  outline: none;
  font-family: var(--font-family);
}

.search-input::placeholder {
  color: var(--fg3);
}

.divider-vertical {
  width: 1px;
  height: 16px;
  background: var(--k-color-divider);
  margin: 0 0.5rem;
}

/* ========== Header Buttons Override ========== */
.btn {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.12s ease;
  user-select: none;
  border: var(--border);
  line-height: 1;
}

.btn-secondary {
  background: var(--bg3);
  color: var(--fg2);
}

.btn-secondary:hover {
  background: var(--bg3);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.btn-primary {
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
  border-color: rgba(116, 89, 255, 0.2);
}

.btn-primary:hover {
  background: rgba(116, 89, 255, 0.18);
  border-color: rgba(116, 89, 255, 0.35);
  color: var(--k-color-primary);
}

.header-actions :deep(.k-icon) {
  font-size: 14px;
}

/* ========== El-Switch Override ========== */
.toggle-wrapper :deep(.el-switch) {
  --el-switch-on-color: var(--k-color-primary);
  --el-switch-off-color: var(--bg3);
  --el-switch-border-color: var(--k-color-border);
  height: 18px;
}

.toggle-wrapper :deep(.el-switch__core) {
  min-width: 32px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid var(--k-color-border);
}

.toggle-wrapper :deep(.el-switch__core .el-switch__action) {
  width: 14px;
  height: 14px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 2.5rem;
  color: var(--fg3);
  font-size: 0.875rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

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

.action-btn :deep(.k-icon) {
  font-size: 12px;
}

/* 卡片网格视图 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

/* 响应式布局 */
@media (max-width: 900px) {
  .list-header,
  .list-row {
    grid-template-columns: 1fr 150px 190px;
  }

  .col-stats {
    display: none;
  }
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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
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

/* Card Footer Button Override */
.card-footer :deep(.k-button) {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--k-color-border);
  background: transparent;
  color: var(--fg3);
  font-weight: 500;
  transition: all 0.15s ease;
}

.card-footer :deep(.k-button:hover) {
  border-color: var(--fg3);
  color: var(--fg1);
  background: var(--bg3);
}

.card-footer :deep(.k-button[type="danger"]) {
  color: var(--k-color-danger);
  border-color: transparent;
}

.card-footer :deep(.k-button[type="danger"]:hover) {
  background: rgba(248, 81, 73, 0.15);
  border-color: var(--k-color-danger);
}

.card-footer :deep(.k-icon) {
  font-size: 12px;
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

/* ========== Dialog & Overlay ========== */
.edit-overlay, .dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.edit-dialog {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  width: 90%;
  max-width: 380px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.15s ease-out;
}

.dialog-body {
  padding: 1rem 1.25rem;
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.form-input::placeholder {
  color: var(--fg3);
}

.edit-dialog.large {
  max-width: 760px;
  height: 75vh;
  border-radius: 8px;
  animation: fadeIn 0.15s ease-out;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-border);
  background: var(--bg1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--fg1);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fg3);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.close-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
}

/* ========== Edit Layout ========== */
.edit-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.edit-sidebar {
  width: 140px;
  border-right: 1px solid var(--k-color-border);
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg1);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--fg2);
  font-size: 0.8125rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.sidebar-item:hover {
  background: var(--bg3);
  color: var(--fg1);
}

.sidebar-item.active {
  background: var(--bg3);
  color: var(--k-color-primary);
  font-weight: 500;
  border-left: 2px solid var(--k-color-primary);
  margin-left: -2px;
  padding-left: calc(0.75rem - 2px);
}

.edit-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  background: var(--k-card-bg);
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
  padding-left: 0.5rem;
  border-left: 2px solid var(--k-color-success);
}

.divider {
  height: 1px;
  background: var(--k-color-divider);
  margin: 0.75rem 0;
}

/* ========== Plugin Card ========== */
.plugin-card {
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--k-card-bg);
  transition: border-color 0.15s ease;
}

.plugin-card:hover {
  border-color: var(--fg3);
}

.plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--bg1);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.plugin-header:hover {
  background: var(--bg3);
}

.plugin-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--fg1);
}

.plugin-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--fg3);
}

.plugin-body {
  padding: 0.75rem;
  border-top: 1px solid var(--k-color-divider);
  background: var(--k-card-bg);
}

/* ========== Form Elements ========== */
.form-group {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 0.375rem 0;
}

.form-group label:first-child {
  width: 100px;
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg2);
}

.form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  resize: vertical;
  transition: border-color 0.15s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.form-textarea::placeholder {
  color: var(--fg3);
}

.form-hint-row {
  margin-top: -0.25rem;
  margin-bottom: 0.5rem;
  padding-left: calc(100px + 0.75rem);
}

.form-hint {
  font-size: 0.6875rem;
  color: var(--fg3);
  font-style: italic;
}

/* ========== El-Input Override ========== */
.config-section :deep(.el-input__wrapper),
.config-section :deep(.el-input-number),
.plugin-body :deep(.el-input__wrapper),
.plugin-body :deep(.el-input-number) {
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  box-shadow: none;
  transition: border-color 0.15s ease;
}

.config-section :deep(.el-input__wrapper:hover),
.config-section :deep(.el-input-number:hover),
.plugin-body :deep(.el-input__wrapper:hover),
.plugin-body :deep(.el-input-number:hover) {
  border-color: var(--fg3);
}

.config-section :deep(.el-input__wrapper.is-focus),
.plugin-body :deep(.el-input__wrapper.is-focus) {
  border-color: var(--k-color-primary) !important;
}

.config-section :deep(.el-input__inner),
.plugin-body :deep(.el-input__inner) {
  color: var(--fg1);
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
}

.config-section :deep(.el-input__inner::placeholder),
.plugin-body :deep(.el-input__inner::placeholder) {
  color: var(--fg3);
}

.config-section :deep(.el-input-number__decrease),
.config-section :deep(.el-input-number__increase),
.plugin-body :deep(.el-input-number__decrease),
.plugin-body :deep(.el-input-number__increase) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg2);
}

.config-section :deep(.el-input-number__decrease:hover),
.config-section :deep(.el-input-number__increase:hover),
.plugin-body :deep(.el-input-number__decrease:hover),
.plugin-body :deep(.el-input-number__increase:hover) {
  color: var(--k-color-primary);
}

/* ========== Toggle Switch ========== */






.divider-text {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0.75rem 0 0.375rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--k-color-divider);
}

/* ========== Dialog Footer ========== */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--k-color-border);
  background: var(--bg1);
}

.footer-left {
  display: flex;
  gap: 6px;
}

.footer-right {
  display: flex;
  gap: 6px;
}

/* Dialog Footer Button Override */
.dialog-footer :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--k-color-divider);
  background: var(--bg3);
  color: var(--fg2);
  font-weight: 500;
  transition: all 0.15s ease;
}

.dialog-footer :deep(.k-button:hover) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.dialog-footer :deep(.k-button[type="primary"]) {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary-tint);
  color: var(--k-color-primary);
}

.dialog-footer :deep(.k-button[type="primary"]:hover) {
  background: rgba(116, 89, 255, 0.25);
  border-color: rgba(116, 89, 255, 0.5);
}

.dialog-footer :deep(.k-button[type="danger"]) {
  background: rgba(248, 81, 73, 0.15);
  border-color: rgba(248, 81, 73, 0.3);
  color: var(--k-color-danger);
}

.dialog-footer :deep(.k-button[type="danger"]:hover) {
  background: rgba(248, 81, 73, 0.25);
  border-color: rgba(248, 81, 73, 0.5);
}

.dialog-footer :deep(.k-button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ========== Scrollbar ========== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--fg3);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ========== Delete Dialog ========== */
.warning-text {
  color: var(--k-color-danger);
  margin-bottom: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.info-text {
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
  color: var(--fg2);
}

.code-highlight {
  background: var(--bg1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-family-code);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  user-select: all;
  border: 1px solid var(--k-color-border);
  color: var(--fg1);
  transition: border-color 0.15s ease, color 0.15s ease;
}

.code-highlight:hover {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}

/* ========================================
   移动端适配 (< 768px)
   ======================================== */
@media (max-width: 768px) {
  .config-view {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--k-color-divider);
    flex-shrink: 0;
  }

  .header-left {
    flex-direction: column;
    gap: 0.5rem;
  }

  .view-title {
    font-size: 1rem;
  }

  .search-wrapper {
    width: 100%;
  }

  .search-input {
    width: 100%;
    font-size: 16px; /* 防止 iOS 缩放 */
    padding: 0.625rem 0.625rem 0.625rem 2.25rem;
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .toggle-wrapper {
    grid-column: 1 / -1;
    order: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
    background: var(--bg2);
    border-radius: 6px;
  }

  .toggle-wrapper label {
    font-size: 0.75rem;
  }

  /* 移动端隐藏视图切换（因为列表视图已被隐藏） */
  .view-toggle {
    display: none;
  }

  .divider-vertical {
    display: none;
  }

  .btn {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    justify-content: center;
  }

  .btn span {
    display: none;
  }

  .btn :deep(.k-icon) {
    margin: 0;
  }

  /* 群组列表区域 */
  .config-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 强制移动端使用卡片视图 */
  .list-table {
    display: none !important;
  }

  .card-grid {
    display: grid !important;
    grid-template-columns: 1fr;
    gap: 0.625rem;
    padding: 0.75rem;
  }

  .config-card {
    padding: 0.875rem;
    border-radius: 10px;
  }

  .card-header {
    margin-bottom: 0.625rem;
  }

  .guild-info {
    gap: 0.625rem;
  }

  .guild-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
  }

  .guild-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
    border-radius: 8px;
  }

  .guild-id {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .card-body {
    gap: 0.625rem;
  }

  .feature-badges {
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    border-radius: 4px;
  }

  .card-stats {
    font-size: 0.75rem;
    padding: 0.5rem;
    background: var(--bg2);
    border-radius: 6px;
    margin-top: 0.25rem;
  }

  .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-num {
    color: var(--k-color-primary);
  }

  .card-footer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.625rem;
    border-top: 1px solid var(--k-color-divider);
  }

  .card-footer .k-button {
    width: 100%;
    justify-content: center;
  }

  /* 弹窗适配 */
  .dialog-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .dialog-card {
    max-width: 100%;
    max-height: 85vh;
    margin: 0;
    border-radius: 16px 16px 0 0;
  }

  .dialog-header {
    padding: 0.875rem 1rem;
  }

  .dialog-header h3 {
    font-size: 1rem;
  }

  .dialog-body {
    padding: 1rem;
    max-height: 55vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .dialog-footer {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .dialog-footer .btn {
    flex: 1;
    min-width: 80px;
  }

  /* 表单 */
  .form-group {
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.8rem;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    font-size: 16px;
    padding: 0.625rem 0.75rem;
  }

  .form-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-col {
    flex: none;
    width: 100%;
  }

  /* 空状态 */
  .empty-state {
    padding: 3rem 1.5rem;
  }

  .empty-icon {
    font-size: 3rem;
  }

  .empty-state p {
    font-size: 0.875rem;
  }

  /* 编辑面板标签页 */
  .edit-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .edit-tabs .tab-item {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
}

/* 小屏手机适配 (< 480px) */
@media (max-width: 480px) {
  .view-header {
    padding: 0.5rem;
  }

  .view-title {
    font-size: 0.9rem;
  }

  .header-actions {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;
  }

  .btn {
    padding: 0.375rem 0.5rem;
    font-size: 0.7rem;
  }

  .card-grid {
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .config-card {
    padding: 0.625rem;
    border-radius: 8px;
  }

  .guild-avatar,
  .guild-icon {
    width: 32px;
    height: 32px;
  }

  .guild-id {
    font-size: 0.8rem;
  }

  .badge {
    padding: 0.2rem 0.375rem;
    font-size: 0.65rem;
  }

  .card-stats {
    font-size: 0.7rem;
    padding: 0.375rem;
  }

  .card-footer {
    gap: 0.375rem;
  }

  .card-footer .k-button {
    padding: 0.3rem 0.375rem;
    font-size: 0.7rem;
  }

  .edit-tabs .tab-item {
    padding: 0.375rem 0.625rem;
    font-size: 0.7rem;
  }
}

/* ========================================
   编辑弹窗移动端适配
   ======================================== */
@media (max-width: 768px) {
  .edit-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .edit-dialog.large {
    width: 100%;
    max-width: 100%;
    height: 90vh;
    max-height: 90vh;
    border-radius: 16px 16px 0 0;
    animation: slideUp 0.25s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .edit-layout {
    flex-direction: column;
  }

  /* 侧边栏改为顶部水平标签 */
  .edit-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--k-color-border);
    padding: 0.5rem;
    flex-direction: row;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .edit-sidebar::-webkit-scrollbar {
    display: none;
  }

  .sidebar-item {
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    white-space: nowrap;
    border-radius: 6px;
    border-left: none !important;
    margin-left: 0 !important;
    padding-left: 0.75rem !important;
  }

  .sidebar-item.active {
    border-left: none !important;
    border-bottom: 2px solid var(--k-color-primary);
    border-radius: 6px 6px 0 0;
  }

  .sidebar-item .k-icon {
    display: none;
  }

  .edit-sidebar .divider {
    display: none;
  }

  .edit-content {
    padding: 0.75rem;
    overflow-y: auto;
    flex: 1;
  }

  /* 表单组调整 */
  .config-section .form-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }

  .config-section .form-group label:first-child {
    width: 100%;
    font-size: 0.75rem;
  }

  .config-section .form-textarea {
    font-size: 16px;
  }

  .config-section .section-title {
    font-size: 0.7rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .form-hint-row {
    padding-left: 0;
    margin-top: 0.25rem;
  }

  /* 插件卡片 */
  .plugin-card {
    margin-top: 0.75rem;
  }

  .plugin-header {
    padding: 0.625rem 0.75rem;
  }

  .plugin-title {
    font-size: 0.8rem;
  }

  .plugin-body {
    padding: 0.625rem;
  }

  .plugin-body .form-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }

  .plugin-body .form-group label:first-child {
    width: 100%;
    font-size: 0.75rem;
  }

  .divider-text {
    font-size: 0.65rem;
    margin-top: 0.625rem;
  }

  /* Element Plus 输入框移动端适配 */
  .config-section :deep(.el-input__inner),
  .plugin-body :deep(.el-input__inner) {
    font-size: 16px;
  }

  .config-section :deep(.el-input-number) {
    width: 100% !important;
  }

  .plugin-body :deep(.el-input-number) {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .edit-dialog.large {
    height: 95vh;
    max-height: 95vh;
    border-radius: 12px 12px 0 0;
  }

  .dialog-header {
    padding: 0.625rem;
  }

  .dialog-header h3 {
    font-size: 0.85rem;
  }

  .edit-sidebar {
    padding: 0.375rem;
  }

  .sidebar-item {
    padding: 0.4rem 0.625rem;
    font-size: 0.7rem;
  }

  .edit-content {
    padding: 0.5rem;
  }

  .plugin-title span {
    font-size: 0.75rem;
  }

  .dialog-footer {
    padding: 0.5rem;
  }

  .dialog-footer :deep(.k-button) {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.75rem;
  }
}
</style>
