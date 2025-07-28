import { Context } from 'koishi'
import { AntiRecallService } from '../services/anti-recall.service'
import { DataService } from '../services'
import { parseUserId, readData, saveData } from '../utils'
import { GroupConfig } from '../types'

export function registerAntiRecallCommands(ctx: Context, antiRecallService: AntiRecallService, dataService: DataService) {

  // 查询撤回消息命令
  ctx.command('antirecall.recall <input:text>', '查询用户撤回消息记录', { authority: 3 })
    .alias('撤回查询')
    .usage('查询用户的撤回消息记录\n示例：\nrecall @用户\nrecall 123456789\nrecall @用户 5\nrecall 123456789 10 群号')
    .example('recall @用户')
    .example('recall 123456789')
    .example('recall @用户 5')
    .example('recall 123456789 10 群号')
    .action(async ({ session }, input) => {
      try {

        if (!input) {
          return '请指定要查询的用户\n用法：recall @用户 [数量] [群号]'
        }

        let args: string[]
        if (input.includes('<at')) {
          const atMatch = input.match(/<at[^>]+>/)
          if (atMatch) {
            const atPart = atMatch[0]
            const restPart = input.replace(atPart, '').trim()
            args = [atPart, ...restPart.split(/\s+/).filter(arg => arg)]
          } else {
            args = input.split(/\s+/).filter(arg => arg)
          }
        } else {
          args = input.split(/\s+/).filter(arg => arg)
        }

        let targetUser = args[0]
        let count = 10
        let targetGuildId = session.guildId

        if (args[1] && !isNaN(parseInt(args[1]))) {
          count = Math.min(parseInt(args[1]), 50)
        }

        if (args[2] && /^\d+$/.test(args[2])) {
          targetGuildId = args[2]
        } else if (args[1] && /^\d+$/.test(args[1]) && args[1].length > 5) {
          if (!args[2]) {
            targetGuildId = args[1]
            count = 10
          }
        }

        if (!targetGuildId) {
          return '请在群聊中使用此命令，或指定群号'
        }

        let userId: string
        try {
          if (targetUser.startsWith('<at')) {
            const match = targetUser.match(/id="(\d+)"/)
            if (match) {
              userId = match[1]
            } else {
              return '无法解析@用户，请重试'
            }
          } else {
            userId = parseUserId(targetUser)
          }
        } catch (e) {
          try {
            userId = parseUserId(targetUser)
          } catch (e2) {
            return '用户格式错误，请使用 @用户 或 QQ号'
          }
        }

        if (!userId) {
          return '无法获取用户ID，请检查输入格式'
        }

        if (!antiRecallService.isEnabledForGuild(targetGuildId)) {
          return '该群组未启用防撤回功能'
        }

        const records = antiRecallService.getUserRecallRecords(targetGuildId, userId, count)

        if (records.length === 0) {
          return `用户 ${userId} 在群 ${targetGuildId} 暂无撤回记录`
        }

        let message = `用户 ${userId} 的撤回记录 (${records.length} 条)\n\n`

        records.forEach((record, index) => {
          const originalTime = new Date(record.timestamp).toLocaleString('zh-CN')
          const recallTime = new Date(record.recallTime).toLocaleString('zh-CN')
          
          message += `${index + 1}. ${record.username || 'Unknown'}\n`
          if (ctx.config.antiRecall.showOriginalTime) {
            message += `   发送时间: ${originalTime}\n`
          }
          message += `   撤回时间: ${recallTime}\n`
          message += `   内容: ${record.content}\n\n`
        })

        return message.trim()

      } catch (error) {
        console.error('查询撤回记录失败:', error)
        return `查询撤回记录失败: ${error.message}`
      }
    })

  ctx.command('antirecall', '防撤回功能配置', { authority: 3 })
    .alias('防撤回配置')
    .subcommand('.enable', '启用防撤回功能')
    .action(async ({ session }) => {
      /*if (!session.guildId) {
        return '此命令只能在群聊中使用'
      }*/

      const groupConfigs = readData(dataService.groupConfigPath)
      if (!groupConfigs[session.guildId]) {
        groupConfigs[session.guildId] = {
          keywords: [],
          approvalKeywords: []
        }
      }

      if (!groupConfigs[session.guildId].antiRecall) {
        groupConfigs[session.guildId].antiRecall = { enabled: true }
      } else {
        groupConfigs[session.guildId].antiRecall.enabled = true
      }

      saveData(dataService.groupConfigPath, groupConfigs)
      return '已启用本群防撤回功能'
    })

  ctx.command('antirecall.disable', '禁用防撤回功能', { authority: 3 })
    .action(async ({ session }) => {
      /*if (!session.guildId) {
        return '此命令只能在群聊中使用'
      }*/

      const groupConfigs = readData(dataService.groupConfigPath)
      if (!groupConfigs[session.guildId]) {
        groupConfigs[session.guildId] = {
          keywords: [],
          approvalKeywords: []
        }
      }

      if (!groupConfigs[session.guildId].antiRecall) {
        groupConfigs[session.guildId].antiRecall = { enabled: false }
      } else {
        groupConfigs[session.guildId].antiRecall.enabled = false
      }

      saveData(dataService.groupConfigPath, groupConfigs)
      return '已禁用本群防撤回功能'
    })

  ctx.command('antirecall.status', '查看防撤回功能状态', { authority: 3 })
    .action(async ({ session }) => {
      /*if (!session.guildId) {
        return '此命令只能在群聊中使用'
      }*/

      const globalEnabled = ctx.config.antiRecall?.enabled || false
      const groupConfigs = readData(dataService.groupConfigPath)
      const groupConfig: GroupConfig = groupConfigs[session.guildId]

      let groupEnabled: boolean
      let actualEnabled: boolean

      if (groupConfig?.antiRecall !== undefined) {
        groupEnabled = groupConfig.antiRecall.enabled
        actualEnabled = groupConfig.antiRecall.enabled
      } else {
        groupEnabled = globalEnabled
        actualEnabled = globalEnabled
      }

      const stats = antiRecallService.getStatistics()

      let message = `防撤回功能状态\n\n`
      message += `全局状态: ${globalEnabled ? '已启用' : '已禁用'}\n`
      message += `本群状态: ${groupEnabled ? '已启用' : '已禁用'}`
      message += `\n实际状态: ${actualEnabled ? '生效中' : '未生效'}\n\n`
      message += `统计信息:\n`
      message += `总记录数: ${stats.totalRecords}\n`
      message += `涉及用户: ${stats.totalUsers}\n`
      message += `涉及群组: ${stats.totalGuilds}\n\n`
      message += `配置信息:\n`
      message += `保存天数: ${ctx.config.antiRecall?.retentionDays || 7} 天\n`
      message += `每用户最大记录: ${ctx.config.antiRecall?.maxRecordsPerUser || 50} 条\n`

      return message
    })

  ctx.command('antirecall.clear', '清理所有撤回记录', { authority: 3 })
    .action(async () => {
      antiRecallService.clearAllRecords()
      return '已清理所有撤回记录'
    })
}
