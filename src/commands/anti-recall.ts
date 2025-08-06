// 【重要改动】: 导入 Element
import { Context, Element } from 'koishi'
import { AntiRecallService } from '../services/anti-recall.service'
import { DataService } from '../services'
import { parseUserId } from '../utils'

export function registerAntiRecallCommands(ctx: Context, antiRecallService: AntiRecallService, dataService: DataService) {
  const sanitizeContentForDisplay = (content: string): string => {
    if (!content) return '[空消息]';

    try {
      const elements = Element.parse(content);
      return elements.map(el => {
        switch (el.type) {
          case 'text':
            return el.attrs.content;
          case 'face':
            return `[表情:${el.attrs.name || el.attrs.id}]`;
          case 'img':
            return '[图片]';
          case 'at':
            return `[@${el.attrs.name || el.attrs.id}]`;
          case 'video':
            return '[视频]';
          case 'audio':
            return '[语音]';
          case 'file':
            return '[文件]';
          default:
            return `[${el.type}]`;
        }
      }).join('').trim();
    } catch (e) {
      return content.replace(/<[^>]+>/g, '').trim() || '[消息内容解析失败]';
    }
  };

  ctx.command('antirecall <input:text>', '查询用户撤回消息记录', { authority: 3 })
    .alias('撤回查询')
    .usage('查询用户的撤回消息记录\n示例：\nrecall @用户\nrecall 123456789\nrecall @用户 5\nrecall 123456789 10 群号')
    .example('antirecall @用户')
    .action(async ({ session }, input) => {
      try {
        if (!input) {
          return '请指定要查询的用户\n用法：antirecall @用户 [数量] [群号]'
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
        if (targetUser.startsWith('<at')) {
          const match = targetUser.match(/id="([^"]+)"/)
          userId = match ? match[1] : null
        } else {
          userId = parseUserId(targetUser)
        }

        if (!userId) {
          return '无法解析用户ID，请@用户或使用QQ号，并确保格式正确'
        }

        if (!antiRecallService.isEnabledForGuild(targetGuildId)) {
          return `该群组（${targetGuildId}）未启用防撤回功能`
        }

        const records = antiRecallService.getUserRecallRecords(targetGuildId, userId, count)

        if (records.length === 0) {
          dataService.logCommand(session, 'antirecall', userId, `成功：查询到 ${targetGuildId} 无记录`)
          return `用户 ${userId} 在群 ${targetGuildId} 暂无撤回记录`
        }
        
        const config = antiRecallService.getGuildConfig(targetGuildId);
        let message = `用户 ${records[0].username} (${userId}) 的撤回记录 (${records.length} 条)\n\n`

        records.forEach((record, index) => {
          const recallTime = new Date(record.recallTime).toLocaleString('zh-CN')
          
          //转换为纯文本描述
          const sanitizedContent = sanitizeContentForDisplay(record.content);

          message += `${index + 1}. 内容: ${sanitizedContent}\n`
          
          if (config.showOriginalTime) {
            const originalTime = new Date(record.timestamp).toLocaleString('zh-CN')
            message += `   发送于: ${originalTime}\n`
          }
          message += `   撤回于: ${recallTime}\n\n`
        })
        dataService.logCommand(session, 'antirecall', userId, `成功：查询到 ${targetGuildId} 撤回记录数 ${records.length}`)
        return message.trim()

      } catch (error) {
        ctx.logger('anti-recall').warn('查询撤回记录失败:', error)
        dataService.logCommand(session, 'antirecall', input, `失败: ${error.message}`)
        return `查询撤回记录失败: ${error.message}`
      }
    })

  ctx.command('antirecall-config', '防撤回功能配置', { authority: 3 })
    .alias('防撤回配置')
    .option('e', '-e <enabled:string> 启用或禁用防撤回功能 (true/false)')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '此命令只能在群聊中使用'
      if (options.e === undefined) return '请输入 -e true 或 -e false 来启用或禁用'
      
      const enabledStr = options.e.toString().toLowerCase()
      if (['true', '1', 'yes', 'y', 'on'].includes(enabledStr)) {
        antiRecallService.setGuildEnabled(session.guildId, true)
        dataService.logCommand(session, 'antirecall-config', session.guildId, '成功：已启用防撤回功能')
        return '本群防撤回功能已启用喵~'
      } else if (['false', '0', 'no', 'n', 'off'].includes(enabledStr)) {
        antiRecallService.setGuildEnabled(session.guildId, false)
        dataService.logCommand(session, 'antirecall-config', session.guildId, '成功：已禁用防撤回功能')
        return '本群防撤回功能已禁用喵~'
      } else {
        dataService.logCommand(session, 'antirecall-config', session.guildId, '失败：设置无效')
        return '防撤回选项无效，请输入 true/false'
      }
    })

  ctx.command('antirecall.status', '查看防撤回功能状态', { authority: 3 })
    .action(async ({ session }) => {
      const status = antiRecallService.getStatus(session.guildId)
      const { globalEnabled, groupSpecificEnabled, effectiveConfig, statistics } = status

      const formatBool = (b: boolean) => b ? '已启用' : '已禁用'
      
      let groupStatusText: string
      if (groupSpecificEnabled === undefined) {
        groupStatusText = `未单独设置 (跟随全局)`
      } else {
        groupStatusText = `已单独设置为: ${formatBool(groupSpecificEnabled)}`
      }

      const message = [
        `防撤回功能状态`,
        `全局默认: ${formatBool(globalEnabled)}`,
        `本群设置: ${groupStatusText}`,
        `---`,
        `当前生效状态: ${formatBool(effectiveConfig.enabled)}`,
        `生效配置:`,
        `  - 保存天数: ${effectiveConfig.retentionDays || 'N/A'} 天`,
        `  - 每用户最大记录: ${effectiveConfig.maxRecordsPerUser || 'N/A'} 条`,
        `---`,
        `统计信息:`,
        `  - 总记录数: ${statistics.totalRecords}`,
        `  - 涉及用户数: ${statistics.totalUsers}`,
        `  - 涉及群组数: ${statistics.totalGuilds}`
      ].join('\n')

      dataService.logCommand(session, 'antirecall.status', session.guildId, `成功：查询防撤回状态`)
      return message
    })

  ctx.command('antirecall.clear', '清理所有撤回记录', { authority: 4 })
    .action(async ({ session }) => {
      antiRecallService.clearAllRecords()
      dataService.logCommand(session, 'antirecall.clear', '', '成功：清理所有撤回记录')
      return '已清理所有撤回记录'
    })
}