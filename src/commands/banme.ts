import { Context } from 'koishi'
import { DataService } from '../services'
import { parseTimeString, formatDuration, readData, saveData } from '../utils'

// 设置默认 similarChars.json 文件内容，如果没有此文件，则创建一个
function setDefaultSimilarChars() {
  const defaultSimilarChars = {'α': 'a', 'а': 'a', 'Α': 'a', 'А': 'a', 'ɒ': 'a', 'ɐ': 'a', '𝐚': 'a', '𝐀': 'a', '₳': 'a','ₐ': 'a', 'ₔ': 'a', 'ₕ': 'a', '₠': 'a', '𝓪': 'a', '4': 'a',
    'е': 'e', 'Е': 'e', 'ε': 'e', 'Ε': 'e', 'ë': 'e', 'Ë': 'e', '𝐞': 'e', '𝐄': 'e', 'ə': 'e', 'Э': 'e', 'э': 'e', '𝓮': 'e',
    'м': 'm', 'М': 'm', '𝐦': 'm', '𝐌': 'm', 'rn': 'm', 'ₘ': 'm', '₞': 'm', '₥': 'm', '₩': 'm', '₼': 'm', 'ɱ': 'm', '𝓶': 'm',
    'н': 'n', 'Н': 'n', 'η': 'n', 'Ν': 'n', '𝐧': 'n', '𝐍': 'n', 'И': 'n','ん': 'n', 'ₙ': 'n', '₦': 'n', 'П': 'n', 'п': 'n', '∩': 'n', 'ñ': 'n', '𝓷': 'n',
    'в': 'b', 'В': 'b','Ь': 'b', 'ь': 'b', 'β': 'b', 'Β': 'B', '𝐛': 'b', '𝐁': 'B', '♭': 'b', 'ß': 'b', '₧': 'b', '₨': 'b', '₿': 'b', '𝓫': 'b',
    '我': 'me',
    '禁言': 'ban',
    '禁': 'ban',
    'mute': 'ban',
    'myself': 'me',}
  saveData('./data/similarChars.json', defaultSimilarChars)
}

function normalizeCommand(command: string): string {
  // 移除所有类型的空白字符
  command = command.replace(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '')

  // 移除所有标点符号
  command = command.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

  // 移除所有数学符号
  //command = command.replace(/[\u2200-\u22FF\u2100-\u214F]/g, '')

  // 移除所有装饰符号，除了u266d
  //command = command.replace(/[\u2600-\u266C\u266E-\u26FF\u2700-\u27BF]/g, '')

  // 移除所有零宽字符
  command = command.replace(/[\u200B-\u200D\uFEFF]/g, '')

  // 移除所有 unicode 控制字符、变体选择符
  command = command.replace(/[\uE000-\uF8FF\uFE00-\uFE0F\uFE20-\uFE2F]/g, '')

  // 移除所有组合字符
  command = command.replace(/[\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF]/g, '')

  var similarChars = readData('./data/similarChars.json')
  // 如果映射大小为 0
  if (!similarChars || Object.keys(similarChars).length === 0) {
      setDefaultSimilarChars() // 如果不存在，设置默认的 similarChars.json 文件内容
  } 
  similarChars = readData('./data/similarChars.json')

  // 遍历映射表，匹配并替换字符
  for (const [char, replacement] of Object.entries(similarChars)) {
    const regex = new RegExp(char, 'g')
    command = command.replace(regex, replacement as string)
  }

  // 移除所有标点符号
  command = command.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

  // 移除重复字符
  command = command.replace(/(.)\1+/g, '$1')

  return command.toLowerCase()
}

export function registerBanmeCommands(ctx: Context, dataService: DataService) {

  ctx.middleware(async (session, next) => {
    if (!session.content || !session.guildId) return next()

    const normalizedContent = normalizeCommand(normalizeCommand(session.content))
    if (normalizedContent === 'banme') {

      if (session.content !== 'banme') {

        const groupConfigs = readData(dataService.groupConfigPath)
        const groupConfig = groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
        const banmeConfig = groupConfig.banme || ctx.config.banme

        if (banmeConfig.autoBan) {
          try {

            const records = readData(dataService.banMeRecordsPath)
            const now = Date.now()


            if (!records[session.guildId]) {
              records[session.guildId] = {
                count: 0,
                lastResetTime: now,
                pity: 0,
                guaranteed: false
              }
            }


            if (now - records[session.guildId].lastResetTime > 3600000) {
              records[session.guildId].count = 0
              records[session.guildId].lastResetTime = now
            }

            records[session.guildId].count++
            records[session.guildId].pity++


            let isJackpot = false
            let isGuaranteed = false

            let currentProb = banmeConfig.jackpot.baseProb
            if (records[session.guildId].pity >= banmeConfig.jackpot.softPity) {
              currentProb = banmeConfig.jackpot.baseProb +
                (records[session.guildId].pity - banmeConfig.jackpot.softPity + 1) * 0.06
            }

            if (records[session.guildId].pity >= banmeConfig.jackpot.hardPity || Math.random() < currentProb) {
              isJackpot = true
              isGuaranteed = records[session.guildId].pity >= banmeConfig.jackpot.hardPity

              records[session.guildId].pity = 0

              if (records[session.guildId].guaranteed) {
                records[session.guildId].guaranteed = false
              } else {
                if (Math.random() < 0.5) {
                  records[session.guildId].guaranteed = true
                }
              }
            }

            saveData(dataService.banMeRecordsPath, records)


            let milliseconds
            if (isJackpot && banmeConfig.jackpot.enabled) {
              if (records[session.guildId].guaranteed) {
                milliseconds = parseTimeString(banmeConfig.jackpot.loseDuration)
              } else {
                milliseconds = parseTimeString(banmeConfig.jackpot.upDuration)
              }
            } else {
              const baseMaxMillis = banmeConfig.baseMax * 60 * 1000
              const baseMinMillis = banmeConfig.baseMin * 1000
              const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1/3) * banmeConfig.growthRate)
              const maxMilliseconds = baseMaxMillis + (additionalMinutes * 60 * 1000)
              milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis + 1)) + baseMinMillis
            }

            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            dataService.recordMute(session.guildId, session.userId, milliseconds)

            const timeStr = formatDuration(milliseconds)
            let message = `🎲 检测到使用特殊字符逃避禁言，抽到了 ${timeStr} 的禁言喵！\n`

            if (isJackpot) {
              if (records[session.guildId].guaranteed) {
                message += '【金】呜呜呜歪掉了！但是下次一定会中的喵！\n'
              } else {
                message += '【金】喵喵喵！恭喜主人中了UP！\n'
              }
              if (isGuaranteed) {
                message += '触发保底啦喵~\n'
              }
            }

            dataService.logCommand(session, 'banme', session.userId,
              `成功: ${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
            await session.send(message)
            return
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
        }
      }

      session.content = 'banme'
    }
    return next()
  })


  ctx.command('banme', '随机禁言自己', { authority: 1 })
    .action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (session.quote) return '喵喵？回复消息时不能使用这个命令哦~'


      const groupConfigs = readData(dataService.groupConfigPath)
      const groupConfig = groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}


      const banmeConfig = groupConfig.banme || ctx.config.banme

      if (!banmeConfig.enabled) {
        dataService.logCommand(session, 'banme', session.userId, '失败：功能禁用')
        return '喵呜...banme功能现在被禁用了呢...'
      }

      try {

        const records = readData(dataService.banMeRecordsPath)
        const now = Date.now()


        if (!records[session.guildId]) {
          records[session.guildId] = {
            count: 0,
            lastResetTime: now,
            pity: 0,
            guaranteed: false
          }
        }


        if (now - records[session.guildId].lastResetTime > 3600000) {
          records[session.guildId].count = 0
          records[session.guildId].lastResetTime = now
        }

        records[session.guildId].count++
        records[session.guildId].pity++


        let isJackpot = false
        let isGuaranteed = false

        let currentProb = banmeConfig.jackpot.baseProb
        if (records[session.guildId].pity >= banmeConfig.jackpot.softPity) {
          currentProb = banmeConfig.jackpot.baseProb +
            (records[session.guildId].pity - banmeConfig.jackpot.softPity + 1) * 0.06
        }

        if (records[session.guildId].pity >= banmeConfig.jackpot.hardPity || Math.random() < currentProb) {
          isJackpot = true
          isGuaranteed = records[session.guildId].pity >= banmeConfig.jackpot.hardPity

          records[session.guildId].pity = 0

          if (records[session.guildId].guaranteed) {
            records[session.guildId].guaranteed = false
          } else {
            if (Math.random() < 0.5) {
              records[session.guildId].guaranteed = true
            }
          }
        }

        saveData(dataService.banMeRecordsPath, records)


        let milliseconds
        if (isJackpot && banmeConfig.jackpot.enabled) {
          if (records[session.guildId].guaranteed) {
            milliseconds = parseTimeString(banmeConfig.jackpot.loseDuration)
          } else {
            milliseconds = parseTimeString(banmeConfig.jackpot.upDuration)
          }
        } else {
          const baseMaxMillis = banmeConfig.baseMax * 60 * 1000
          const baseMinMillis = banmeConfig.baseMin * 1000
          const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1/3) * banmeConfig.growthRate)
          const maxMilliseconds = baseMaxMillis + (additionalMinutes * 60 * 1000)
          milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis + 1)) + baseMinMillis
        }

        await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
        dataService.recordMute(session.guildId, session.userId, milliseconds)

        const timeStr = formatDuration(milliseconds)
        let message = `🎲 ${session.username} 抽到了 ${timeStr} 的禁言喵！\n`

        if (isJackpot) {
          if (records[session.guildId].guaranteed) {
            message += '【金】呜呜呜歪掉了！但是下次一定会中的喵！\n'
          } else {
            message += '【金】喵喵喵！恭喜主人中了UP！\n'
          }
          if (isGuaranteed) {
            message += '触发保底啦喵~\n'
          }
        }

        dataService.logCommand(session, 'banme', session.userId,
          `成功：${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
        return message

      } catch (e) {
        dataService.logCommand(session, 'banme', session.userId, `失败：未知错误`)
        return `喵呜...禁言失败了：${e.message}`
      }
    })

    // 输出 similarChars.json 中的形似字符映射
  ctx.command('banme-similar', '输出 banme 形似字符映射表', { authority: 3 })
    .action(() => {
      // 如果 similarChars.json 文件存在
     
      var similarChars = readData('./data/similarChars.json')
      // 如果映射大小为 0
      if (!similarChars || Object.keys(similarChars).length === 0) {
        setDefaultSimilarChars() // 如果不存在，设置默认的 similarChars.json 文件内容
        return '没有找到 banme 形似字符映射，已设置默认映射喵~'
      }
      similarChars = readData('./data/similarChars.json')
      const charList = Object.entries(similarChars).map(([char, replacement]) => `${char} -> ${replacement}`).join('\n')
      return `当前的 banme 形似字符映射如下喵~\n${charList || '没有形似字符映射喵~'}`
    })

    // 引用消息，输出规范化后的命令和字符串长度，再每行逐一输出各字符的十六进制值
  ctx.command('banme-normalize <command:string>', '规范化 banme 命令', { authority: 3 })
    .action(({ session }, command) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      const normalizedCommand = normalizeCommand(normalizeCommand(command))
      const response = `规范化后的命令：${normalizedCommand}\n长度：${normalizedCommand.length}\n字符列表：\n`
      const charList = normalizedCommand.split('').map((char, index) => `${index + 1}. ${char.charCodeAt(0).toString(16)}`).join('\n')
      return response + charList
    })

    // 通过引用消息，添加banme形似字符替换 
    // 首先将命令规范化
    // 然后判断是否和对应的字符串长度相同
    // 如果是，将规范化后的字母与对应字符串一一对应，作为新增的形似字符映射
    // 将新增的形似字符映射添加到 similarChars.json 中

  ctx.command('banme-record-as <standardCommand:string>', '通过引用消息逐字符添加形似字符替换', { authority: 3 })
    .action(async ({ session }, standardCommand) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!session.quote) return '请引用一条消息来记录映射喵~'
      if (standardCommand.length === 0) return '请提供标准命令字符串喵~'

      const quotedMessage = session.quote.content
      const normalizedCommand = normalizeCommand(normalizeCommand(quotedMessage))

      if (normalizedCommand.length !== standardCommand.length) {
        return '映射记录失败喵~\n' + '规范化字符串:' + normalizedCommand + '\n' + '对应的标准串:' + standardCommand + '\n' + '两者长度不一致喵~'
      }

      const similarChars = readData('./data/similarChars.json') || {}
      for (let i = 0; i < normalizedCommand.length; i++) {
        const originalChar = normalizedCommand[i]
        const standardChar = standardCommand[i]
        if (standardChar !== originalChar) {
          similarChars[originalChar] = standardChar
        }
      }

      saveData('./data/similarChars.json', similarChars)
      dataService.logCommand(session, 'banme-record-as', session.userId, `成功`)
      return '已记录形似字符映射喵~\n'+'规范化字符串：' + normalizedCommand + '\n' + '对应的标准串：' + standardCommand
    })

  ctx.command('banme-record-allas <standardCommand:string>', '通过引用消息添加字符串映射', { authority: 3 })
    .action(async ({ session }, standardCommand) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!session.quote) return '请引用一条消息来记录映射喵~'
      if (standardCommand.length === 0) return '请提供一个标准字符串喵~'

      const quotedMessage = session.quote.content

      const similarChars = readData('./data/similarChars.json') || {}
      similarChars[quotedMessage]= standardCommand

      saveData('./data/similarChars.json', similarChars)
      dataService.logCommand(session, 'banme-record-allas', session.userId, `成功`)
      return '已记录字符串映射喵~\n'+'原字符串：' + quotedMessage + '\n' + '对应的标准串：' + standardCommand
    })

  ctx.command('banme-config', '设置banme配置', { authority: 3 })
    .option('enabled', '--enabled <enabled:boolean> 是否启用')
    .option('baseMin', '--baseMin <seconds:number> 最小禁言时间(秒)')
    .option('baseMax', '--baseMax <minutes:number> 最大禁言时间(分)')
    .option('rate', '--rate <rate:number> 增长率')
    .option('prob', '--prob <probability:number> 金卡基础概率')
    .option('spity', '--spity <count:number> 软保底抽数')
    .option('hpity', '--hpity <count:number> 硬保底抽数')
    .option('uptime', '--uptime <duration:string> UP奖励时长')
    .option('losetime', '--losetime <duration:string> 歪奖励时长')
    .option('autoBan', '--autoBan <enabled:boolean> 是否自动禁言使用特殊字符的用户')
    .option('reset', '--reset 重置为全局配置')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(dataService.groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}

      if (options.reset) {
        delete groupConfigs[session.guildId].banme
        saveData(dataService.groupConfigPath, groupConfigs)
        return '已重置为全局配置喵~'
      }


      let banmeConfig = groupConfigs[session.guildId].banme || { ...ctx.config.banme }
      banmeConfig.jackpot = banmeConfig.jackpot || { ...ctx.config.banme.jackpot }


      if (options.enabled !== undefined)
      {
        const enabled = options.enabled.toString().toLowerCase()
        if (enabled === 'true' || enabled === '1' || enabled === 'yes' || enabled === 'y' || enabled === 'on') {
          banmeConfig.enabled = true
        } else if (enabled === 'false' || enabled === '0' || enabled === 'no' || enabled === 'n' || enabled === 'off') {
          banmeConfig.enabled = false
        } else {
          dataService.logCommand(session, 'banme-config', session.userId, '失败：启用选项无效')
          return '启用选项无效，请输入 true/false'
        }
      }
      if (options.baseMin) banmeConfig.baseMin = options.baseMin
      if (options.baseMax) banmeConfig.baseMax = options.baseMax
      if (options.rate) banmeConfig.growthRate = options.rate
      if (options.prob) banmeConfig.jackpot.baseProb = options.prob
      if (options.spity) banmeConfig.jackpot.softPity = options.spity
      if (options.hpity) banmeConfig.jackpot.hardPity = options.hpity
      if (options.uptime) banmeConfig.jackpot.upDuration = options.uptime
      if (options.losetime) banmeConfig.jackpot.loseDuration = options.losetime
      if (options.autoBan !== undefined)
      {
        const autoBan = options.autoBan.toString().toLowerCase()
        if (autoBan === 'true' || autoBan === '1' || autoBan === 'yes' || autoBan === 'y' || autoBan === 'on') {
          banmeConfig.autoBan = true
        } else if (autoBan === 'false' || autoBan === '0' || autoBan === 'no' || autoBan === 'n' || autoBan === 'off') {
          banmeConfig.autoBan = false
        } else {
          dataService.logCommand(session, 'banme-config', session.userId, '失败：自动禁言选项无效')
          return '自动禁言选项无效，请输入 true/false'
        }
      }
      groupConfigs[session.guildId].banme = banmeConfig
      saveData(dataService.groupConfigPath, groupConfigs)
      dataService.logCommand(session, 'banme-config', session.userId,'成功：更新banme配置')
      return '配置已更新喵~'
    })
}