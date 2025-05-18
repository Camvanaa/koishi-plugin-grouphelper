
import { Context } from 'koishi'
import { DataService } from '../services'
import { readData, saveData, formatDuration } from '../utils'
import { WarnRecord, BlacklistRecord, MuteRecord } from '../types'

export function registerConfigCommands(ctx: Context, dataService: DataService) {

  ctx.command('config', '配置管理', { authority: 3 })
    .option('t', '-t 显示所有记录')
    .option('b', '-b 黑名单管理')
    .option('w', '-w 警告管理')
    .option('a', '-a <内容> 添加')
    .option('r', '-r <内容> 移除')
    .action(async ({ session, options }, content) => {
      if (options.t) {
        const warns = readData(dataService.warnsPath)
        const blacklist = readData(dataService.blacklistPath)
        const groupConfigs = readData(dataService.groupConfigPath)


        for (const userId in warns) {
          if (warns[userId]?.groups?.[session.guildId]?.count <= 0) {
            delete warns[userId]
          }
        }
        saveData(dataService.warnsPath, warns)

        const formatWarns = Object.entries(warns)
          .filter(([, data]: [string, WarnRecord]) => data?.groups?.[session.guildId]?.count > 0)
          .map(([userId, data]: [string, WarnRecord]) => {
            const groupData = data?.groups?.[session.guildId]
            if (!groupData) return null
            return `用户 ${userId}：${groupData.count} 次 (${new Date(groupData.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
          })
          .filter(Boolean)
          .join('\n')

        const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) =>
          `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ).join('\n')

        const currentGroupKeywords = session.guildId ? (groupConfigs[session.guildId]?.keywords || []) : []
        const currentGroupApprovalKeywords = session.guildId ? (groupConfigs[session.guildId]?.approvalKeywords || []) : []
        const currentGroupAuto = session.guildId ? (groupConfigs[session.guildId]?.auto || 'false') : 'false'
        const currentGroupReject = session.guildId ? (groupConfigs[session.guildId]?.reject || '答案错误，请重新申请') : '答案错误，请重新申请'
        const currentGroupAutoDelete = session.guildId ? (groupConfigs[session.guildId]?.autoDelete || false) : false

        const currentWelcome = session.guildId ? (groupConfigs[session.guildId]?.welcomeMsg || '未设置') : '未设置'

        const mutes = readData(dataService.mutesPath)
        const currentMutes = mutes[session.guildId] || {}

        const formatMutes = Object.entries(currentMutes)
          .filter(([, data]) => !(data as MuteRecord).leftGroup && Date.now() - (data as MuteRecord).startTime < (data as MuteRecord).duration)
          .map(([userId, data]: [string, MuteRecord]) => {
            const remainingTime = data.duration - (Date.now() - data.startTime)
            return `用户 ${userId}：剩余 ${formatDuration(remainingTime)}`
          })
          .join('\n')

        const safeDefaultWelcome = ctx.config.defaultWelcome || '未设置'
        const safeWelcome = currentWelcome || '未设置'

        const banMeRecords = readData(dataService.banMeRecordsPath)
        const currentBanMe = banMeRecords[session.guildId] || {
          count: 0,
          lastResetTime: Date.now(),
          pity: 0,
          guaranteed: false
        }


        if (Date.now() - currentBanMe.lastResetTime > 3600000) {
          currentBanMe.count = 0
        }


        const baseMaxMillis = ctx.config.banme.baseMax * 60 * 1000
        const additionalMinutes = Math.floor(Math.pow(currentBanMe.count, 1/3) * ctx.config.banme.growthRate)
        const maxDuration = formatDuration(baseMaxMillis + (additionalMinutes * 60 * 1000))


        let currentProb = ctx.config.banme.jackpot.baseProb
        if (currentBanMe.pity >= ctx.config.banme.jackpot.softPity) {
          currentProb = ctx.config.banme.jackpot.baseProb +
            (currentBanMe.pity - ctx.config.banme.jackpot.softPity + 1) * 0.06
        }
        currentProb = Math.min(currentProb, 1)

        const banmeConfig = ctx.config.banme

        return `=== 入群欢迎 ===
默认欢迎语：${safeDefaultWelcome}
本群欢迎语：${safeWelcome}

=== 入群审核关键词 ===
全局关键词：${ctx.config.keywords.join('、') || '无'}
本群关键词：${currentGroupApprovalKeywords.join('、') || '无'}
自动拒绝：${currentGroupAuto === 'true' ? '已启用' : '未启用'}
拒绝词：${currentGroupReject}

=== 禁言关键词 ===
全局关键词：${ctx.config.keywordBan.keywords.join('、') || '无'}
本群关键词：${currentGroupKeywords.join('、') || '无'}
状态：${ctx.config.keywordBan.enabled ? '已启用' : '未启用'}
禁言时长：${ctx.config.keywordBan.duration}
自动撤回：${currentGroupAutoDelete ? '已启用' : '未启用'}

=== 自动禁言配置 ===
警告限制：${ctx.config.warnLimit} 次
禁言时长表达式：${ctx.config.banTimes.expression}
（{t}代表警告次数）

=== 复读管理 ===
全局状态：${ctx.config.antiRepeat.enabled ? '已启用' : '未启用'}
全局阈值：${ctx.config.antiRepeat.threshold} 条
本群状态：${dataService.getAntiRepeatConfig(session.guildId)?.enabled ? '已启用' : '未启用'}
本群阈值：${dataService.getAntiRepeatConfig(session.guildId)?.threshold || '未设置'} 条

=== 举报功能 ===
全局状态：${ctx.config.report.enabled ? '已启用' : '未启用'}
自动处理：${ctx.config.report.autoProcess ? '已启用' : '未启用'}
权限要求：${ctx.config.report.authority} 级
冷却时间：${ctx.config.report.maxReportCooldown || 60} 分钟
本群状态：${ctx.config.report.guildConfigs?.[session.guildId]?.enabled ? '已启用' : ctx.config.report.guildConfigs?.[session.guildId]?.enabled === false ? '已禁用' : '使用全局配置'}
本群上下文：${ctx.config.report.guildConfigs?.[session.guildId]?.includeContext ? '已启用' : '未启用'}
上下文数量：${ctx.config.report.guildConfigs?.[session.guildId]?.contextSize || 5} 条

=== AI功能 ===
全局状态：${ctx.config.openai?.enabled ? '已启用' : '未启用'}
对话功能：${ctx.config.openai?.chatEnabled ? '已启用' : '未启用'}
翻译功能：${ctx.config.openai?.translateEnabled ? '已启用' : '未启用'}
使用模型：${ctx.config.openai?.model || 'gpt-3.5-turbo'}
API地址：${ctx.config.openai?.apiUrl || 'https://api.openai.com/v1'}
本群状态：${groupConfigs[session.guildId]?.openai?.enabled === undefined ? '跟随全局' : groupConfigs[session.guildId]?.openai?.enabled ? '已启用' : '已禁用'}
本群对话：${groupConfigs[session.guildId]?.openai?.chatEnabled === undefined ? '跟随全局' : groupConfigs[session.guildId]?.openai?.chatEnabled ? '已启用' : '已禁用'}
本群翻译：${groupConfigs[session.guildId]?.openai?.translateEnabled === undefined ? '跟随全局' : groupConfigs[session.guildId]?.openai?.translateEnabled ? '已启用' : '已禁用'}

=== 精华消息 ===
状态：${ctx.config.setEssenceMsg.enabled ? '已启用' : '未启用'}
权限要求：${ctx.config.setEssenceMsg.authority} 级

=== 头衔管理 ===
状态：${ctx.config.setTitle.enabled ? '已启用' : '未启用'}
权限要求：${ctx.config.setTitle.authority} 级
最大长度：${ctx.config.setTitle.maxLength} 字节

=== 警告记录 ===
${formatWarns || '无记录'}

=== 黑名单 ===
${formatBlacklist || '无记录'}

=== Banme 统计 ===
状态：${ctx.config.banme.enabled ? '已启用' : '未启用'}
本群1小时内使用：${currentBanMe.count} 次
当前抽数：${currentBanMe.pity}
当前概率：${(currentProb * 100).toFixed(2)}%
状态：${currentBanMe.guaranteed ? '大保底' : '普通'}
当前最大禁言：${maxDuration}
自动禁言：${banmeConfig.autoBan ? '已启用' : '未启用'}

=== 当前禁言 ===
${formatMutes || '无记录'}`
      }


      if (options.b) {
        const blacklist = readData(dataService.blacklistPath)
        if (options.a) {
          blacklist[options.a] = { timestamp: Date.now() }
          saveData(dataService.blacklistPath, blacklist)
          await dataService.pushMessage(session.bot, `[黑名单] 用户 ${options.a} 已被添加到黑名单`, 'blacklist')
          return `已将 ${options.a} 加入黑名单喵~`
        }
        if (options.r) {
          delete blacklist[options.r]
          saveData(dataService.blacklistPath, blacklist)
          await dataService.pushMessage(session.bot, `[黑名单] 用户 ${options.r} 已从黑名单移除`, 'blacklist')
          return `已将 ${options.r} 从黑名单移除啦！`
        }

        const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) =>
          `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ).join('\n')
        return `=== 当前黑名单 ===\n${formatBlacklist || '无记录'}`
      }


      if (options.w) {
        const warns = readData(dataService.warnsPath)
        if (options.a) {
          if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

          warns[options.a] = warns[options.a] || { groups: {} }
          warns[options.a].groups[session.guildId] = warns[options.a].groups[session.guildId] || {
            count: 0,
            timestamp: 0
          }
          warns[options.a].groups[session.guildId].count += parseInt(content) || 1
          warns[options.a].groups[session.guildId].timestamp = Date.now()
          saveData(dataService.warnsPath, warns)
          return `已增加 ${options.a} 的警告次数，当前为：${warns[options.a].groups[session.guildId].count}`
        }
        if (options.r) {
          if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

          if (warns[options.r]?.groups[session.guildId]) {
            warns[options.r].groups[session.guildId].count -= parseInt(content) || 1
            if (warns[options.r].groups[session.guildId].count <= 0) {
              delete warns[options.r].groups[session.guildId]
              if (Object.keys(warns[options.r].groups).length === 0) {
                delete warns[options.r]
              }
              saveData(dataService.warnsPath, warns)
              return `已移除 ${options.r} 的警告记录`
            }
            warns[options.r].groups[session.guildId].timestamp = Date.now()
            saveData(dataService.warnsPath, warns)
            return `已减少 ${options.r} 的警告次数，当前为：${warns[options.r].groups[session.guildId].count}`
          }
          return '未找到该用户的警告记录'
        }

        if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

        const formatWarns = Object.entries(warns)
          .filter(([, data]: [string, WarnRecord]) => data?.groups?.[session.guildId]?.count > 0)
          .map(([userId, data]: [string, WarnRecord]) => {
            const groupData = data?.groups?.[session.guildId]
            if (!groupData) return null
            return `用户 ${userId}：${groupData.count} 次 (${new Date(groupData.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
          })
          .filter(Boolean)
          .join('\n')
        return `=== 当前群警告记录 ===\n${formatWarns || '无记录'}`
      }


      return `请使用以下参数：
-t 显示所有配置和记录
-b [-a/-r {QQ号}] 黑名单管理
-w [-a/-r {QQ号} {次数}] 警告管理
使用 groupkw 命令管理群关键词`
    })
}
