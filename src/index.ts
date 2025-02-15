import { Context, Schema, Command, Argv } from 'koishi'
import * as fs from 'fs'
import * as path from 'path'

declare module 'koishi' {
  interface Config {
    keywords: string[]
    warnLimit: number
    banTimes: {
      first: string
      second: string
      third: string
    }
    keywordBan: {
      enabled: boolean
      keywords: string[]
      duration: string
    }
    defaultWelcome: string  // 添加默认欢迎语配置
    banme: {
      enabled: boolean  // 是否启用banme
      baseMin: number   // 基础最小值（秒）
      baseMax: number   // 基础最大值（分钟）
      growthRate: number // 递增系数
      jackpot: {
        enabled: boolean  // 是否启用金
        baseProb: number  // 基础概率
        softPity: number  // 软保底抽数
        hardPity: number  // 硬保底抽数
        upDuration: string // UP奖励时长
        loseDuration: string // 歪了奖励时长
      }
    }
  }
}

export const name = 'grouphelper'

export const usage = `
# 使用说明请查看github readme。
https://github.com/camvanaa/koishi-plugin-grouphelper#readme
`

// 定义配置接口
export interface Config {
  keywords: string[]  // 入群审核关键词
  warnLimit: number
  banTimes: {
    first: string
    second: string
    third: string
  }
  keywordBan: {
    enabled: boolean
    keywords: string[]  // 禁言关键词
    duration: string
  }
  defaultWelcome?: string  // 默认欢迎语
  banme: {
    enabled: boolean  // 是否启用banme
    baseMin: number   // 基础最小值（秒）
    baseMax: number   // 基础最大值（分钟）
    growthRate: number // 递增系数
    jackpot: {
      enabled: boolean  // 是否启用金
      baseProb: number  // 基础概率
      softPity: number  // 软保底抽数
      hardPity: number  // 硬保底抽数
      upDuration: string // UP奖励时长
      loseDuration: string // 歪了奖励时长
    }
  }
}

// 群配置接口
interface GroupConfig {
  keywords: string[]  // 群专属的禁言关键词
  approvalKeywords: string[]  // 群专属的入群审核关键词
  welcomeMsg?: string  // 入群欢迎语
}

// 配置模式
export const Config: Schema<Config> = Schema.object({
  keywords: Schema.array(Schema.string()).default([])
    .description('入群审核关键词列表'),
  warnLimit: Schema.number().default(3)
    .description('警告达到多少次触发自动禁言'),
  banTimes: Schema.object({
    first: Schema.string().default('1h')
      .description('第一次自动禁言时长'),
    second: Schema.string().default('12h')
      .description('第二次自动禁言时长'),
    third: Schema.string().default('24h')
      .description('第三次自动禁言时长')
  }).description('自动禁言时长设置'),
  keywordBan: Schema.object({
    enabled: Schema.boolean().default(false)
      .description('是否启用关键词自动禁言'),
    keywords: Schema.array(Schema.string()).default([])
      .description('触发禁言的关键词列表'),
    duration: Schema.string().default('10min')
      .description('关键词触发的禁言时长(格式：数字+单位[s/min/h])')
  }).description('关键词禁言设置'),
  defaultWelcome: Schema.string().description('默认欢迎语'),
  banme: Schema.object({
    enabled: Schema.boolean().default(true)
      .description('是否启用banme指令'),
    baseMin: Schema.number().default(1)
      .description('基础最小禁言时长（秒）'),
    baseMax: Schema.number().default(30)
      .description('基础最大禁言时长（分钟）'),
    growthRate: Schema.number().default(30)
      .description('递增系数（越大增长越快）'),
    jackpot: Schema.object({
      enabled: Schema.boolean().default(true)
        .description('是否启用金卡系统'),
      baseProb: Schema.number().default(0.006)
        .description('金卡基础概率'),
      softPity: Schema.number().default(73)
        .description('软保底抽数'),
      hardPity: Schema.number().default(89)
        .description('硬保底抽数'),
      upDuration: Schema.string().default('24h')
        .description('UP奖励时长'),
      loseDuration: Schema.string().default('12h')
        .description('歪了奖励时长')
    }).description('金卡系统设置')
  }).description('banme指令设置')
})

// 数据库接口
interface WarnRecord {
  userId: string
  count: number
  timestamp: number
}

interface BlacklistRecord {
  userId: string
  timestamp: number
}

// 添加禁言记录接口
interface MuteRecord {
  startTime: number
  duration: number
  remainingTime?: number
  leftGroup?: boolean
}

// 添加抽奖记录接口
interface BanMeRecord {
  count: number
  lastResetTime: number
  pity: number  // 保底计数
  guaranteed: boolean  // 是否大保底
}

// 添加锁定名称记录接口
interface LockedName {
  userId: string
  name: string
}

export function apply(ctx: Context) {
  // 数据存储路径
  const dataPath = path.resolve(ctx.baseDir, 'data/grouphelper')
  const warnsPath = path.resolve(dataPath, 'warns.json')
  const blacklistPath = path.resolve(dataPath, 'blacklist.json')
  const groupConfigPath = path.resolve(dataPath, 'group_config.json')  // 新增群配置文件
  // 添加禁言记录存储
  const mutesPath = path.resolve(dataPath, 'mutes.json')
  // 添加调用记录存储
  const banMeRecordsPath = path.resolve(dataPath, 'banme_records.json')
  // 添加锁定名称记录存储
  const lockedNamesPath = path.resolve(dataPath, 'locked_names.json')

  // 确保数据目录存在
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }

  // 初始化数据文件
  if (!fs.existsSync(warnsPath)) {
    fs.writeFileSync(warnsPath, '{}')
  }
  if (!fs.existsSync(blacklistPath)) {
    fs.writeFileSync(blacklistPath, '{}')
  }
  if (!fs.existsSync(groupConfigPath)) {
    fs.writeFileSync(groupConfigPath, '{}')
  }
  if (!fs.existsSync(mutesPath)) {
    fs.writeFileSync(mutesPath, '{}')
  }
  if (!fs.existsSync(banMeRecordsPath)) {
    fs.writeFileSync(banMeRecordsPath, '{}')
  }
  if (!fs.existsSync(lockedNamesPath)) {
    fs.writeFileSync(lockedNamesPath, '{}')
  }

  // 读取数据函数
  const readData = (filePath: string) => {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return {}
    }
  }

  // 保存数据函数
  const saveData = (filePath: string, data: any) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  // 添加禁言记录函数
  function recordMute(guildId: string, userId: string, duration: number) {
    const mutes = readData(mutesPath)
    if (!mutes[guildId]) mutes[guildId] = {}
    
    mutes[guildId][userId] = {
      startTime: Date.now(),
      duration: duration,
      leftGroup: false
    }
    
    saveData(mutesPath, mutes)
  }

  // 添加表达式解析函数
  function evaluateExpression(expr: string): number {
    try {
      // 移除所有空格
      expr = expr.replace(/\s/g, '')
      
      // 安全检查：只允许数字、基本运算符、括号、sqrt和x
      if (!/^[\d+\-*/()^.esqrtx]+$/.test(expr)) {
        throw new Error(`表达式包含非法字符: ${expr}`)
      }

      // 替换科学计数法
      expr = expr.replace(/(\d+)e(\d+)/g, '($1*10**$2)')
      
      // 替换 x 为 *
      expr = expr.replace(/x/g, '*')
      
      // 替换 ^ 为 **
      expr = expr.replace(/\^/g, '**')
      
      // 替换 sqrt 为 Math.sqrt
      expr = expr.replace(/sqrt\(/g, 'Math.sqrt(')
      
      // 计算表达式
      const result = eval(expr)
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error(`计算结果无效: ${result}`)
      }
      return result
    } catch (e) {
      throw new Error(`表达式计算错误: ${e.message}\n原始表达式: ${expr}`)
    }
  }

  // 定义时间限制常量（毫秒）
  const MIN_DURATION = 1000 // 1秒
  const MAX_DURATION = 29 * 24 * 3600 * 1000 + 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 // 29天23小时59分59秒

  // 修改时间解析函数
  function parseTimeString(timeStr: string): number {
    try {
      if (!timeStr) {
        throw new Error('未提供时间')
      }

      // 匹配数值表达式和单位
      const match = timeStr.match(/^(.+?)(s|min|h)$/)
      if (!match) {
        throw new Error(`时间格式错误：${timeStr}`)
      }

      const [, expr, unit] = match
      let value: number

      // 尝试直接解析数字（支持简单格式）
      const simpleNumber = parseFloat(expr)
      if (!isNaN(simpleNumber) && expr === simpleNumber.toString()) {
        value = simpleNumber
      } else {
        // 如果不是简单数字，则尝试解析表达式
        value = evaluateExpression(expr)
      }
      
      // 转换为毫秒
      let milliseconds: number
      switch (unit) {
        case 'h':
          milliseconds = value * 3600 * 1000
          break
        case 'min':
          milliseconds = value * 60 * 1000
          break
        case 's':
          milliseconds = value * 1000
          break
        default:
          throw new Error('未知时间单位')
      }

      // 限制时间范围
      if (milliseconds < MIN_DURATION) {
        return MIN_DURATION
      }
      if (milliseconds > MAX_DURATION) {
        return MAX_DURATION
      }

      return milliseconds
    } catch (e) {
      throw new Error(`时间解析错误: ${e.message}`)
    }
  }

  // 在 apply 函数开头添加日志记录函数
  function logCommand(session: any, command: string, target: string, result: string) {
    const time = new Date().toISOString()
    const user = session.username || session.userId
    const group = session.guildId || 'private'
    console.log(`[${time}] [${command}] User(${user}) Group(${group}) Target(${target}): ${result}`)
  }

  // 添加工具函数来处理用户ID
  function parseUserId(user: string | any): string {
    if (!user) return null
    
    // 如果是字符串（QQ号）
    if (typeof user === 'string') {
      // 移除可能存在的@符号和空格
      return user.replace(/^@/, '').trim()
    }
    
    // 如果是 user 对象（@用户）
    return String(user).split(':')[1]
  }

  // 处理入群请求
  ctx.on('guild-member-request', async (session) => {
    const { userId, guildId } = session
    const { _data: data } = session.event
    
    // 检查黑名单
    const blacklist = readData(blacklistPath)
    if (blacklist[userId]) {
      await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
      return
    }

    // 获取群配置
    const groupConfigs = readData(groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }
    
    // 合并全局和群专属关键词
    const keywords = [...ctx.config.keywords, ...groupConfig.approvalKeywords]

    // 检查关键词（忽略大小写）
    if (keywords.length > 0 && data.comment) {
      const comment = data.comment.toLowerCase() // 转换为小写
      for (const keyword of keywords) {
        try {
          // 尝试作为正则表达式处理，添加 i 标志以忽略大小写
          const regex = new RegExp(keyword, 'i')
          if (regex.test(data.comment)) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        } catch (e) {
          // 如果不是有效的正则表达式，则使用普通字符串匹配（忽略大小写）
          if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
            await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
            return
          }
        }
      }
    }
    
    // 如果没有关键词或没有匹配到，不处理请求
    return
  })

  // 在群成员加入时处理欢迎语
  ctx.on('guild-member-added', async (session) => {
    const { guildId, userId } = session
    
    // 检查是否有未完成的禁言
    const mutes = readData(mutesPath)
    if (mutes[guildId]?.[userId]?.leftGroup) {
      const muteRecord = mutes[guildId][userId]
      
      // 恢复禁言
      await session.bot.muteGuildMember(guildId, userId, muteRecord.remainingTime)
      
      // 更新记录
      muteRecord.startTime = Date.now()
      muteRecord.duration = muteRecord.remainingTime
      delete muteRecord.remainingTime
      muteRecord.leftGroup = false
      saveData(mutesPath, mutes)
      
      // 发送提示
      await session.send(`检测到未完成的禁言，继续执行剩余 ${formatDuration(muteRecord.duration)} 的禁言`)
    }
    
    // 获取群配置
    const groupConfigs = readData(groupConfigPath)
    const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [] }
    
    // 如果有设置欢迎语，发送欢迎消息
    if (groupConfig.welcomeMsg) {
      const msg = groupConfig.welcomeMsg
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    } else if (ctx.config.defaultWelcome) {
      // 如果没有群特定欢迎语但有默认欢迎语，使用默认欢迎语
      const msg = ctx.config.defaultWelcome
        .replace(/{at}/g, `<at id="${userId}"/>`)
        .replace(/{user}/g, userId)
        .replace(/{group}/g, guildId)
      await session.send(msg)
    }
  })

  // 警告命令
  ctx.command('warn <user:user> [count:number]', '警告用户', { authority: 3 })
    .action(async ({ session }, user, count = 1) => {
      if (!user) return '请指定用户'
      
      const warns = readData(warnsPath)
      const userId = String(user).split(':')[1]
      warns[userId] = warns[userId] || { count: 0, timestamp: 0 }
      warns[userId].count += count
      warns[userId].timestamp = Date.now()
      
      saveData(warnsPath, warns)

      // 自动执行 autoban
      const warnCount = warns[userId].count
      let duration
      if (warnCount >= ctx.config.warnLimit * 3) {
        duration = ctx.config.banTimes.third
      } else if (warnCount >= ctx.config.warnLimit * 2) {
        duration = ctx.config.banTimes.second
      } else if (warnCount >= ctx.config.warnLimit) {
        duration = ctx.config.banTimes.first
      }

      if (duration) {
        try {
          const milliseconds = parseTimeString(duration)
          await session.bot.muteGuildMember(session.guildId, userId, milliseconds)
          // 添加禁言记录
          recordMute(session.guildId, userId, milliseconds)
          return `已警告用户 ${userId}，当前警告次数：${warns[userId].count}\n已自动禁言 ${duration}`
        } catch (e) {
          return `警告已记录，但自动禁言失败：${e.message}`
        }
      }

      return `已警告用户 ${userId}，当前警告次数：${warns[userId].count}`
    })

  // kick命令
  ctx.command('kick <input:text>', '踢出用户', { authority: 3 })
    .example('kick @用户')
    .example('kick 123456789')
    .example('kick @用户 群号')
    .example('kick @用户 -b')
    .example('kick 123456789 -b 群号')
    .option('black', '-b 加入黑名单')
    .action(async ({ session, options }, input) => {
      // 检查是否包含 -b 选项
      const hasBlackOption = input.includes('-b')
      // 移除 -b 选项并规范化空格
      input = input.replace(/-b/g, '').replace(/\s+/g, ' ').trim()
      
      console.log('Normalized input:', input, 'Black option:', hasBlackOption)
      
      let args: string[]
      if (input.includes('<at')) {
        // 如果包含 at，使用特殊处理
        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(' ')]
        } else {
          args = input.split(' ')
        }
      } else {
        // 普通分割
        args = input.split(' ')
      }

      const [target, groupId] = args
      console.log('Split params:', { target, groupId, hasBlackOption })
      
      // 尝试解析为 user 对象
      let userId: string
      try {
        // 如果是 @ 格式
        if (target?.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {
          // 如果是普通字符串（QQ号）
          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }
      
      if (!userId) {
        logCommand(session, 'kick', 'none', 'Failed: Invalid user format')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }
      
      const targetGroup = groupId || session.guildId
      
      try {
        await session.bot.kickGuildMember(targetGroup, userId)
        
        if (hasBlackOption) {
          const blacklist = readData(blacklistPath)
          blacklist[userId] = { timestamp: Date.now() }
          saveData(blacklistPath, blacklist)
          logCommand(session, 'kick', userId, `Success: Kicked and blacklisted in group ${targetGroup}`)
          return `已把坏人 ${userId} 踢出去并加入黑名单啦喵！`
        }
        
        logCommand(session, 'kick', userId, `Success: Kicked from group ${targetGroup}`)
        return `已把 ${userId} 踢出去喵~`
      } catch (e) {
        logCommand(session, 'kick', userId, `Failed: ${e.message}`)
        return `喵呜...踢出失败了：${e.message}`
      }
    })

  // config命令
  ctx.command('config', '配置管理', { authority: 3 })
    .option('t', '-t 显示所有记录')
    .option('b', '-b 黑名单管理')
    .option('w', '-w 警告管理')
    .option('a', '-a <内容> 添加')
    .option('r', '-r <内容> 移除')
    .action(async ({ session, options }, content) => {
      // 显示记录
      if (options.t) {
        const warns = readData(warnsPath)
        const blacklist = readData(blacklistPath)
        const groupConfigs = readData(groupConfigPath)
        
        // 清理警告次数为0的记录
        for (const userId in warns) {
          if (warns[userId].count <= 0) {
            delete warns[userId]
          }
        }
        saveData(warnsPath, warns)
        
        const formatWarns = Object.entries(warns).map(([userId, data]: [string, WarnRecord]) => 
          `用户 ${userId}：${data.count} 次 (${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
        ).join('\n')
        
        const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) => 
          `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ).join('\n')
        
        const currentGroupKeywords = session.guildId ? (groupConfigs[session.guildId]?.keywords || []) : []
        const currentGroupApprovalKeywords = session.guildId ? (groupConfigs[session.guildId]?.approvalKeywords || []) : []
        
        const currentWelcome = session.guildId ? (groupConfigs[session.guildId]?.welcomeMsg || '未设置') : '未设置'
        
        const mutes = readData(mutesPath)
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
        
        const banMeRecords = readData(banMeRecordsPath)
        const currentBanMe = banMeRecords[session.guildId] || { count: 0, pity: 0, guaranteed: false }
        
        return `=== 入群欢迎 ===
默认欢迎语：${safeDefaultWelcome}
本群欢迎语：${safeWelcome}

=== 入群审核关键词 ===
全局关键词：${ctx.config.keywords.join('、') || '无'}
本群关键词：${currentGroupApprovalKeywords.join('、') || '无'}

=== 禁言关键词 ===
全局关键词：${ctx.config.keywordBan.keywords.join('、') || '无'}
本群关键词：${currentGroupKeywords.join('、') || '无'}
状态：${ctx.config.keywordBan.enabled ? '已启用' : '未启用'}
禁言时长：${ctx.config.keywordBan.duration}

=== 自动禁言配置 ===
警告限制：${ctx.config.warnLimit} 次
第一次：${ctx.config.banTimes.first}
第二次：${ctx.config.banTimes.second}
第三次：${ctx.config.banTimes.third}

=== 警告记录 ===
${formatWarns || '无记录'}

=== 黑名单 ===
${formatBlacklist || '无记录'}

=== Banme 统计 ===
本群1小时内使用：${currentBanMe.count} 次
当前抽数：${currentBanMe.pity}
状态：${currentBanMe.guaranteed ? '大保底' : '普通'}
当前最大禁言：${formatDuration((30 + Math.floor(Math.pow(currentBanMe.count - 1, 1/3) * 30)) * 60 * 1000)}

=== 当前禁言 ===
${formatMutes || '无记录'}`
      }

      // 黑名单管理
      if (options.b) {
        const blacklist = readData(blacklistPath)
        if (options.a) {
          blacklist[options.a] = { timestamp: Date.now() }
          saveData(blacklistPath, blacklist)
          return `已将 ${options.a} 加入黑名单喵~`
        }
        if (options.r) {
          delete blacklist[options.r]
          saveData(blacklistPath, blacklist)
          return `已将 ${options.r} 从黑名单移除啦！`
        }
        // 显示当前黑名单
        const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) => 
          `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
        ).join('\n')
        return `=== 当前黑名单 ===\n${formatBlacklist || '无记录'}`
      }

      // 警告管理
      if (options.w) {
        const warns = readData(warnsPath)
        if (options.a) {
          warns[options.a] = warns[options.a] || { count: 0, timestamp: Date.now() }
          warns[options.a].count += parseInt(content) || 1
          warns[options.a].timestamp = Date.now()
          saveData(warnsPath, warns)
          return `已增加 ${options.a} 的警告次数，当前为：${warns[options.a].count}`
        }
        if (options.r) {
          if (warns[options.r]) {
            warns[options.r].count -= parseInt(content) || 1
            if (warns[options.r].count <= 0) {
              delete warns[options.r]
              saveData(warnsPath, warns)
              return `已移除 ${options.r} 的警告记录`
            }
            warns[options.r].timestamp = Date.now()
            saveData(warnsPath, warns)
            return `已减少 ${options.r} 的警告次数，当前为：${warns[options.r].count}`
          }
          return '未找到该用户的警告记录'
        }
        // 显示当前警告记录
        const formatWarns = Object.entries(warns).map(([userId, data]: [string, WarnRecord]) => 
          `用户 ${userId}：${data.count} 次 (${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
        ).join('\n')
        return `=== 当前警告记录 ===\n${formatWarns || '无记录'}`
      }

      // 如果没有指定操作，显示帮助信息
      return `请使用以下参数：
-t 显示所有配置和记录
-b [-a/-r {QQ号}] 黑名单管理
-w [-a/-r {QQ号} {次数}] 警告管理
使用 groupkw 命令管理群关键词`
    })

  // check命令
  ctx.command('check <user:user>', '查询用户记录', { authority: 3 })
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      
      const warns = readData(warnsPath)
      const blacklist = readData(blacklistPath)
      
      let response = `喵喵！${userId} 的记录如下：
警告次数：${warns[userId]?.count || 0}
是否在黑名单：${blacklist[userId] ? '是喵...' : '不是喵~'}`
      
      return response
    })

  // 添加关键词命令
  ctx.command('addkeyword <keyword>', '添加入群关键词')
    .alias('akw')
    .action(async ({ session }, keyword) => {
      if (!keyword) return '请提供关键词'
      ctx.config.keywords.push(keyword)
      return `已经添加了关键词：${keyword} 喵喵喵~`
    })

  // ban命令
  ctx.command('ban <input:text>', '禁言用户', { authority: 3 })
    .example('ban @用户 1h')
    .example('ban 123456789 1h')
    .example('ban @用户 1h 群号')
    .action(async ({ session }, input) => {
      // 先处理 at 格式
      let args: string[]
      if (input.includes('<at')) {
        // 如果包含 at，使用特殊处理
        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(/\s+/)]
        } else {
          args = input.split(/\s+/)
        }
      } else {
        // 普通分割
        args = input.split(/\s+/)
      }

      if (!args || args.length < 2) {
        logCommand(session, 'ban', 'none', 'Failed: Insufficient parameters')
        return '喵呜...格式：ban <用户> <时长> [群号]'
      }
      
      const [target, duration, groupId] = args
      console.log('Split params:', { target, duration, groupId })
      
      // 尝试解析为 user 对象
      let userId: string
      try {
        // 如果是 @ 格式
        if (target.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {
          // 如果是普通字符串（QQ号）
          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }
      
      if (!userId) {
        logCommand(session, 'ban', 'none', 'Failed: Invalid user format')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }
      
      if (!duration) {
        logCommand(session, 'ban', userId, 'Failed: No duration specified')
        return '喵呜...请告诉我要禁言多久呀~'
      }
      
      const targetGroup = groupId || session.guildId
      
      try {
        const milliseconds = parseTimeString(duration)
        await session.bot.muteGuildMember(targetGroup, userId, milliseconds)
        recordMute(targetGroup, userId, milliseconds)
        
        const timeStr = formatDuration(milliseconds)
        logCommand(session, 'ban', userId, `Success: Muted for ${timeStr} in group ${targetGroup}`)
        return `已经把 ${userId} 禁言 ${duration} (${timeStr}) 啦喵~`
      } catch (e) {
        logCommand(session, 'ban', userId, `Failed: ${e.message}`)
        return `喵呜...禁言失败了：${e.message}`
      }
    })

  // unban命令
  ctx.command('unban <input:text>', '解除用户禁言', { authority: 3 })
    .example('unban @用户')
    .example('unban 123456789')
    .example('unban @用户 群号')
    .action(async ({ session }, input) => {
      // 先处理 at 格式
      let args: string[]
      if (input.includes('<at')) {
        // 如果包含 at，使用特殊处理
        const atMatch = input.match(/<at[^>]+>/)
        if (atMatch) {
          const atPart = atMatch[0]
          const restPart = input.replace(atPart, '').trim()
          args = [atPart, ...restPart.split(/\s+/)]
        } else {
          args = input.split(/\s+/)
        }
      } else {
        // 普通分割
        args = input.split(/\s+/)
      }

      const [target, groupId] = args
      console.log('Split params:', { target, groupId })
      
      // 尝试解析为 user 对象
      let userId: string
      try {
        // 如果是 @ 格式
        if (target.startsWith('<at')) {
          const match = target.match(/id="(\d+)"/)
          if (match) {
            userId = match[1]
          }
        } else {
          // 如果是普通字符串（QQ号）
          userId = parseUserId(target)
        }
      } catch (e) {
        userId = parseUserId(target)
      }
      
      if (!userId) {
        logCommand(session, 'unban', 'none', 'Failed: Invalid user format')
        return '喵呜...请输入正确的用户（@或QQ号）'
      }
      
      const targetGroup = groupId || session.guildId
      
      try {
        await session.bot.muteGuildMember(targetGroup, userId, 0)
        logCommand(session, 'unban', userId, `Success: Unmuted in group ${targetGroup}`)
        return `已经把 ${userId} 的禁言解除啦喵！开心~`
      } catch (e) {
        logCommand(session, 'unban', userId, `Failed: ${e.message}`)
        return `喵呜...解除禁言失败了：${e.message}`
      }
    })

  // autoban命令
  ctx.command('autoban <user:user>', '根据警告次数自动禁言', { authority: 3 })
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      
      const warns = readData(warnsPath)
      const warnCount = warns[userId]?.count || 0
      
      let duration
      if (warnCount >= ctx.config.warnLimit * 3) {
        duration = ctx.config.banTimes.third
      } else if (warnCount >= ctx.config.warnLimit * 2) {
        duration = ctx.config.banTimes.second
      } else if (warnCount >= ctx.config.warnLimit) {
        duration = ctx.config.banTimes.first
      } else {
        return `喵呜...警告次数（${warnCount}）还不够呢，再观察一下吧~`
      }
      
      try {
        const milliseconds = parseTimeString(duration)
        await session.bot.muteGuildMember(session.guildId, userId, milliseconds)
        // 添加禁言记录
        recordMute(session.guildId, userId, milliseconds)
        return `已经按照警告次数把 ${userId} 禁言啦喵！`
      } catch (e) {
        return `出错啦喵...${e.message}`
      }
    })

  // grouphelper命令
  ctx.command('grouphelper', '群管理帮助', { authority: 3 })
    .action(async ({ session }) => {
      return `=== 基础命令 ===
kick {@用户} [-b] [群号]  踢出用户，-b 表示加入黑名单
ban {@用户} {时长} [群号]  禁言用户，支持表达式
unban {@用户} [群号]  解除用户禁言
ban-all  开启全体禁言
unban-all  解除全体禁言
unban-allppl  解除所有人禁言
delmsg (回复)  撤回指定消息
banme [次数]  随机禁言自己
  · 普通抽卡：1秒~30分钟（每次使用递增上限）
  · 金卡概率：0.6%（73抽后概率提升，89抽保底）
  · UP奖励：24小时禁言
  · 歪奖励：12小时禁言（下次必中UP）

=== 警告系统 ===
warn {@用户} [次数]  警告用户，默认1次
check {@用户}  查询用户记录
autoban {@用户}  根据警告次数自动禁言

=== 关键词管理 ===
groupkw  群关键词管理：
  -l  列出本群关键词
  -a <关键词>  添加本群关键词，多个关键词用英文逗号分隔
  -r <关键词>  移除本群关键词，多个关键词用英文逗号分隔
  -p  管理入群审核关键词（需配合上述参数使用）

=== 欢迎设置 ===
welcome  入群欢迎语管理：
  -s <消息>  设置欢迎语
  -r  移除欢迎语
  -t  测试当前欢迎语
支持变量：
  {at}  @新成员
  {user}  新成员QQ号
  {group}  群号

=== 配置管理 ===
config  配置管理：
  -t  显示所有配置和记录
  -b  黑名单管理
    -a {QQ号}  添加黑名单
    -r {QQ号}  移除黑名单
  -w  警告管理
    -a {QQ号} [次数]  增加警告
    -r {QQ号} [次数]  减少警告

=== 时间表达式 ===
支持以下格式：
· 基本单位：s（秒）、min（分钟）、h（小时）
· 基本格式：数字+单位，如：1h、10min、30s
· 支持的运算：
  · +, -, *, /, ^, sqrt(), 1e2
· 表达式示例：
  · (sqrt(100)+1e1)^2s = 400秒 = 6分40秒
· 时间范围：1秒 ~ 29天23小时59分59秒`
    })

  // delmsg命令
  ctx.command('delmsg', '撤回消息', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.quote) return '喵喵！请回复要撤回的消息呀~'
      
      try {
        await session.bot.deleteMessage(session.channelId, session.quote.id)
        return '消息已经被我吃掉啦喵~'
      } catch (e) {
        return '呜呜...撤回失败了，可能太久了或者没有权限喵...'
      }
    })

  // ban-all命令
  ctx.command('ban-all', '全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, true)
        return '喵呜...全体禁言开启啦，大家都要乖乖的~'
      } catch (e) {
        return `出错啦喵...${e.message}`
      }
    })

  // unban-all命令
  ctx.command('unban-all', '解除全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, false)
        return '全体禁言解除啦喵，可以开心聊天啦~'
      } catch (e) {
        return `出错啦喵...${e.message}`
      }
    })

  // 添加群关键词管理命令
  ctx.command('groupkw', '群关键词管理', { authority: 3 })
    .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
    .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
    .option('l', '-l 列出关键词')
    .option('p', '-p 管理入群审核关键词')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || { 
        keywords: [], 
        approvalKeywords: [] 
      }

      // 处理入群审核关键词
      if (options.p) {
        if (options.l) {
          const keywords = groupConfigs[session.guildId].approvalKeywords
          return `当前群入群审核关键词：\n${keywords.join('、') || '无'}`
        }

        if (options.a) {
          const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
          groupConfigs[session.guildId].approvalKeywords.push(...newKeywords)
          saveData(groupConfigPath, groupConfigs)
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
            saveData(groupConfigPath, groupConfigs)
            return `已经把关键词：${removed.join('、')} 删掉啦喵！`
          }
          return '未找到指定的关键词'
        }
      }

      // 原有的禁言关键词管理逻辑
      if (options.l) {
        const keywords = groupConfigs[session.guildId].keywords
        return `当前群禁言关键词：\n${keywords.join('、') || '无'}`
      }

      if (options.a) {
        const newKeywords = options.a.split(',').map(k => k.trim()).filter(k => k)
        groupConfigs[session.guildId].keywords.push(...newKeywords)
        saveData(groupConfigPath, groupConfigs)
        return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
      }

      if (options.r) {
        const removeKeywords = options.r.split(',').map(k => k.trim()).filter(k => k)
        const removed = []
        for (const keyword of removeKeywords) {
          const index = groupConfigs[session.guildId].keywords.indexOf(keyword)
          if (index > -1) {
            groupConfigs[session.guildId].keywords.splice(index, 1)
            removed.push(keyword)
          }
        }
        if (removed.length > 0) {
          saveData(groupConfigPath, groupConfigs)
          return `已经把关键词：${removed.join('、')} 删掉啦喵！`
        }
        return '未找到指定的关键词'
      }

      return '请使用：\n-a 添加关键词\n-r 移除关键词\n-l 列出关键词\n添加 -p 参数管理入群审核关键词\n多个关键词用英文逗号分隔'
    })

  // 添加欢迎语管理命令
  ctx.command('welcome', '入群欢迎语管理', { authority: 3 })
    .option('s', '-s <消息> 设置欢迎语')
    .option('r', '-r 移除欢迎语')
    .option('t', '-t 测试当前欢迎语')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

      const groupConfigs = readData(groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || { 
        keywords: [], 
        approvalKeywords: [],
        welcomeMsg: ''
      }

      if (options.s) {
        groupConfigs[session.guildId].welcomeMsg = options.s
        saveData(groupConfigPath, groupConfigs)
        return `已经设置好欢迎语啦喵，要不要用 -t 试试看效果呀？`
      }

      if (options.r) {
        delete groupConfigs[session.guildId].welcomeMsg
        saveData(groupConfigPath, groupConfigs)
        return `欢迎语已经被我吃掉啦喵~`
      }

      if (options.t) {
        const msg = groupConfigs[session.guildId].welcomeMsg || ctx.config.defaultWelcome
        if (!msg) return '未设置欢迎语'
        
        const testMsg = msg
          .replace(/{at}/g, `<at id="${session.userId}"/>`)
          .replace(/{user}/g, session.userId)
          .replace(/{group}/g, session.guildId)
        return testMsg
      }

      const currentMsg = groupConfigs[session.guildId].welcomeMsg
      return `当前欢迎语：${currentMsg || '未设置'}\n\n可用变量：
{at} - @新成员
{user} - 新成员QQ号
{group} - 群号

使用方法：
welcome -s <欢迎语>  设置欢迎语
welcome -r  移除欢迎语
welcome -t  测试当前欢迎语`
    })

  // 修改消息监听器
  ctx.middleware(async (session, next) => {
    if (!ctx.config.keywordBan.enabled || !session.content || !session.guildId) return next()

    const content = session.content
    const groupConfigs = readData(groupConfigPath)
    const groupConfig = groupConfigs[session.guildId] || { keywords: [] }
    const keywords = [...ctx.config.keywordBan.keywords, ...groupConfig.keywords]

    for (const keyword of keywords) {
      try {
        const regex = new RegExp(keyword)
        if (regex.test(content)) {
          const duration = ctx.config.keywordBan.duration
          try {
            const milliseconds = parseTimeString(duration)
            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            // 添加禁言记录
            recordMute(session.guildId, session.userId, milliseconds)
            await session.send(`喵呜！发现了关键词"${keyword}"，要被禁言 ${duration} 啦...`)
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
          break
        }
      } catch (e) {
        if (content.includes(keyword)) {
          const duration = ctx.config.keywordBan.duration
          try {
            const milliseconds = parseTimeString(duration)
            await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
            // 添加禁言记录
            recordMute(session.guildId, session.userId, milliseconds)
            await session.send(`喵呜！发现了关键词"${keyword}"，要被禁言 ${duration} 啦...`)
          } catch (e) {
            await session.send('自动禁言失败了...可能是权限不够喵')
          }
          break
        }
      }
    }

    return next()
  })

  // 添加退群监控
  ctx.on('guild-member-removed', async (session) => {
    const { guildId, userId } = session
    
    const mutes = readData(mutesPath)
    if (mutes[guildId]?.[userId]) {
      const muteRecord = mutes[guildId][userId]
      const elapsedTime = Date.now() - muteRecord.startTime
      
      if (elapsedTime < muteRecord.duration) {
        muteRecord.remainingTime = muteRecord.duration - elapsedTime
        muteRecord.leftGroup = true
        saveData(mutesPath, mutes)
      } else {
        // 如果禁言已经结束，删除记录
        delete mutes[guildId][userId]
        saveData(mutesPath, mutes)
      }
    }
  })

  // banme 命令
  ctx.command('banme [times:number]', '随机禁言自己', { authority: 1 })
    .action(async ({ session }, times = 1) => {
      if (!ctx.config.banme.enabled) {
        logCommand(session, 'banme', session.userId, 'Failed: Feature disabled')
        return '喵呜...banme功能现在被禁用了呢...'
      }
      
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'
      
      try {
        // 读取并更新调用记录
        const records = readData(banMeRecordsPath)
        const now = Date.now()
        
        // 初始化群记录
        if (!records[session.guildId]) {
          records[session.guildId] = {
            count: 0,
            lastResetTime: now,
            pity: 0,
            guaranteed: false
          }
        }
        
        // 检查是否需要重置计数（1小时）
        if (now - records[session.guildId].lastResetTime > 3600000) {
          records[session.guildId].count = 0
          records[session.guildId].lastResetTime = now
          // 不重置保底计数和大保底状态
        }
        
        // 更新计数
        records[session.guildId].count++
        
        // 抽奖机制
        let isJackpot = false // 是否中奖
        let isGuaranteed = false // 是否触发保底
        
        // 增加保底计数
        records[session.guildId].pity++
        
        // 基础概率 0.6%
        const baseProb = 0.006
        // 73抽开始提升概率，89抽保底
        const softPity = 73
        const hardPity = 89
        
        // 计算当前概率
        let currentProb = baseProb
        if (records[session.guildId].pity >= softPity) {
          // 73抽后每抽增加6%
          currentProb = baseProb + (records[session.guildId].pity - softPity + 1) * 0.06
        }
        
        // 检查是否中奖
        if (records[session.guildId].pity >= hardPity || Math.random() < currentProb) {
          isJackpot = true
          isGuaranteed = records[session.guildId].pity >= hardPity
          
          // 重置保底计数
          records[session.guildId].pity = 0
          
          // 检查是否大保底
          if (records[session.guildId].guaranteed) {
            // 大保底必中UP
            records[session.guildId].guaranteed = false
          } else {
            // 50/50机制
            if (Math.random() < 0.5) {
              // 歪了，下次必中
              records[session.guildId].guaranteed = true
            }
          }
        }
        
        saveData(banMeRecordsPath, records)
        
        // 计算禁言时长
        let milliseconds
        if (isJackpot && ctx.config.banme.jackpot.enabled) {
          if (records[session.guildId].guaranteed) {
            milliseconds = parseTimeString(ctx.config.banme.jackpot.loseDuration)
          } else {
            milliseconds = parseTimeString(ctx.config.banme.jackpot.upDuration)
          }
        } else {
          const baseMaxMillis = ctx.config.banme.baseMax * 60 * 1000
          const baseMinMillis = ctx.config.banme.baseMin * 1000
          const additionalMinutes = Math.floor(Math.pow(records[session.guildId].count - 1, 1/3) * ctx.config.banme.growthRate)
          const maxMilliseconds = baseMaxMillis + (additionalMinutes * 60 * 1000)
          milliseconds = Math.floor(Math.random() * (maxMilliseconds - baseMinMillis + 1)) + baseMinMillis
        }
        
        // 计算金卡概率
        currentProb = ctx.config.banme.jackpot.baseProb
        if (records[session.guildId].pity >= ctx.config.banme.jackpot.softPity) {
          currentProb = ctx.config.banme.jackpot.baseProb + 
            (records[session.guildId].pity - ctx.config.banme.jackpot.softPity + 1) * 0.06
        }
        
        await session.bot.muteGuildMember(session.guildId, session.userId, milliseconds)
          
        // 记录禁言
        recordMute(session.guildId, session.userId, milliseconds)
        
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
        
        logCommand(session, 'banme', session.userId, 
          `Success: ${timeStr} (Jackpot: ${isJackpot}, Pity: ${records[session.guildId].pity}, Count: ${records[session.guildId].count})`)
        return message
      } catch (e) {
        logCommand(session, 'banme', session.userId, `Failed: ${e.message}`)
        return `喵呜...禁言失败了：${e.message}`
      }
    })

  // unban-allppl命令
  ctx.command('unban-allppl', '解除所有人禁言', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.guildId) return '喵呜...这个命令只能在群里用喵~'
      
      try {
        // 读取当前禁言记录
        const mutes = readData(mutesPath)
        const currentMutes = mutes[session.guildId] || {}
        
        // 解除所有人的禁言
        let count = 0
        for (const userId in currentMutes) {
          if (!currentMutes[userId].leftGroup) {
            try {
              await session.bot.muteGuildMember(session.guildId, userId, 0)
              delete currentMutes[userId]
              count++
            } catch (e) {
              // 忽略单个用户解除失败的情况，继续处理其他用户
              console.error(`解除用户 ${userId} 禁言失败:`, e)
            }
          }
        }
        
        // 保存更新后的记录
        mutes[session.guildId] = currentMutes
        saveData(mutesPath, mutes)
        
        return count > 0 ? `已解除 ${count} 人的禁言啦！` : '当前没有被禁言的成员喵~'
      } catch (e) {
        return `出错啦喵...${e}`
      }
    })

  // remoteban命令
  ctx.command('remoteban <userId:string> <groupId:string> <duration:string>', '远程禁言用户', { authority: 3 })
    .action(async ({ session }, userId, groupId, duration) => {
      if (!userId || !groupId || !duration) {
        return '格式：remoteban QQ号 群号 时间'
      }
      
      try {
        const milliseconds = parseTimeString(duration)
        await session.bot.muteGuildMember(groupId, userId, milliseconds)
        
        // 记录禁言
        recordMute(groupId, userId, milliseconds)
        
        const timeStr = formatDuration(milliseconds)
        return `已在群 ${groupId} 禁言用户 ${userId} ${duration} (${timeStr}) 喵~`
      } catch (e) {
        return `出错啦喵...${e.message}`
      }
    })
  }

// 添加时间格式化函数
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const parts = []
  if (days > 0) parts.push(`${days}天`)
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`)
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`)
  if (seconds % 60 > 0) parts.push(`${seconds % 60}秒`)

  return parts.join('')
}

