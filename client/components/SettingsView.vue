<template>
  <div class="settings-view">
    <!-- Header -->
    <header class="view-header">
      <h2 class="view-title">全局设置</h2>
      <div class="header-actions">
        <button class="action-btn danger-outline" @click="resetToDefault">
          <k-icon name="rotate-ccw" class="btn-icon" />
          <span>恢复默认</span>
        </button>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span class="loading-text">Loading...</span>
    </div>

    <!-- Settings Content -->
    <div v-else class="settings-content">
      <!-- Mobile Section Selector -->
      <div class="mobile-section-selector">
        <div class="selector-current" @click="sectionDropdownOpen = !sectionDropdownOpen">
          <span class="current-label">{{ currentSectionLabel }}</span>
          <k-icon :name="sectionDropdownOpen ? 'chevron-up' : 'chevron-down'" class="selector-arrow" />
        </div>
        <transition name="dropdown">
          <div class="selector-dropdown" v-if="sectionDropdownOpen">
            <div
              v-for="section in sections"
              :key="section.id"
              class="selector-option"
              :class="{ active: activeSection === section.id }"
              @click="selectSection(section.id)"
            >
              {{ section.label }}
            </div>
          </div>
        </transition>
      </div>
      <div class="mobile-section-backdrop" v-if="sectionDropdownOpen" @click="sectionDropdownOpen = false"></div>

      <!-- Sidebar (PC) -->
      <nav class="settings-sidebar">
        <div
          v-for="section in sections"
          :key="section.id"
          class="sidebar-item"
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id"
        >
          <k-icon :name="section" class="sidebar-icon" />
          <span class="sidebar-label">{{ section.label }}</span>
        </div>
      </nav>

      <!-- Main Content -->
      <div class="settings-main">
        <!-- Warn Settings -->
        <div v-show="activeSection === 'warn'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">警告设置</h3>
            <p class="section-desc">配置警告次数限制和自动禁言规则</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">警告次数限制</label>
              <div class="form-control">
                <el-input-number v-model="settings.warnLimit" :min="0" :max="99" size="small" />
                <span class="form-hint">达到此次数后触发自动禁言（设为0表示每次警告都立即禁言）</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">禁言时长表达式</label>
              <div class="form-control">
                <el-input v-model="settings.banTimes.expression" placeholder="{t}^2h" size="small" />
                <span class="form-hint">{t} 代表警告次数，如 {t}^2h 表示警告次数的平方小时</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Forbidden Keywords -->
        <div v-show="activeSection === 'forbidden'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">禁言关键词</h3>
            <p class="section-desc">配置全局禁言关键词和自动处理规则</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">自动撤回</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.forbidden.autoDelete" />
                <span class="form-hint">自动撤回包含禁言关键词的消息</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">自动禁言</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.forbidden.autoBan" />
                <span class="form-hint">自动禁言发送禁言关键词的用户</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">自动踢出</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.forbidden.autoKick" />
                <span class="form-hint">自动踢出发送禁言关键词的用户</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">禁言时长 (ms)</label>
              <div class="form-control">
                <el-input-number v-model="settings.forbidden.muteDuration" :min="0" :step="60000" size="small" />
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">禁言关键词</label>
              <div class="form-control">
                <textarea
                  v-model="forbiddenKeywordsText"
                  rows="4"
                  placeholder="每行一个关键词"
                  class="form-textarea"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Keywords -->
        <div v-show="activeSection === 'keywords'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">入群审核</h3>
            <p class="section-desc">配置入群审核关键词</p>
          </div>
          <div class="form-grid">
            <div class="form-row full">
              <label class="form-label">审核关键词</label>
              <div class="form-control">
                <textarea
                  v-model="keywordsText"
                  rows="6"
                  placeholder="每行一个关键词"
                  class="form-textarea"
                ></textarea>
                <span class="form-hint">入群申请需要包含这些关键词才能通过审核</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dice -->
        <div v-show="activeSection === 'dice'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">掷骰子</h3>
            <p class="section-desc">配置掷骰子功能</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.dice.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">结果长度限制</label>
              <div class="form-control">
                <el-input-number v-model="settings.dice.lengthLimit" :min="100" :max="10000" size="small" />
                <span class="form-hint">超过此长度的结果将无法显示</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Banme -->
        <div v-show="activeSection === 'banme'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">Banme 自助禁言</h3>
            <p class="section-desc">配置自助禁言功能和金卡系统</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.banme.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">最小时长 (秒)</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.baseMin" :min="1" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">最大时长 (分钟)</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.baseMax" :min="1" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">递增系数</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.growthRate" :min="0" size="small" />
                <span class="form-hint">越大增长越快</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">自动禁言匹配</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.banme.autoBan" />
              </div>
            </div>
          </div>

          <div class="subsection-divider">金卡系统</div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用金卡</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.banme.jackpot.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">基础概率</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.jackpot.baseProb" :min="0" :max="1" :step="0.001" :precision="4" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">软保底 (抽)</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.jackpot.softPity" :min="0" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">硬保底 (抽)</label>
              <div class="form-control">
                <el-input-number v-model="settings.banme.jackpot.hardPity" :min="0" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">UP 奖励时长</label>
              <div class="form-control">
                <el-input v-model="settings.banme.jackpot.upDuration" placeholder="24h" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">歪奖励时长</label>
              <div class="form-control">
                <el-input v-model="settings.banme.jackpot.loseDuration" placeholder="12h" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- Friend Request -->
        <div v-show="activeSection === 'friendRequest'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">好友申请</h3>
            <p class="section-desc">配置好友申请验证</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用验证</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.friendRequest.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">拒绝消息</label>
              <div class="form-control">
                <el-input v-model="settings.friendRequest.rejectMessage" placeholder="请输入正确的验证信息" size="small" />
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">通过关键词</label>
              <div class="form-control">
                <textarea
                  v-model="friendKeywordsText"
                  rows="4"
                  placeholder="每行一个关键词"
                  class="form-textarea"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Guild Request -->
        <div v-show="activeSection === 'guildRequest'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">入群邀请</h3>
            <p class="section-desc">配置入群邀请处理</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">手动处理</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.guildRequest.manual" />
                <span class="form-hint">开启后收到群邀请不自动处理，仅推送通知，由管理员在 QQ 客户端手动同意/拒绝</span>
              </div>
            </div>
            <div class="form-row" v-if="!settings.guildRequest.manual">
              <label class="form-label">自动同意</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.guildRequest.enabled" />
                <span class="form-hint">启用时同意所有邀请，禁用时拒绝所有</span>
              </div>
            </div>
            <div class="form-row" v-if="!settings.guildRequest.manual">
              <label class="form-label">拒绝消息</label>
              <div class="form-control">
                <el-input v-model="settings.guildRequest.rejectMessage" placeholder="暂不接受入群邀请" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- Essence Message -->
        <div v-show="activeSection === 'essence'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">精华消息</h3>
            <p class="section-desc">配置精华消息功能</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.setEssenceMsg.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">所需权限等级</label>
              <div class="form-control">
                <el-input-number v-model="settings.setEssenceMsg.authority" :min="1" :max="5" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- Title -->
        <div v-show="activeSection === 'title'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">头衔设置</h3>
            <p class="section-desc">配置头衔功能</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.setTitle.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">所需权限等级</label>
              <div class="form-control">
                <el-input-number v-model="settings.setTitle.authority" :min="1" :max="5" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">头衔最大长度</label>
              <div class="form-control">
                <el-input-number v-model="settings.setTitle.maxLength" :min="1" :max="50" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- Anti Repeat -->
        <div v-show="activeSection === 'antiRepeat'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">反复读</h3>
            <p class="section-desc">配置反复读检测功能</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.antiRepeat.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">触发阈值</label>
              <div class="form-control">
                <el-input-number v-model="settings.antiRepeat.threshold" :min="2" :max="20" size="small" />
                <span class="form-hint">超过该次数将撤回除第一条外的所有复读消息</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Anti Recall -->
        <div v-show="activeSection === 'antiRecall'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">防撤回</h3>
            <p class="section-desc">配置防撤回功能</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.antiRecall.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">保存天数</label>
              <div class="form-control">
                <el-input-number v-model="settings.antiRecall.retentionDays" :min="1" :max="30" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">每用户最大记录数</label>
              <div class="form-control">
                <el-input-number v-model="settings.antiRecall.maxRecordsPerUser" :min="10" :max="200" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">显示原消息时间</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.antiRecall.showOriginalTime" />
              </div>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div v-show="activeSection === 'status'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">状态图</h3>
            <p class="section-desc">配置 gstatus 状态图渲染</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">渲染超时 (毫秒)</label>
              <div class="form-control">
                <el-input-number v-model="settings.status.renderTimeout" :min="0" :step="1000" size="small" />
                <span class="form-hint">0 表示不限制，默认 30000</span>
              </div>
            </div>
          </div>
        </div>

        <!-- OpenAI -->
        <div v-show="activeSection === 'openai'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">AI 功能</h3>
            <p class="section-desc">配置 OpenAI 兼容 API</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.openai.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">启用对话</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.openai.chatEnabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">启用翻译</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.openai.translateEnabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">API 密钥</label>
              <div class="form-control">
                <el-input v-model="settings.openai.apiKey" type="password" show-password placeholder="sk-..." size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">API 地址</label>
              <div class="form-control">
                <el-input v-model="settings.openai.apiUrl" placeholder="https://api.openai.com/v1" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">模型名称</label>
              <div class="form-control">
                <el-input v-model="settings.openai.model" placeholder="gpt-3.5-turbo" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">最大 Token 数</label>
              <div class="form-control">
                <el-input-number v-model="settings.openai.maxTokens" :min="256" :max="32768" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">温度</label>
              <div class="form-control">
                <el-input-number v-model="settings.openai.temperature" :min="0" :max="2" :step="0.1" :precision="1" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">上下文消息数</label>
              <div class="form-control">
                <el-input-number v-model="settings.openai.contextLimit" :min="1" :max="50" size="small" />
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">系统提示词</label>
              <div class="form-control">
                <textarea
                  v-model="settings.openai.systemPrompt"
                  rows="4"
                  class="form-textarea"
                  placeholder="你是一个有帮助的AI助手..."
                ></textarea>
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">翻译提示词</label>
              <div class="form-control">
                <textarea
                  v-model="settings.openai.translatePrompt"
                  rows="4"
                  class="form-textarea"
                  placeholder="翻译提示词..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Report -->
        <div v-show="activeSection === 'report'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">举报功能</h3>
            <p class="section-desc">配置 AI 辅助举报审核</p>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">启用功能</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.report.enabled" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">所需权限等级</label>
              <div class="form-control">
                <el-input-number v-model="settings.report.authority" :min="1" :max="5" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">自动处理</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.report.autoProcess" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">自动撤回</label>
              <div class="form-control">
                <ToggleSwitch v-model="settings.report.autoRecall" />
                <span class="form-hint">处罚成功后自动撤回被举报消息</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">举报时间限制 (分)</label>
              <div class="form-control">
                <el-input-number v-model="settings.report.maxReportTime" :min="0" size="small" />
                <span class="form-hint">0 表示不限制</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">冷却时间 (分)</label>
              <div class="form-control">
                <el-input-number v-model="settings.report.maxReportCooldown" :min="0" size="small" />
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">免冷却权限等级</label>
              <div class="form-control">
                <el-input-number v-model="settings.report.minAuthorityNoLimit" :min="1" :max="5" size="small" />
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">默认审核提示词</label>
              <div class="form-control">
                <textarea
                  v-model="settings.report.defaultPrompt"
                  rows="6"
                  class="form-textarea"
                  placeholder="AI 审核提示词..."
                ></textarea>
              </div>
            </div>
            <div class="form-row full">
              <label class="form-label">带上下文审核提示词</label>
              <div class="form-control">
                <textarea
                  v-model="settings.report.contextPrompt"
                  rows="6"
                  class="form-textarea"
                  placeholder="带上下文的 AI 审核提示词..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Cache -->
        <div v-show="activeSection === 'cache'" class="config-section">
          <div class="section-header">
            <h3 class="section-title">缓存管理</h3>
            <p class="section-desc">管理群组、用户和成员信息缓存，提升页面加载速度</p>
          </div>

          <div v-if="cacheLoading" class="loading-state">
            <k-icon name="loader" class="spin" />
            <span class="loading-text">Loading...</span>
          </div>

          <div v-else-if="cacheStats" class="cache-stats">
            <div class="stat-row">
              <span class="stat-label">群组缓存</span>
              <span class="stat-value mono">{{ cacheStats.guilds }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">用户缓存</span>
              <span class="stat-value mono">{{ cacheStats.users }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">成员缓存</span>
              <span class="stat-value mono">{{ cacheStats.members }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">最后刷新</span>
              <span class="stat-value mono">{{ cacheStats.lastFullRefreshTime }}</span>
            </div>
          </div>

          <div class="cache-actions">
            <button class="action-btn primary" @click="refreshCache" :disabled="cacheRefreshing">
              <k-icon name="refresh-cw" class="btn-icon" :class="{ spin: cacheRefreshing }" />
              <span>强制刷新</span>
            </button>
            <button class="action-btn" @click="clearCache">
              <k-icon name="trash-2" class="btn-icon" />
              <span>清空缓存</span>
            </button>
            <button class="action-btn" @click="loadCacheStats">
              <k-icon name="bar-chart-2" class="btn-icon" />
              <span>重新加载</span>
            </button>
          </div>

          <div class="info-box">
            <k-icon name="info" class="info-icon" />
            <div class="info-content">
              <p><strong>关于缓存:</strong></p>
              <ul>
                <li>缓存会在插件启动时自动预热，收集所有需要的群组和用户信息</li>
                <li>缓存有效期为 7 天，过期后会自动从 Bot 重新获取最新信息</li>
                <li>刷新缓存会强制更新所有已缓存的信息，适合在群组或用户信息变更后使用</li>
                <li>清空缓存会删除所有缓存数据，下次访问时会重新获取</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Save Bar -->
    <transition name="slide-up">
      <div class="save-bar" v-if="hasChanges">
        <span class="save-bar-text">检测到未保存的修改</span>
        <div class="save-actions">
          <button class="save-bar-btn secondary" :disabled="saving" @click="resetChanges">放弃更改</button>
          <button class="save-bar-btn primary" :disabled="saving" @click="saveSettings">
            {{ saving ? '保存中...' : '保存更改' }}
          </button>
        </div>
      </div>
    </transition>

    <!-- 统一确认对话框 -->
    <ConfirmDialog :state="confirmState" @accept="acceptConfirm" @cancel="cancelConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { message } from '@koishijs/client'
import { settingsApi, cacheApi, type CacheStats } from '../api'
import { useConfirm } from '../composables/useConfirm'
import ConfirmDialog from './common/ConfirmDialog.vue'
import ToggleSwitch from './common/ToggleSwitch.vue'

// 默认配置结构
const defaultSettings = {
  keywords: [],
  warnLimit: 3,
  banTimes: { expression: '{t}^2h' },
  forbidden: {
    autoDelete: false,
    autoBan: false,
    autoKick: false,
    muteDuration: 600000,
    keywords: []
  },
  dice: { enabled: true, lengthLimit: 1000 },
  banme: {
    enabled: true,
    baseMin: 1,
    baseMax: 30,
    growthRate: 30,
    autoBan: false,
    jackpot: {
      enabled: true,
      baseProb: 0.006,
      softPity: 73,
      hardPity: 89,
      upDuration: '24h',
      loseDuration: '12h'
    }
  },
  friendRequest: {
    enabled: false,
    keywords: [],
    rejectMessage: '请输入正确的验证信息'
  },
  guildRequest: {
    enabled: false,
    manual: false,
    rejectMessage: '暂不接受入群邀请'
  },
  setEssenceMsg: { enabled: true, authority: 3 },
  setTitle: { enabled: true, authority: 3, maxLength: 18 },
  antiRepeat: { enabled: false, threshold: 3 },
  openai: {
    enabled: false,
    chatEnabled: true,
    translateEnabled: true,
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个有帮助的AI助手，请简短、准确地回答问题。',
    translatePrompt: '',
    maxTokens: 2048,
    temperature: 0.7,
    contextLimit: 10
  },
  report: {
    enabled: true,
    authority: 1,
    autoProcess: true,
    autoRecall: true,
    defaultPrompt: '',
    contextPrompt: '',
    maxReportTime: 30,
    maxReportCooldown: 60,
    minAuthorityNoLimit: 2,
    guildConfigs: {}
  },
  antiRecall: {
    enabled: false,
    retentionDays: 7,
    maxRecordsPerUser: 50,
    showOriginalTime: true
  },
  status: {
    renderTimeout: 30000
  },
  replies: {
    locale: 'zh-CN',
    activePreset: 'cyber-neko',
    customPresets: {}
  }
}

/**
 * 取一份与 defaultSettings 完全独立的副本。
 *
 * 表单会就地改写这些嵌套对象，浅拷贝会让编辑内容回流到 defaultSettings，
 * 使「恢复默认」恢复出用户当前正在编辑的值。
 */
const cloneDefaults = () => JSON.parse(JSON.stringify(defaultSettings))

const loading = ref(true)
const saving = ref(false)
const settings = ref<any>(cloneDefaults())
const originalSettings = ref<string>('') // 原始设置的 JSON 字符串用于比较
const activeSection = ref('warn')
const sectionDropdownOpen = ref(false)

// 当前选中的 section 标签
const currentSectionLabel = computed(() => {
  const section = sections.find(s => s.id === activeSection.value)
  return section ? section.label : '警告设置'
})

// 选择 section（移动端下拉使用）
const selectSection = (id: string) => {
  activeSection.value = id
  sectionDropdownOpen.value = false
}

// 确认弹窗（Promise 化，见 useConfirm）
const { confirmState, showConfirm, acceptConfirm, cancelConfirm } = useConfirm()

// 检测是否有未保存的修改
const hasChanges = computed(() => {
  if (!originalSettings.value) return false
  return JSON.stringify(settings.value) !== originalSettings.value
})

// 将数组转换为文本
const keywordsText = computed({
  get: () => (settings.value.keywords || []).join('\n'),
  set: (val) => { settings.value.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) }
})

const forbiddenKeywordsText = computed({
  get: () => (settings.value.forbidden?.keywords || []).join('\n'),
  set: (val) => { 
    if (!settings.value.forbidden) settings.value.forbidden = {}
    settings.value.forbidden.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) 
  }
})

const friendKeywordsText = computed({
  get: () => (settings.value.friendRequest?.keywords || []).join('\n'),
  set: (val) => { 
    if (!settings.value.friendRequest) settings.value.friendRequest = {}
    settings.value.friendRequest.keywords = val.split('\n').map((s: string) => s.trim()).filter((s: string) => s) 
  }
})

const sections = [
  { id: 'warn', label: '警告设置'},
  { id: 'forbidden', label: '禁言关键词'},
  { id: 'keywords', label: '入群审核'},
  { id: 'dice', label: '掷骰子'},
  { id: 'banme', label: '自我禁言'},
  { id: 'friendRequest', label: '好友申请'},
  { id: 'guildRequest', label: '入群邀请'},
  { id: 'essence', label: '精华消息'},
  { id: 'title', label: '头衔设置'},
  { id: 'antiRepeat', label: '反复读'},
  { id: 'antiRecall', label: '防撤回'},
  { id: 'status', label: '状态图'},
  { id: 'openai', label: 'AI功能'},
  { id: 'report', label: '举报功能'},
  { id: 'cache', label: '缓存管理'}
]

// 深度合并对象
const deepMerge = (target: any, source: any) => {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

const loadSettings = async () => {
  loading.value = true
  try {
    const data = await settingsApi.get()
    // 深度合并默认值和返回数据。
    // 必须深拷贝 defaultSettings：展开运算符只复制第一层，
    // deepMerge 会就地改写 forbidden / banme / openai 等嵌套对象，
    // 那样默认值会被服务器数据（以及后续表单编辑）永久污染，
    // 「恢复默认」拿到的就不再是默认值。
    settings.value = deepMerge(cloneDefaults(), data || {})
    // 保存原始设置用于比较
    originalSettings.value = JSON.stringify(settings.value)
  } catch (e: any) {
    message.error(e.message || '加载设置失败')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await settingsApi.update(settings.value)
    // 更新原始设置
    originalSettings.value = JSON.stringify(settings.value)
    message.success('设置已保存')
  } catch (e: any) {
    message.error(e.message || '保存设置失败')
  } finally {
    saving.value = false
  }
}

const resetChanges = async () => {
  const confirmed = await showConfirm({
    title: '放弃更改',
    message: '确定要放弃当前所有未保存的修改吗？',
    type: 'normal'
  })
  
  if (confirmed) {
    // 从原始设置恢复
    settings.value = JSON.parse(originalSettings.value)
    message.success('已放弃更改')
  }
}

const resetToDefault = async () => {
  const confirmed = await showConfirm({
    title: '恢复默认设置',
    message: '确定要将所有设置恢复为默认值吗？此操作将覆盖当前所有设置，需要保存后才会生效。',
    type: 'danger'
  })
  
  if (confirmed) {
    // 恢复为默认设置
    settings.value = cloneDefaults()
    message.success('已恢复默认设置，请保存以应用更改')
  }
}

// 缓存管理
const cacheStats = ref<CacheStats | null>(null)
const cacheLoading = ref(false)
const cacheRefreshing = ref(false)

const loadCacheStats = async () => {
  cacheLoading.value = true
  try {
    cacheStats.value = await cacheApi.stats()
  } catch (e: any) {
    message.error(e.message || '获取缓存统计失败')
  } finally {
    cacheLoading.value = false
  }
}

const refreshCache = async () => {
  const confirmed = await showConfirm({
    title: '刷新缓存',
    message: '确定要强制刷新所有缓存吗？这可能需要一些时间。',
    type: 'normal'
  })
  if (!confirmed) return
  
  cacheRefreshing.value = true
  try {
    const result = await cacheApi.refresh()
    cacheStats.value = result.stats
    message.success('缓存刷新完成')
  } catch (e: any) {
    message.error(e.message || '刷新缓存失败')
  } finally {
    cacheRefreshing.value = false
  }
}

const clearCache = async () => {
  const confirmed = await showConfirm({
    title: '清空缓存',
    message: '确定要清空所有缓存吗？',
    type: 'danger'
  })
  if (!confirmed) return
  
  try {
    await cacheApi.clear()
    await loadCacheStats()
    message.success('缓存已清空')
  } catch (e: any) {
    message.error(e.message || '清空缓存失败')
  }
}

// 监听activeSection变化，切换到缓存管理时加载统计
watch(activeSection, (newVal) => {
  if (newVal === 'cache') {
    loadCacheStats()
  }
})

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
/* ========================================
   GitHub Dimmed / Vercel Style
   ======================================== */

.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--k-color-divider);
}

.view-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.01em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Action Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg2);
  background: var(--bg2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
  border-color: var(--fg3);
}

.action-btn:active {
  background: var(--bg1);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  color: var(--fg0);
  background: var(--k-color-primary);
  border-color: var(--k-color-primary);
}

.action-btn.primary:hover {
  background: var(--k-color-primary-shade);
  border-color: var(--k-color-primary-shade);
}

.action-btn.danger {
  color: var(--fg0);
  background: var(--k-color-danger);
  border-color: var(--k-color-danger);
}

.action-btn.danger:hover {
  background: var(--k-color-danger-shade);
  border-color: var(--k-color-danger-shade);
}

.action-btn.danger-outline {
  color: var(--k-color-danger);
  background: transparent;
  border-color: var(--k-color-border);
}

.action-btn.danger-outline:hover {
  background: var(--k-color-danger-fade);
  border-color: var(--k-color-danger);
}

.btn-icon {
  font-size: 13px;
  opacity: 0.8;
}

.action-btn:hover .btn-icon {
  opacity: 1;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--fg3);
}

.loading-text {
  font-size: 12px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Settings Content */
.settings-content {
  flex: 1;
  display: flex;
  background: var(--bg2);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  overflow: hidden;
}

/* Sidebar */
.settings-sidebar {
  width: 160px;
  border-right: 1px solid var(--k-color-divider);
  padding: 8px;
  overflow-y: auto;
  background: var(--bg1);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fg2);
  font-size: 12px;
  transition: all 0.15s ease;
  margin-bottom: 2px;
}

.sidebar-item:hover {
  background: var(--bg3);
  color: var(--fg1);
}

.sidebar-item.active {
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary-tint);
}

.sidebar-icon {
  font-size: 14px;
  opacity: 0.7;
}

.sidebar-item.active .sidebar-icon {
  opacity: 1;
}

.sidebar-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Main Content */
.settings-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--k-color-divider);
}

.section-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
}

.section-desc {
  margin: 0;
  font-size: 11px;
  color: var(--fg3);
}

/* Form Layout */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.form-row.full {
  flex-direction: column;
  gap: 6px;
}

.form-label {
  width: 130px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg2);
  padding-top: 6px;
}

.form-row.full .form-label {
  width: auto;
  padding-top: 0;
}

.form-control {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.form-row.full .form-control {
  width: 100%;
}

.form-hint {
  font-size: 11px;
  color: var(--fg3);
}

.form-textarea {
  width: 100%;
  max-width: 500px;
  padding: 8px 10px;
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  background: var(--bg0);
  color: var(--fg1);
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  resize: vertical;
  transition: border-color 0.15s ease;
}

.form-textarea::placeholder {
  color: var(--fg3);
}

.form-textarea:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

/* Toggle Switch */






/* Subsection Divider */
.subsection-divider {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12px 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--k-color-divider);
}

/* Cache Stats */
.cache-stats {
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed var(--k-color-divider);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 12px;
  color: var(--fg2);
}

.stat-value {
  font-size: 12px;
  color: var(--k-color-primary-tint);
  font-weight: 500;
}

.stat-value.mono {
  font-family: 'SF Mono', 'Consolas', monospace;
}

.cache-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

/* Info Box */
.info-box {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--k-color-primary-fade);
  border: 1px solid rgba(116, 89, 255, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--fg2);
}

.info-icon {
  flex-shrink: 0;
  color: var(--k-color-primary-tint);
  margin-top: 2px;
}

.info-content p {
  margin: 0 0 6px;
}

.info-content ul {
  margin: 0;
  padding-left: 16px;
}

.info-content li {
  margin-bottom: 4px;
  line-height: 1.5;
}

.info-content li:last-child {
  margin-bottom: 0;
}

/* Save Bar - Discord 风格 */
.save-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 560px;
  background: #111214;
  padding: 10px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.save-bar-text {
  font-size: 0.8125rem;
  color: #b5bac1;
  font-weight: 400;
}

.save-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.save-bar-btn {
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-bar-btn.secondary {
  background: transparent;
  border: none;
  color: #b5bac1;
}

.save-bar-btn.secondary:hover {
  text-decoration: underline;
}

.save-bar-btn.primary {
  background: #248046;
  border: none;
  color: #fff;
}

.save-bar-btn.primary:hover {
  background: #1a6334;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 20px);
  opacity: 0;
}

/* Modal Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  min-width: 300px;
  max-width: 400px;
  overflow: hidden;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg2);
}

.modal-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
}

.modal-body {
  padding: 16px;
}

.modal-text {
  margin: 0;
  font-size: 13px;
  color: var(--fg2);
  line-height: 1.6;
}

.modal-footer {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--k-color-divider);
  background: var(--bg2);
}

/* Fade Animation */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .modal-dialog,
.fade-leave-active .modal-dialog {
  transition: transform 0.15s ease;
}

.fade-enter-from .modal-dialog,
.fade-leave-to .modal-dialog {
  transform: scale(0.95);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--k-color-divider);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--fg3);
}

/* Mono Text */
.mono {
  font-family: 'SF Mono', 'Consolas', monospace;
}

/* Mobile Section Selector - 默认隐藏 */
.mobile-section-selector {
  display: none;
}

.mobile-section-backdrop {
  display: none;
}

/* ========== Mobile Responsive ========== */
@media (max-width: 768px) {
  .settings-view {
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

  .view-title {
    font-size: 1.1rem;
  }

  .header-actions {
    width: 100%;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
    padding: 0.625rem 1rem;
  }

  /* 设置内容布局 */
  .settings-content {
    flex-direction: column;
    gap: 0;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    z-index: 1; /* 确保不会超过顶部导航的 z-index: 10 */
    isolation: isolate; /* 创建新的堆叠上下文 */
  }

  /* 隐藏 PC 端侧边栏 */
  .settings-sidebar {
    display: none;
  }

  /* 移动端下拉选择器 */
  .mobile-section-selector {
    display: block;
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    background: var(--bg1);
    border-bottom: 1px solid var(--k-color-divider);
  }

  .selector-current {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    cursor: pointer;
    background: var(--bg2);
    transition: background 0.15s ease;
  }

  .selector-current:hover {
    background: var(--bg3);
  }

  .current-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg1);
  }

  .selector-arrow {
    font-size: 14px;
    color: var(--fg3);
    transition: transform 0.2s ease;
  }

  .selector-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg1);
    border: 1px solid var(--k-color-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 21;
  }

  .selector-option {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--fg2);
    cursor: pointer;
    border-bottom: 1px solid var(--k-color-divider);
    transition: all 0.15s ease;
  }

  .selector-option:last-child {
    border-bottom: none;
  }

  .selector-option:hover {
    background: var(--bg3);
    color: var(--fg1);
  }

  .selector-option.active {
    background: var(--k-color-primary-fade);
    color: var(--k-color-primary);
    font-weight: 500;
  }

  .mobile-section-backdrop {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 19;
  }

  /* 下拉动画 */
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }

  /* 主设置区域 */
  .settings-main {
    flex: 1;
    padding: 0.75rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .config-section {
    padding: 0;
  }

  .section-header {
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 1rem;
  }

  .section-desc {
    font-size: 0.75rem;
  }

  /* 表单布局 */
  .form-grid {
    gap: 1rem;
  }

  .form-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    width: 100%;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .form-control {
    width: 100%;
  }

  .form-hint {
    font-size: 0.7rem;
    margin-top: 0.25rem;
  }

  /* 开关：子组件无法被父级 scoped 样式命中，改由容器控制对齐 */
  .form-control > .gh-toggle,
  .form-control :deep(.gh-toggle) {
    align-self: flex-start;
  }

  /* 输入框样式 */
  .form-control :deep(.el-input__wrapper),
  .form-control :deep(.el-input-number) {
    width: 100%;
  }

  .form-control :deep(.el-input__inner) {
    font-size: 16px; /* 防止 iOS 缩放 */
  }

  .form-textarea {
    font-size: 16px;
  }

  /* 关键词列表 */
  .keyword-list {
    gap: 0.375rem;
  }

  .keyword-item {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  .add-keyword-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .add-keyword-row input {
    font-size: 16px;
    padding: 0.625rem 0.75rem;
  }

  .add-keyword-row button {
    width: 100%;
    justify-content: center;
  }

  /* 子区域分隔线 */
  .subsection-divider {
    margin: 1rem 0 0.5rem;
    font-size: 0.65rem;
  }

  /* 保存栏 */
  .save-bar {
    bottom: 12px;
    width: calc(100% - 24px);
    max-width: none;
    padding: 0.5rem 0.75rem;
  }

  .save-bar-text {
    font-size: 0.75rem;
  }

  .save-actions {
    gap: 0.5rem;
  }

  .save-bar-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  /* 模态框 */
  .modal-dialog {
    width: calc(100% - 32px);
    max-width: none;
    margin: 16px;
  }

  .modal-header {
    padding: 0.75rem 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-text {
    font-size: 0.8rem;
  }

  .modal-footer {
    padding: 0.75rem 1rem;
  }

  /* 缓存统计卡片 */
  .cache-stats {
    padding: 0.75rem;
  }

  .stat-row {
    padding: 0.375rem 0;
  }

  .stat-label,
  .stat-value {
    font-size: 0.75rem;
  }

  .cache-actions {
    gap: 0.5rem;
  }

  /* 信息框 */
  .info-box {
    padding: 0.75rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .view-header {
    padding: 0.5rem;
  }

  .view-title {
    font-size: 1rem;
  }

  .selector-current {
    padding: 0.75rem;
  }

  .current-label {
    font-size: 0.8125rem;
  }

  .selector-option {
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
  }

  .settings-main {
    padding: 0.5rem;
  }

  .section-title {
    font-size: 0.9rem;
  }

  .form-label {
    font-size: 0.75rem;
  }

  .form-hint {
    font-size: 0.65rem;
  }

  .keyword-item {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }
}
</style>
