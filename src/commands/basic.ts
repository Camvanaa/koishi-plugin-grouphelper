
import { Context } from 'koishi'
import { DataService } from '../services'
import { parseUserId, parseTimeString, formatDuration, readData, saveData } from '../utils'
import { WarnRecord, BlacklistRecord, MuteRecord } from '../types'
import { AntiRepeatConfig } from '../types'

export function registerBasicCommands(ctx: Context, dataService: DataService) {

  ctx.command('kick <input:text>', '踢出用户', { authority: 3 })
    .example('kick @用户')
    .example('kick 123456789')
    .example('kick @用户 群号')
    .example('kick @用户 -b')
    .example('kick 123456789 -b 群号')
    .option('black', '-b 加入黑名单')
    .action(async ({ session, options }, input) => {

      const hasBlackOption = input.includes('-b')

      input = input.replace(/-b/g, '').replace(/\s+/g, ' ').trim()

      console.log('Normalized input:', input, 'Black option:', hasBlackOption)

      let args: string[]
      if (input.includes('<at')) {

        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(' ')]
        } else {
          args = input.split(' ')
        }
      } else {

        args = input.split(' ')
      }

      const [target, groupId] = args
      console.log('Split params:', { target, groupId, hasBlackOption })


      let userId: string
      try {

        if (target?.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {

          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }

      if (!userId) {
        dataService.logCommand(session, 'kick', 'none', '失败：无法读取目标用户')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }

      const targetGroup = groupId || session.guildId

      try {
        await session.bot.kickGuildMember(targetGroup, userId, hasBlackOption)

        if (hasBlackOption) {
          const blacklist = readData(dataService.blacklistPath)
          blacklist[userId] = { timestamp: Date.now() }
          saveData(dataService.blacklistPath, blacklist)
          dataService.logCommand(session, 'kick', userId, `成功：移出群聊并加入黑名单：${targetGroup}`)
          return `已把坏人 ${userId} 踢出去并加入黑名单啦喵！`
        }

        dataService.logCommand(session, 'kick', userId, `成功：移出群聊 ${targetGroup}`)
        return `已把 ${userId} 踢出去喵~`
      } catch (e) {
        dataService.logCommand(session, 'kick', userId, `失败：未知错误`)
        return `喵呜...踢出失败了：${e.message}`
      }
    })


  ctx.command('ban <input:text>', '禁言用户', { authority: 3 })
    .example('ban @用户 1h')
    .example('ban 123456789 1h')
    .example('ban @用户 1h 群号')
    .action(async ({ session }, input) => {

      let args: string[]
      if (input.includes('<at')) {

        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(/\s+/)]
        } else {
          args = input.split(/\s+/)
        }
      } else {

        args = input.split(/\s+/)
      }

      if (!args || args.length < 2) {
        dataService.logCommand(session, 'ban', 'none', 'Failed: Insufficient parameters')
        return '喵呜...格式：ban <用户> <时长> [群号]'
      }

      const [target, duration, groupId] = args
      console.log('Split params:', { target, duration, groupId })


      let userId: string
      try {

        if (target.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {

          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }

      if (!userId) {
        dataService.logCommand(session, 'ban', 'none', '失败：无法读取目标用户')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }

      if (!duration) {
        dataService.logCommand(session, 'ban', userId, '失败：未指定禁言时长')
        return '喵呜...请告诉我要禁言多久呀~'
      }

      const targetGroup = groupId || session.guildId

      try {
        const milliseconds = parseTimeString(duration)
        await session.bot.muteGuildMember(targetGroup, userId, milliseconds)
        dataService.recordMute(targetGroup, userId, milliseconds)

        const timeStr = formatDuration(milliseconds)
        dataService.logCommand(session, 'ban', userId, `成功：已禁言 ${timeStr}，群号：${targetGroup}`)
        return `已经把 ${userId} 禁言 ${duration} (${timeStr}) 啦喵~`
      } catch (e) {
        dataService.logCommand(session, 'ban', userId, `失败：未知错误`)
        return `喵呜...禁言失败了：${e.message}`
      }
    })
  
  // stop 固定禁言时长10分钟，除非已在禁言中
  ctx.command('stop <user:user>', '短期禁言', {authority: 2})
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      // 从 mutes 中读取剩余禁言时长
      const mutes = readData(dataService.mutesPath)
      const lastMute = mutes[session.guildId][userId] || {
        startTime: 0,
        duration: 0
      }
      if (lastMute.startTime + lastMute.duration > Date.now()) {
        dataService.logCommand(session, 'stop', userId, '失败：已在禁言中')
        return `喵呜...${userId} 已经处于禁言状态啦，不需要短期禁言喵~`
      }
      try {
        await session.bot.muteGuildMember(session.guildId, userId, 600000)
        dataService.recordMute(session.guildId, userId, 600000)
        dataService.logCommand(session, 'stop', userId, `成功：已短期禁言，群号 ${session.guildId}`)
        return `已将 ${userId} 短期禁言啦喵~`
      } catch (e) {
        dataService.logCommand(session, 'stop', userId, '失败：未知错误')
        return `喵呜...短期禁言失败了：${e.message}`
      }
    })
    

  ctx.command('unban <input:text>', '解除用户禁言', { authority: 3 })
    .example('unban @用户')
    .example('unban 123456789')
    .example('unban @用户 群号')
    .action(async ({ session }, input) => {

      let args: string[]
      if (input.includes('<at')) {

        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(/\s+/)]
        } else {
          args = input.split(/\s+/)
        }
      } else {

        args = input.split(/\s+/)
      }

      const [target, groupId] = args
      console.log('Split params:', { target, groupId })


      let userId: string
      try {

        if (target.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {

          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }

      if (!userId) {
        dataService.logCommand(session, 'unban', 'none', '失败：无法读取目标用户')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }

      const targetGroup = groupId || session.guildId

      try {
        await session.bot.muteGuildMember(targetGroup, userId, 0)
        dataService.recordMute(targetGroup, userId, 0)
        dataService.logCommand(session, 'unban', userId, `成功：已解除禁言，群号 ${targetGroup}`)
        return `已经把 ${userId} 的禁言解除啦喵！开心~`
      } catch (e) {
        dataService.logCommand(session, 'unban', userId, `失败：未知错误`)
        return `喵呜...解除禁言失败了：${e.message}`
      }
    })


  ctx.command('ban-all', '全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, true)
        dataService.logCommand(session, 'ban-all', session.guildId, `成功：已开启全体禁言，群号 ${session.guildId}`)
        return '喵呜...全体禁言开启啦，大家都要乖乖的~'
      } catch (e) {
        dataService.logCommand(session, 'ban-all', session.guildId, `失败：未知错误`)
        return `出错啦喵...${e}`
      }
    })


  ctx.command('unban-all', '解除全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, false)
        dataService.logCommand(session, 'unban-all', session.guildId, `成功：已解除全体禁言，群号 ${session.guildId}`)
        return '全体禁言解除啦喵，可以开心聊天啦~'
      } catch (e) {
        dataService.logCommand(session, 'unban-all', session.guildId, `失败：未知错误`)
        return `出错啦喵...${e}`
      }
    })


  ctx.command('delmsg', '撤回消息', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.quote) return '喵喵！请回复要撤回的消息呀~'

      try {
        await session.bot.deleteMessage(session.channelId, session.quote.id)
        return ''
      } catch (e) {
        return '呜呜...撤回失败了，可能太久了或者没有权限喵...'
      }
    })


  ctx.command('admin <user:user>', '设置管理员', { authority: 4 })
    .example('admin @用户')
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'

      const userId = String(user).split(':')[1]
      try {
        await session.bot.internal?.setGroupAdmin(session.guildId, userId, true);
        dataService.logCommand(session, 'admin', userId, '成功：已设置为管理员')
        await dataService.pushMessage(session.bot, `[管理员] 用户 ${userId} 已被设置为管理员`, 'log')
        return `已将 ${userId} 设置为管理员喵~`
      } catch (e) {
        dataService.logCommand(session, 'admin', userId, `失败：未知错误`)
        return `设置失败了喵...${e.message}`
      }
    })


  ctx.command('unadmin <user:user>', '取消管理员', { authority: 4 })
    .example('unadmin @用户')
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'

      const userId = String(user).split(':')[1]
      try {
        await session.bot.internal?.setGroupAdmin(session.guildId, userId, false);
        dataService.logCommand(session, 'unadmin', userId, '成功：已取消管理员')
        await dataService.pushMessage(session.bot, `[管理员] 用户 ${userId} 已被取消管理员`, 'log')
        return `已取消 ${userId} 的管理员权限喵~`
      } catch (e) {
        dataService.logCommand(session, 'unadmin', userId, `失败：未知错误`)
        return `取消失败了喵...${e.message}`
      }
    })

  // 查询当前禁言名单
  ctx.command('ban-list', '查询当前禁言名单', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'
      const mutes = readData(dataService.mutesPath)
      const currentMutes = mutes[session.guildId] || {}

      const formatMutes = Object.entries(currentMutes)
        .filter(([, data]) => !(data as MuteRecord).leftGroup && Date.now() - (data as MuteRecord).startTime < (data as MuteRecord).duration)
        .map(([userId, data]: [string, MuteRecord]) => {
          const remainingTime = data.duration - (Date.now() - data.startTime)
          return `用户 ${userId}：剩余 ${formatDuration(remainingTime)}`
        })
        .join('\n')

      if (formatMutes) {
        return `当前禁言名单：\n${formatMutes}`
      }
      else {
        return '当前没有被禁言的成员喵~'
      }
    })

  // 随机解除若干人禁言
  ctx.command('unban-random <count:number>', '随机解除若干人禁言', { authority: 3 })
    .action(async ({ session }, count) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'
      // count 默认为1
      count = count || 1
      const mutes = readData(dataService.mutesPath)
      const currentMutes = mutes[session.guildId] || {}
      var banList = []

      // 遍历，取 starttime+duration 大于当前时间的用户
      for (const userId in currentMutes) {
        const muteEndTime = currentMutes[userId].startTime + currentMutes[userId].duration
        if (muteEndTime > Date.now()) {
          banList.push(userId)
        }
      }

      // 选取列表中 count 个随机用户
      if (banList.length === 0) {
        dataService.logCommand(session, 'unban-random', session.guildId, '失败：当前没有被禁言的成员')
        return '当前没有被禁言的成员喵~'
      }

      // 选取列表中 count 个随机用户
      const unbanList = getRandomElements(banList, count)

      // 随机选取 count 个元素的辅助函数
      function getRandomElements(arr: string[], n: number): string[] {
        const result = []
        const arrCopy = [...arr]
        n = Math.min(n, arrCopy.length)
        for (let i = 0; i < n; i++) {
          const idx = Math.floor(Math.random() * arrCopy.length)
          result.push(arrCopy[idx])
          arrCopy.splice(idx, 1)
        }
        return result
      }


      for (const userId of unbanList) {
        await session.bot.muteGuildMember(session.guildId, userId, 0)
        currentMutes[userId].startTime = Date.now()
        currentMutes[userId].duration = 0
      }

      mutes[session.guildId] = currentMutes
      saveData(dataService.mutesPath, mutes)  
      dataService.logCommand(session, 'unban-random', session.guildId, `成功：已随机解除 ${unbanList.length} 人的禁言，解除名单：${unbanList.join(', ')}`)
      return `已随机解除 ${unbanList.length} 人的禁言喵~\n解除名单：\n${unbanList.join(', ')}`
    })

  ctx.command('unban-allppl', '解除所有人禁言', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'

      try {

        const mutes = readData(dataService.mutesPath)
        const currentMutes = mutes[session.guildId] || {}
        const now = Date.now()


        let count = 0
        for (const userId in currentMutes) {
          if (!currentMutes[userId].leftGroup) {
            try {

              const muteEndTime = currentMutes[userId].startTime + currentMutes[userId].duration
              if (now >= muteEndTime) {

                delete currentMutes[userId]
                continue
              }


              const memberInfo = await session.bot.internal.getGroupMemberInfo(session.guildId, userId, false)
              if (memberInfo.shut_up_timestamp > 0) {
                await session.bot.muteGuildMember(session.guildId, userId, 0)
                delete currentMutes[userId]
                count++
              } else {

                delete currentMutes[userId]
              }
            } catch (e) {

              console.error(`解除用户 ${userId} 禁言失败:`, e)
            }
          }
        }


        mutes[session.guildId] = currentMutes
        saveData(dataService.mutesPath, mutes)
        dataService.logCommand(session, 'unban-allppl', session.guildId, `成功：已解除 ${count} 人的禁言`)
        return count > 0 ? `已解除 ${count} 人的禁言啦！` : '当前没有被禁言的成员喵~'
      } catch (e) {
        return `出错啦喵...${e}`
      }
    })

    ctx.command('title', '群头衔管理', { authority: ctx.config.setTitle.authority })
    .option('s', '-s <text> 设置头衔')
    .option('r', '-r 移除头衔')
    .option('u', '-u <user:user> 指定用户')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!ctx.config.setTitle.enabled) return '喵呜...头衔功能未启用...'

      let targetId = session.userId
      if (options.u) {
        targetId = String(options.u).split(':')[1]
      }

      try {
        if (options.s) {
          const title = options.s.toString()
          if (new TextEncoder().encode(title).length > ctx.config.setTitle.maxLength) {
            return `喵呜...头衔太长啦！最多只能有 ${ctx.config.setTitle.maxLength} 个字节哦~`
          }
          await session.bot.internal.setGroupSpecialTitle(session.guildId, targetId, title)
          dataService.logCommand(session, 'title', targetId, `成功：已设置头衔：${title}`)
          return `已经设置好头衔啦喵~`
        } else if (options.r) {
          await session.bot.internal.setGroupSpecialTitle(session.guildId, targetId, '')
          dataService.logCommand(session, 'title', targetId, `成功：已移除头衔`)
          return `已经移除头衔啦喵~`
        }
        return '请使用 -s <文本> 设置头衔或 -r 移除头衔\n可选 -u @用户 为指定用户设置'
      } catch (e) {
        dataService.logCommand(session, 'title', targetId, `失败：未知错误`)
        return `出错啦喵...${e.message}`
      }
    })


  ctx.command('essence', '精华消息管理', { authority: ctx.config.setEssenceMsg.authority })
  .option('s', '-s 设置精华消息')
  .option('r', '-r 取消精华消息')
  .action(async ({ session, options }) => {
    if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
    if (!ctx.config.setEssenceMsg.enabled) return '喵呜...精华消息功能未启用...'
    if (!session.quote) return '喵喵！请回复要操作的消息呀~'

    try {
      if (options.s) {
        await session.bot.internal.setEssenceMsg(session.quote.messageId)
        dataService.logCommand(session, 'essence', 'set', `成功：已设置精华消息：${session.quote.messageId}`)
        return '已经设置为精华消息啦喵~'
      } else if (options.r) {
        await session.bot.internal.deleteEssenceMsg(session.quote.messageId)
        dataService.logCommand(session, 'essence', 'remove', `成功：已取消精华消息：${session.quote.messageId}`)
        return '已经取消精华消息啦喵~'
      }
      return '请使用 -s 设置精华消息或 -r 取消精华消息'
    } catch (e) {
      dataService.logCommand(session, 'essence', session.quote?.messageId || 'none', `失败：未知错误`)
      return `出错啦喵...${e.message}`
    }
  })


  ctx.command('antirepeat [threshold:number]', '复读管理', { authority: 3 })
    .action(async ({ session }, threshold) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'


      const config = dataService.getAntiRepeatConfig(session.guildId) || {
        enabled: false,
        threshold: ctx.config.antiRepeat.threshold
      }

      if (threshold === undefined) {

        return `当前群复读配置：
状态：${config.enabled ? '已启用' : '未启用'}
阈值：${config.threshold} 条
使用方法：
antirepeat 数字 - 设置复读阈值并启用（至少3条）
antirepeat 0 - 关闭复读检测`
      }

      if (threshold === 0) {

        dataService.saveAntiRepeatConfig(session.guildId, {
          enabled: false,
          threshold: config.threshold
        })
        dataService.logCommand(session, 'antirepeat', session.guildId, '成功：已关闭复读检测')
        return '已关闭本群的复读检测喵~'
      }

      if (threshold < 3) {
        dataService.logCommand(session, 'antirepeat', session.guildId, '失败：无效的阈值')
        return '喵呜...阈值至少要设置为3条以上喵...'
      }


      dataService.saveAntiRepeatConfig(session.guildId, {
        enabled: true,
        threshold: threshold
      })
      dataService.logCommand(session, 'antirepeat', session.guildId, `成功：已设置阈值为 ${threshold} 并启用`)
      return `已设置本群复读阈值为 ${threshold} 条并启用检测喵~`
    })

    // dice 功能开关
  ctx.command('dice-config', '掷骰子功能开关', { authority: 3 })
  .option('e', '-e <enabled:string> 启用或禁用掷骰子功能')
  .option('l', '-l <length:number> 设置掷骰子结果长度限制')
    .action(async ({ session, options }) => {
      if(options.e)
      {
        const enabled = options.e.toString().toLowerCase()
        if (enabled === 'true' || enabled === '1' || enabled === 'yes' || enabled === 'y' || enabled === 'on') {
          const groupConfigs = readData(dataService.groupConfigPath)
          groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
          groupConfigs[session.guildId].dice = groupConfigs[session.guildId].dice || {}
          groupConfigs[session.guildId].dice.enabled = true
          saveData(dataService.groupConfigPath, groupConfigs)
            dataService.logCommand(session, 'dice-enabled', session.guildId, '成功：已启用掷骰子功能')
            return '掷骰子功能已启用喵~'
        } else if (enabled === 'false' || enabled === '0' || enabled === 'no' || enabled === 'n' || enabled === 'off') {
            const groupConfigs = readData(dataService.groupConfigPath)
          groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
          groupConfigs[session.guildId].dice = groupConfigs[session.guildId].dice || {}
          groupConfigs[session.guildId].dice.enabled = false
          saveData(dataService.groupConfigPath, groupConfigs)
            dataService.logCommand(session, 'dice-enabled', session.guildId, '成功：已禁用掷骰子功能')
            return '掷骰子功能已禁用喵~'
        } else {
            dataService.logCommand(session, 'dice-enabled', session.guildId, '失败：设置无效')
            return '掷骰子选项无效，请输入 true/false'
        }
      }
      else if(options.l)
      {
        const length = options.l as number
        const groupConfigs = readData(dataService.groupConfigPath)
        groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
        groupConfigs[session.guildId].dice = groupConfigs[session.guildId].dice || {}
        groupConfigs[session.guildId].dice.lengthLimit = length
        saveData(dataService.groupConfigPath, groupConfigs)
        dataService.logCommand(session, 'dice-length', session.guildId, `成功：已设置掷骰子结果长度限制为 ${length}`)
        return `已设置掷骰子结果长度限制为 ${length} 喵~`
      }

    })

    // 随机数生成器，格式 dice <面数> [个数]
  ctx.command('dice <sides:number> [count:number]', '掷骰子', { authority: 1 })
    .example('dice 6') // 掷一个6面骰
    .example('dice 20 3') // 掷三个20面骰
    .action(async ({ session }, sides, count = 1) => {

      const groupConfigs = readData(dataService.groupConfigPath)
      const diceConfig = groupConfigs[session.guildId].dice || ctx.config.dice || {}

      // 读取 groupConfig 中的掷骰子功能开关
      if (!diceConfig.enabled) {
        return ''
      }

      if (!sides) {
        return '喵呜...请指定骰子面数喵~'
      }

      if (sides < 2 || count < 1) {
        return '喵呜...骰子面数至少为2，个数至少为1喵~'
      }


      if ((Math.log10(sides)+1)*count > diceConfig.lengthLimit) {
        return '喵呜...掷骰子结果过长，请选择较少的面数或个数喵~'
      }

      const results = []
      for (let i = 0; i < count; i++) {
        results.push(Math.floor(Math.random() * sides) + 1)
      }
      if(count === 1) {
        return `掷骰子结果：${results[0]}`
      }
      else {
        return `掷骰子结果：${results.join(', ')}`+`\n 总和：${results.reduce((a, b) => a + b, 0)}`
      }
    })

  ctx.command('quit-group <groupId:string>', '退出指定群聊', { authority: 4 })
    .example('quit-group 123456789')
    .action(async ({ session }, groupId) => {
      if (!groupId) return '喵呜...请指定要退出的群聊ID喵~'
      try {
        await session.bot.internal.setGroupLeave(groupId, false)
        dataService.logCommand(session, 'quit-group', groupId, `成功：已退出群聊 ${groupId}`)
        return `已成功退出群聊 ${groupId} 喵~`
      } catch (e) {
        dataService.logCommand(session, 'quit-group', groupId, `失败：未知错误`)
        return `喵呜...退出群聊失败了：${e.message}`
      }
    })

  ctx.command('nickname <user:user> <nickname:string> <group:string>', '设置用户昵称', { authority: 3 })
    .example('nickname 123456789 小猫咪')
    .action(async ({ session }, user, nickname, group) => {
      if (!user) return '喵呜...请指定用户喵~'

      const userId = String(user).split(':')[1]
      try {
        if (nickname) {
          await session.bot.internal.setGroupCard(group||session.guildId, userId, nickname)
          dataService.logCommand(session, 'nickname', userId, `成功：已设置昵称为 ${nickname}, 群号 ${group||session.guildId}`)
          return `已将 ${userId} 的昵称设置为 "${nickname}" 喵~`
        }
        else{
          await session.bot.internal.setGroupCard(group||session.guildId, userId)
          dataService.logCommand(session, 'nickname', userId, `成功：已清除昵称, 群号 ${group||session.guildId}`)
          return `已将 ${userId} 的昵称清除喵~`
        }
      } catch (e) {
        dataService.logCommand(session, 'nickname', userId, `失败：未知错误`)
        return `喵呜...设置昵称失败了：${e.message}`
      }
    })

      // 引用一条消息，向指定群聊发送指定消息，使用 -s 选项静默发送
  ctx.command('send <groupId:string>', '向指定群发送消息', { authority: 3 })
    .example('send 123456789')
    .option('s', '-s 静默发送，不显示发送者信息')
    .action(async ({ session, options }, groupId) => {
      if (!session.quote) return '喵喵！请回复要发送的消息呀~'

      try {
        if(options.s)
          await session.bot.sendMessage(groupId, session.quote.content)
        else
          await session.bot.sendMessage(groupId, '用户' + session.userId + '远程投送消息：\n' +session.quote.content)
        if(options.s)
          dataService.logCommand(session, 'send', groupId, `成功：已静默发送消息：${session.quote.messageId}`)
        else
          dataService.logCommand(session, 'send', groupId, `成功：已发送消息：${session.quote.messageId}`)
        return `已将消息发送到群 ${groupId} 喵~`
      } catch (e) {
        dataService.logCommand(session, 'send', groupId, `失败：未知错误`)
        return `喵呜...发送失败了：${e.message}`
      }
    })
  }
