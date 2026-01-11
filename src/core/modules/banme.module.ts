import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { parseTimeString, formatDuration } from '../../utils'

/**
 * 自助禁言模块
 * 支持抽卡系统和形似字符检测
 */
export class BanmeModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'banme',
    description: '自助禁言模块',
    version: '1.0.0'
  }

  /** 形似字符映射表路径 */
  private readonly similarCharsPath = './data/similarChars.json'

  protected async onInit(): Promise<void> {
    this.ensureSimilarChars()
    this.registerMiddleware()
    this.registerCommands()
    this.ctx.logger.info('[BanmeModule] initialized')
  }

  /**
   * 确保形似字符映射表存在
   */
  private ensureSimilarChars(): void {
    try {
      const fs = require('fs')
      if (!fs.existsSync(this.similarCharsPath)) {
        this.setDefaultSimilarChars()
      }
    } catch (e) {
      this.setDefaultSimilarChars()
    }
  }

  /**
   * 设置默认的形似字符映射表
   */
  private setDefaultSimilarChars(): void {
    const defaultSimilarChars = {
      'α': 'a', 'а': 'a', 'Α': 'a', 'А': 'a', 'ɒ': 'a', 'ɐ': 'a', '𝐚': 'a', '𝐀': 'a', '₳': 'a', 'ₐ': 'a', 'ₔ': 'a', 'ₕ': 'a', '₠': 'a', '𝓪': 'a', '4': 'a',
      'е': 'e', 'Е': 'e', 'ε': 'e', 'Ε': 'e', 'ë': 'e', 'Ë': 'e', '𝐞': 'e', '𝐄': 'e', 'ə': 'e', 'Э': 'e', 'э': 'e', '𝓮': 'e',
      'м': 'm', 'М': 'm', '𝐦': 'm', '𝐌': 'm', 'rn': 'm', 'ₘ': 'm', '₞': 'm', '₥': 'm', '₩': 'm', '₼': 'm', 'ɱ': 'm', '𝓶': 'm',
      'н': 'n', 'Н': 'n', 'η': 'n', 'Ν': 'n', '𝐧': 'n', '𝐍': 'n', 'И': 'n', 'ん': 'n', 'ₙ': 'n', '₦': 'n', 'П': 'n', 'п': 'n', '∩': 'n', 'ñ': 'n', '𝓷': 'n',
      'в': 'b', 'В': 'b', 'Ь': 'b', 'ь': 'b', 'β': 'b', 'Β': 'B', '𝐛': 'b', '𝐁': 'B', '♭': 'b', 'ß': 'b', '₧': 'b', '₨': 'b', '₿': 'b', '𝓫': 'b',
      '我': 'me',
      '禁言': 'ban',
      '禁': 'ban',
      'mute': 'ban',
      'myself': 'me'
    }
    this.saveData(this.similarCharsPath, defaultSimilarChars)
  }

  /**
   * 读取数据文件
   */
  private readData(path: string): any {
    try {
      const fs = require('fs')
      if (fs.existsSync(path)) {
        return JSON.parse(fs.readFileSync(path, 'utf-8'))
      }
    } catch (e) {
      this.ctx.logger.error(`[BanmeModule] 读取文件失败: ${path}`, e)
    }
    return null
  }

  /**
   * 保存数据文件
   */
  private saveData(path: string, data: any): void {
    try {
      const fs = require('fs')
      fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      this.ctx.logger.error(`[BanmeModule] 保存文件失败: ${path}`, e)
    }
  }

  /**
   * 规范化命令字符串
   */
  private normalizeCommand(command: string): string {
    // 移除所有类型的空白字符
    command = command.replace(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u200F\u2028-\u202F\u2060-\u206F\u205F\u3000\uFEFF]/g, '')

    // 移除所有标点符号
    command = command.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')

    // 移除所有零宽字符
    command = command.replace(/[\u200B-\u200D\uFEFF]/g, '')

    // 移除所有 unicode 控制字符、变体选择符
    command = command.replace(/[\uE000-\uF8FF\uFE00-\uFE0F\uFE20-\uFE2F]/g, '')

    // 移除所有组合字符
    command = command.replace(/[\u0300-\u036F\u1AB0-\u1AFF\u20D0-\u20FF]/g, '')

    let similarChars = this.readData(this.similarCharsPath)
    if (!similarChars || Object.keys(similarChars).length === 0) {
      this.setDefaultSimilarChars()
      similarChars = this.readData(this.similarCharsPath)
    }

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

  /**
   * 注册中间件检测形似字符
   */
  private registerMiddleware(): void {
    this.ctx.middleware(async (session, next) => {
      if (!session.content || !session.guildId) return next()

      const normalizedContent = this.normalizeCommand(this.normalizeCommand(session.content))
      if (normalizedContent === 'banme') {
        if (session.content !== 'banme') {
          const groupConfig = this.getGroupConfig(session.guildId)
          const banmeConfig = groupConfig?.banme || this.config.banme

          if (banmeConfig?.autoBan) {
            try {
              const result = await this.executeBanme(session, true)
              if (result) {
                await session.send(result)
                return
              }
            } catch (e) {
              await session.send('自动禁言失败了...可能是权限不够喵')
            }
          }
        }
        session.content = 'banme'
      }
      return next()
    })
  }

  /**
   * 执行 banme 逻辑
   */
  private async executeBanme(session: Session, isAuto: boolean = false): Promise<string | null> {
    const groupConfig = this.getGroupConfig(session.guildId)
    const banmeConfig = groupConfig?.banme || this.config.banme

    if (!banmeConfig?.enabled) {
      this.log(session, 'banme', session.userId, '失败：功能禁用')
      return '喵呜...banme功能现在被禁用了呢...'
    }

    try {
      const records = this.data.banmeRecords.getAll()
      const now = Date.now()

      if (!records[session.guildId]) {
        records[session.guildId] = {
          count: 0,
          lastResetTime: now,
          pity: 0,
          guaranteed: false
        }
      }

      // 每小时重置计数
      if (now - records[session.guildId].lastResetTime > 3600000) {
        records[session.guildId].count = 0
        records[session.guildId].lastResetTime = now
      }

      records[session.guildId].count++
      records[session.guildId].pity++

      // 计算抽卡概率
      let isJackpot = false
      let isGuaranteed = false

      let currentProb = banmeConfig.jackpot?.baseProb || 0.006
      const softPity = banmeConfig.jackpot?.softPity || 74
      const hardPity = banmeConfig.jackpot?.hardPity || 90

      if (records[session.guildId].pity >= softPity) {
        currentProb = (banmeConfig.jackpot?.baseProb || 0.006) +
          (records[session.guildId].pity - softPity + 1) * 0.06
      }

      if (records[session.guildId].pity >= hardPity || Math.random() < currentProb) {
        isJackpot = true
        isGuaranteed = records[session.guildId].pity >= hardPity

        records[session.guildId].pity = 0

        if (records[session.guildId].guaranteed) {
          records[session.guildId].guaranteed = false
        } else {
          if (Math.random() < 0.5) {
            records[session.guildId].guaranteed = true
          }
        }
      }

      this.data.banmeRecords.setAll(records)

      // 计算禁言时长
      let milliseconds: number
      if (isJackpot && banmeConfig.jackpot?.enabled) {
        if (records[session.guildId].guaranteed) {
          milliseconds = parseTimeString(banmeConfig.jackpot.loseDuration || '1d')
        } else {
          milliseconds = parseTimeString(banmeConfig.jackpot.upDuration || '7d')
        }
      } else {
        const baseMaxMillis = (banmeConfig.baseMax || 10) * 60 * 1000
        const baseMinMillis = Math.max((banmeConfig.baseMin || 1) * 1000, 1000)
        const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1 / 3) * (banmeConfig.growthRate || 2))
        const maxMilliseconds = Math.min(baseMaxMillis + (additionalMinutes * 60 * 1000), 30 * 24 * 60 * 60 * 1000)
        milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis)) + baseMinMillis
      }

      await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
      
      // 更新 mutes 存储 (嵌套结构: guildId -> userId -> MuteRecord)
      const allMutes = this.data.mutes.getAll()
      if (!allMutes[session.guildId]) {
        allMutes[session.guildId] = {}
      }
      allMutes[session.guildId][session.userId] = {
        startTime: now,
        duration: milliseconds
      }
      this.data.mutes.setAll(allMutes)

      const timeStr = formatDuration(milliseconds)
      let message = isAuto
        ? `🎲 检测到使用特殊字符逃避禁言，抽到了 ${timeStr} 的禁言喵！\n`
        : `🎲 ${session.username} 抽到了 ${timeStr} 的禁言喵！\n`

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

      this.log(session, 'banme', session.userId,
        `成功：${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
      return message

    } catch (e) {
      this.log(session, 'banme', session.userId, `失败：未知错误`)
      return `喵呜...禁言失败了：${e.message}`
    }
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // banme 主命令 - 所有人都可以使用
    this.registerCommand({
      name: 'banme',
      desc: '随机禁言自己',
      skipAuth: true, // 所有人都能使用
      usage: '随机抽取禁言时长，支持抽卡保底系统'
    }).action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (session.quote) return '喵喵？回复消息时不能使用这个命令哦~'
      return this.executeBanme(session)
    })

    // 输出形似字符映射表
    this.registerCommand({
      name: 'banme.similar',
      desc: '查看形似字符映射表',
      permDesc: '查看 banme 形似字符映射配置',
      usage: '显示当前配置的形似字符替换规则'
    }).action(({ session }) => {
      let similarChars = this.readData(this.similarCharsPath)
      if (!similarChars || Object.keys(similarChars).length === 0) {
        this.setDefaultSimilarChars()
        return '没有找到 banme 形似字符映射，已设置默认映射喵~'
      }
      similarChars = this.readData(this.similarCharsPath)
      const charList = Object.entries(similarChars).map(([char, replacement]) => `${char} -> ${replacement}`).join('\n')
      return `当前的 banme 形似字符映射如下喵~\n${charList || '没有形似字符映射喵~'}`
    })

    // 规范化命令测试
    this.registerCommand({
      name: 'banme.normalize',
      desc: '规范化命令测试',
      args: '<command:string>',
      permDesc: '测试 banme 规范化功能',
      usage: '测试字符串规范化结果，用于调试形似字符',
      examples: ['banme.normalize bаnmе']
    }).action(({ session }, command) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      const normalizedCommand = this.normalizeCommand(this.normalizeCommand(command))
      const response = `规范化后的命令：${normalizedCommand}\n长度：${normalizedCommand.length}\n字符列表：\n`
      const charList = normalizedCommand.split('').map((char, index) => `${index + 1}. ${char.charCodeAt(0).toString(16)}`).join('\n')
      return response + charList
    })

    // 通过引用消息逐字符添加形似字符替换
    this.registerCommand({
      name: 'banme.record',
      desc: '记录形似字符映射',
      args: '<standardCommand:string>',
      permDesc: '通过引用消息逐字符添加形似字符替换',
      usage: '引用一条包含形似字符的消息，提供标准字符串进行映射'
    }).action(async ({ session }, standardCommand) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!session.quote) return '请引用一条消息来记录映射喵~'
      if (standardCommand.length === 0) return '请提供标准命令字符串喵~'

      const quotedMessage = session.quote.content
      const normalizedCommand = this.normalizeCommand(this.normalizeCommand(quotedMessage))

      if (normalizedCommand.length !== standardCommand.length) {
        return '映射记录失败喵~\n' + '规范化字符串:' + normalizedCommand + '\n' + '对应的标准串:' + standardCommand + '\n' + '两者长度不一致喵~'
      }

      const similarChars = this.readData(this.similarCharsPath) || {}
      for (let i = 0; i < normalizedCommand.length; i++) {
        const originalChar = normalizedCommand[i]
        const standardChar = standardCommand[i]
        if (standardChar !== originalChar) {
          similarChars[originalChar] = standardChar
        }
      }

      this.saveData(this.similarCharsPath, similarChars)
      this.log(session, 'banme.record', session.userId, '成功')
      return '已记录形似字符映射喵~\n' + '规范化字符串：' + normalizedCommand + '\n' + '对应的标准串：' + standardCommand
    })

    // 通过引用消息添加字符串映射
    this.registerCommand({
      name: 'banme.alias',
      desc: '记录字符串别名',
      args: '<standardCommand:string>',
      permDesc: '通过引用消息添加字符串映射',
      usage: '引用一条消息，将其整体映射为标准字符串'
    }).action(async ({ session }, standardCommand) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      if (!session.quote) return '请引用一条消息来记录映射喵~'
      if (standardCommand.length === 0) return '请提供一个标准字符串喵~'

      const quotedMessage = session.quote.content
      const similarChars = this.readData(this.similarCharsPath) || {}
      similarChars[quotedMessage] = standardCommand

      this.saveData(this.similarCharsPath, similarChars)
      this.log(session, 'banme.alias', session.userId, '成功')
      return '已记录字符串映射喵~\n' + '原字符串：' + quotedMessage + '\n' + '对应的标准串：' + standardCommand
    })

    // banme 配置命令
    this.registerCommand({
      name: 'banme.config',
      desc: '设置banme配置',
      permDesc: '修改 banme 功能配置',
      usage: '配置本群的 banme 参数，包括启用、时长、概率等'
    })
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

        const configs = this.data.groupConfig.getAll()
        configs[session.guildId] = configs[session.guildId] || {}

        if (options.reset) {
          delete configs[session.guildId].banme
          this.data.groupConfig.setAll(configs)
          return '已重置为全局配置喵~'
        }

        let banmeConfig = configs[session.guildId].banme || { ...this.config.banme }
        banmeConfig.jackpot = banmeConfig.jackpot || { ...this.config.banme.jackpot }

        if (options.enabled !== undefined) {
          const enabled = options.enabled.toString().toLowerCase()
          if (['true', '1', 'yes', 'y', 'on'].includes(enabled)) {
            banmeConfig.enabled = true
          } else if (['false', '0', 'no', 'n', 'off'].includes(enabled)) {
            banmeConfig.enabled = false
          } else {
            this.log(session, 'banme.config', session.userId, '失败：启用选项无效')
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
        if (options.autoBan !== undefined) {
          const autoBan = options.autoBan.toString().toLowerCase()
          if (['true', '1', 'yes', 'y', 'on'].includes(autoBan)) {
            banmeConfig.autoBan = true
          } else if (['false', '0', 'no', 'n', 'off'].includes(autoBan)) {
            banmeConfig.autoBan = false
          } else {
            this.log(session, 'banme.config', session.userId, '失败：自动禁言选项无效')
            return '自动禁言选项无效，请输入 true/false'
          }
        }

        configs[session.guildId].banme = banmeConfig
        this.data.groupConfig.setAll(configs)
        this.log(session, 'banme.config', session.userId, '成功：更新banme配置')
        return '配置已更新喵~'
      })
  }
}