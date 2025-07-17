
import { Context } from 'koishi'
import { DataService } from '../services'
import { parseTimeString, formatDuration, readData, saveData } from '../utils'

export function registerWarnCommands(ctx: Context, dataService: DataService) {

  ctx.command('warn <user:user> [count:number]', '警告用户', { authority: 3 })
    .action(async ({ session }, user, count = 1) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!user) return '请指定要警告的用户喵！'

      const userId = String(user).split(':')[1]
      const warns = readData(dataService.warnsPath)
      warns[session.guildId] = warns[session.guildId] || {}
      warns[session.guildId][userId] = Number(warns[session.guildId][userId] || 0) + Number(count)

      const warnCount = warns[session.guildId][userId]
      saveData(dataService.warnsPath, warns)


      if (warnCount >= ctx.config.warnLimit) {
        const expression = ctx.config.banTimes.expression.replace(/{t}/g, String(warnCount))
        try {
          const milliseconds = parseTimeString(expression)
          await session.bot.muteGuildMember(session.guildId, userId, milliseconds)
          dataService.recordMute(session.guildId, userId, milliseconds)
          await dataService.pushMessage(session.bot, `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${count} 次，累计 ${warnCount} 次，触发自动禁言 ${formatDuration(milliseconds)}`, 'warning')
          dataService.logCommand(session, 'warn', userId, `成功：已警告 ${count} 次，累计 ${warnCount} 次，触发自动禁言 ${formatDuration(milliseconds)}`)
          return `已警告用户 ${userId}\n本群警告：${warnCount} 次\n已自动禁言 ${formatDuration(milliseconds)}`
        } catch (e) {
          await dataService.pushMessage(session.bot, `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${count} 次，累计 ${warnCount} 次，但自动禁言失败：${e.message}`, 'warning')
          dataService.logCommand(session, 'warn', userId, `失败：已警告 ${count} 次，累计 ${warnCount} 次，但自动禁言失败`)
          return `警告已记录，但自动禁言失败：${e.message}`
        }
      } else {
        await dataService.pushMessage(session.bot, `[警告] 用户 ${userId} 在群 ${session.guildId} 被警告 ${count} 次，累计 ${warnCount} 次，未触发自动禁言`, 'warning')
        dataService.logCommand(session, 'warn', userId, `已警告 ${count} 次，累计 ${warnCount} 次`)
        return `已警告用户 ${userId}\n本群警告：${warnCount} 次`
      }
    })
}
