import { Context, Schema } from 'koishi'
import { DataService } from '../services'
import { readData, parseTimeString, formatDuration } from '../utils'
import { saveData } from '../utils'

export function registerKeywordCommands(ctx: Context, dataService: DataService) {
  ctx.command('verify', '入群验证关键词管理', { authority: 3 })
    .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
    .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
    .option('clear', '--clear 清除所有关键词')
    .option('l', '-l 列出关键词')
    .option('n', '-n <true/false> 设置未匹配关键词时是否自动拒绝')
    .option('w', '-w <拒绝词> 设置拒绝时的回复')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      // 初始化
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
      groupConfigs[session.guildId].approvalKeywords = groupConfigs[session.guildId].approvalKeywords || []
      if (groupConfigs[session.guildId].auto === undefined) {
        groupConfigs[session.guildId].auto = 'false'
      }
      if (groupConfigs[session.guildId].reject === undefined) {
        groupConfigs[session.guildId].reject = '答案错误，请重新申请'
      }

      if (options.l) {
        const keywords = groupConfigs[session.guildId].approvalKeywords
        return `当前群入群审核关键词：\n${keywords.join('、') || '无'}\n自动拒绝状态：${groupConfigs[session.guildId].auto}\n拒绝词：${groupConfigs[session.guildId].reject}`
      }

      if (options.a) {
        const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
        groupConfigs[session.guildId].approvalKeywords.push(...newKeywords)
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'verify', 'add', `已添加关键词：${newKeywords.join('、')}`)
        return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
      }

      if (options.r) {
        const removeKeywords = options.r.split(',').map(k => k.trim()).filter(k => k)
        const removed = []
        for (const keyword of removeKeywords) {
          const index = groupConfigs[session.guildId].approvalKeywords.indexOf(keyword)
          if (index > -1) {
            groupConfigs[session.guildId].approvalKeywords.splice(index, 1)
            removed.push(keyword)
          }
        }
        if (removed.length > 0) {
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'verify', 'remove', `已移除关键词：${removed.join('、')}`)
          return `已经把关键词：${removed.join('、')} 删掉啦喵！`
        }
        return '未找到指定的关键词'
      }

      if (options.clear) {
        if (!groupConfigs[session.guildId].approvalKeywords.length) {
          return '当前没有任何入群审核关键词喵~'
        }
        groupConfigs[session.guildId].approvalKeywords = []
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'verify', 'clear', `已清除所有关键词`)
        return '所有入群审核关键词已清除喵~'
      }

      if (options.n !== undefined) {
        const value = String(options.n).toLowerCase()
        if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
          groupConfigs[session.guildId].auto = 'true'
        } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
          groupConfigs[session.guildId].auto = 'false'
        } else {
          return '无效的值，请使用 true/false、1/0、yes/no、y/n 或 on/off'
        }
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'verify', 'auto', `已设置自动拒绝：${groupConfigs[session.guildId].auto}`)
        return `自动拒绝状态更新为${groupConfigs[session.guildId].auto}`
      }

      if (options.w) {
        groupConfigs[session.guildId].reject = options.w
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'verify', 'set', `已设置拒绝词：${options.w}`)
        return `拒绝词已更新为：${options.w} 喵喵喵~`
      }

      return '请使用：\n-a 添加关键词\n-r 移除关键词\n--clear 清空关键词\n-l 列出关键词\n-n <true/false> 未匹配关键词自动拒绝\n-w <拒绝词> 设置拒绝时的回复\n多个关键词用英文逗号分隔'
    })

  ctx.command('forbidden', '禁言关键词管理', { authority: 3 })
    .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
    .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
    .option('clear', '--clear 清除所有关键词')
    .option('l', '-l 列出关键词')
    .option('d', '-d <value:string> 设置是否自动撤回包含关键词的消息')
    .option('b', '-b <value:string> 设置是否自动禁言')
    .option('k', '-k <value:string> 设置是否自动踢出')
    .option('t', '-t <时长> 设置自动禁言时长')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
      const groupConfig = groupConfigs[session.guildId]

      const forbiddenConfig = { ...ctx.config.forbidden, ...(groupConfig.forbidden || {}) }

      if (options.l) {
        const keywords = groupConfig.keywords || []
        return `全局禁言关键词：\n${ctx.config.forbidden.keywords.join('、') || '无'}
当前群禁言关键词：\n${keywords.join('、') || '无'}
自动撤回状态：${forbiddenConfig.autoDelete ? '开启' : '关闭'}
自动禁言状态：${forbiddenConfig.autoBan ? '开启' : '关闭'}
自动踢出状态：${forbiddenConfig.autoKick ? '开启' : '关闭'}
自动禁言时长：${formatDuration(forbiddenConfig.muteDuration)}`
      }

      if (options.a) {
        const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
        groupConfig.keywords = groupConfig.keywords || []
        groupConfig.keywords.push(...newKeywords)
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'forbidden', 'add', `成功：已添加关键词：${newKeywords.join('、')}`)
        return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
      }

      if (options.r) {
        const removeKeywords = options.r.split(',').map(k => k.trim()).filter(k => k)
        const removed = []
        if (!groupConfig.keywords) return '当前没有任何禁言关键词喵~'

        for (const keyword of removeKeywords) {
          const index = groupConfig.keywords.indexOf(keyword)
          if (index > -1) {
            groupConfig.keywords.splice(index, 1)
            removed.push(keyword)
          }
        }
        if (removed.length > 0) {
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'forbidden', 'remove', `成功：已移除关键词：${removed.join('、')}`)
          return `已经把关键词：${removed.join('、')} 删掉啦喵！`
        }
        return '未找到指定的关键词'
      }

      if(options.clear) {
        if (!groupConfig.keywords || !groupConfig.keywords.length) {
          return '当前没有任何禁言关键词喵~'
        }
        groupConfig.keywords = []
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'forbidden', 'clear', `成功：已清除所有关键词`)
        return '所有禁言关键词已清除喵~' 
      }

      const ensureForbiddenExists = () => {
        groupConfig.forbidden = groupConfig.forbidden || {}
      }

      if (options.d !== undefined) {
        const value = options.d.toString().toLowerCase()
        let state: boolean
        if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
          state = true
        } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
          state = false
        } else {
          return '无效的值，请使用 true/false'
        }
        ensureForbiddenExists()
        groupConfig.forbidden.autoDelete = state
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'forbidden', 'recall', `成功：已设置自动撤回：${state}`)
        return `自动撤回状态更新为${state}`
      }

      if (options.b !== undefined) {
        const value = options.b.toString().toLowerCase()
        let state: boolean
        if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
          state = true
        } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
          state = false
        } else {
          return '无效的值，请使用 true/false'
        }
        ensureForbiddenExists()
        groupConfig.forbidden.autoBan = state
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'forbidden', 'ban', `成功：已设置自动禁言：${state}`)
        return `自动禁言状态更新为${state}`
      }

      if (options.k !== undefined) {
        const value = options.k.toString().toLowerCase()
        let state: boolean
        if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
          state = true
        } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
          state = false
        } else {
          return '无效的值，请使用 true/false'
        }
        ensureForbiddenExists()
        groupConfig.forbidden.autoKick = state
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'forbidden', 'kick', `成功：已设置自动踢出：${state}`)
        return `自动踢出状态更新为${state}`
      }

      if (options.t) {
        const duration = options.t
        try {
          const milliseconds = parseTimeString(duration)
          ensureForbiddenExists()
          groupConfig.forbidden.muteDuration = milliseconds
          saveData(dataService.groupConfigPath, groupConfigs)
          dataService.logCommand(session, 'forbidden', 'set', `成功：已设置禁言时间：${duration}`)
          return `禁言时间已更新为：${duration} 喵喵喵~`
        } catch (e) {
          return `无效的时间格式：${duration}，请使用类似 "1h" 或 "30m" 的格式`
        }
      }

      return '请使用：\n-a 添加关键词\n-r 移除关键词\n--clear 清空关键词\n-l 列出关键词\n-d <true/false> 设置是否自动撤回包含关键词的消息\n-b <true/false> 设置是否启用关键词禁言\n-k <true/false> 设置是否启用关键词踢出\n-t <时长> 设置自动禁言时长\n多个关键词用英文逗号分隔'
    })
}

export function registerKeywordMiddleware(ctx: Context, dataService: DataService) {
  ctx.middleware(async (session, next) => {
    if (!session.content || !session.guildId) return next()

    let content = session.content
    content = content.replace(/<at id="\d+"\/>/g, '')  // 移除 at 标签
    content = content.replace(/<img[^>]+>/g, '')       // 移除图片标签
    content = content.trim()

    if (!content) return next()

    const groupConfigs = readData(dataService.groupConfigPath)
    const groupConfig = groupConfigs[session.guildId] || {}
    
    // 合并全局和群组配置
    const forbiddenConfig = { ...ctx.config.forbidden, ...(groupConfig.forbidden || {}) }
    const groupKeywords = groupConfig.keywords || []
    // 最终生效的关键词列表
    const effectiveKeywords = [...ctx.config.forbidden.keywords, ...groupKeywords]

    if (effectiveKeywords.length === 0) return next()

    if (forbiddenConfig.autoBan) {
      for (const keyword of effectiveKeywords) {
        try {
          const regex = new RegExp(keyword, 'i')
          if (regex.test(content)) {
            if (forbiddenConfig.autoKick) {
              try {
                await session.bot.kickGuildMember(session.guildId, session.userId)
                dataService.logCommand(session, 'keyword-kick', session.userId, `成功：关键词匹配，已踢出群聊`)
                await session.send(`喵呜！发现了关键词，${session.username} 已被踢出群聊...`)
                return
              } catch (e) {
                dataService.logCommand(session, 'keyword-kick', session.userId, `失败`)
                await session.send('自动踢出失败了...可能是权限不够喵')
              }
            }

            let duration = forbiddenConfig.muteDuration
            try {
              const mutes = readData(dataService.mutesPath)
              const lastMute = mutes[session.guildId]?.[session.userId]
              let covered = false
              
              if(lastMute && (lastMute.startTime + lastMute.duration) > (Date.now() + duration)) {
                duration = lastMute.startTime + lastMute.duration - Date.now()
                covered = true
              }

              await session.bot.muteGuildMember(session.guildId, session.userId, duration)
              dataService.recordMute(session.guildId, session.userId, duration)

              if(covered){
                dataService.logCommand(session, 'keyword-ban', session.userId, `成功：关键词匹配，已有更长禁言，禁言时长 ${formatDuration(duration)}`)
                await session.send(`喵呜！发现了关键词，检测到未完成的禁言，要被禁言 ${formatDuration(duration)} 啦...`)
              } else {
                dataService.logCommand(session, 'keyword-ban', session.userId, `成功：关键词匹配，禁言时长 ${formatDuration(duration)}`)
                await session.send(`喵呜！发现了关键词，要被禁言 ${formatDuration(duration)} 啦...`)
              }
            } catch (e) {
              dataService.logCommand(session, 'keyword-ban', session.userId, `失败`)
              await session.send('自动禁言失败了...可能是权限不够喵')
            }
            break 
          }
        } catch (e) {
          if (content.includes(keyword)) {
            const duration = forbiddenConfig.muteDuration
            try {
              await session.bot.muteGuildMember(session.guildId, session.userId, duration)
              dataService.recordMute(session.guildId, session.userId, duration)
              dataService.logCommand(session, 'keyword-ban', session.userId, `成功：关键词匹配，禁言时长 ${formatDuration(duration)}`)
              await session.send(`喵呜！发现了关键词，要被禁言 ${formatDuration(duration)} 啦...`)
            } catch (e) {
              dataService.logCommand(session, 'keyword-ban', session.userId, `失败`)
              await session.send('自动禁言失败了...可能是权限不够喵')
            }
            break
          }
        }
      }
    }

    if (forbiddenConfig.autoDelete) {
      for (const keyword of effectiveKeywords) {
        try {
          const regex = new RegExp(keyword, 'i')
          if (regex.test(content)) {
            try {
              await session.bot.deleteMessage(session.guildId, session.messageId)
              dataService.logCommand(session, 'keyword-delete', session.userId, `成功：关键词匹配，消息已撤回`)
              await session.send(`喵呜！发现了关键词，消息已被撤回...`)
            } catch (e) {
              dataService.logCommand(session, 'keyword-delete', session.userId, `失败`)
              await session.send('自动撤回失败了...可能是权限不够喵')
            }
            break
          }
        } catch (e) {
          if (content.includes(keyword)) {
            try {
              await session.bot.deleteMessage(session.guildId, session.messageId)
              dataService.logCommand(session, 'keyword-delete', session.userId, `成功：关键词匹配，消息已撤回`)
              await session.send(`喵呜！发现了关键词，消息已被撤回...`)
            } catch (e) {
              dataService.logCommand(session, 'keyword-delete', session.userId, `失败`)
              await session.send('自动撤回失败了...可能是权限不够喵')
            }
            break
          }
        }
      }
    }

    return next()
  })
}
