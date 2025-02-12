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
  }
}

export const name = 'grouphelper'

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
  defaultWelcome: Schema.string().description('默认欢迎语')
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

// 解析时间字符串函数
function parseTimeString(timeStr: string): number {
  try {
    // 匹配数值表达式和单位
    const match = timeStr.match(/^(.+?)(s|min|h)$/)
    if (!match) throw new Error('时间格式错误')

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

export function apply(ctx: Context) {
  // 数据存储路径
  const dataPath = path.resolve(ctx.baseDir, 'data/grouphelper')
  const warnsPath = path.resolve(dataPath, 'warns.json')
  const blacklistPath = path.resolve(dataPath, 'blacklist.json')
  const groupConfigPath = path.resolve(dataPath, 'group_config.json')  // 新增群配置文件

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

    // 检查关键词
    if (keywords.length > 0 && data.comment) {
      for (const keyword of keywords) {
        if (data.comment.includes(keyword)) {
          await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
          return
        }
      }
    }
    
    // 如果没有关键词或没有匹配到，不处理请求
    return
  })

  // 在群成员加入时处理欢迎语
  ctx.on('guild-member-added', async (session) => {
    const { guildId, userId } = session
    
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
        let seconds = 0
        if (duration.endsWith('h')) {
          seconds = parseInt(duration) * 3600 * 1000
        } else if (duration.endsWith('min')) {
          seconds = parseInt(duration) * 60 * 1000
        } else if (duration.endsWith('s')) {
          seconds = parseInt(duration) * 1000
        }
        
        await session.bot.muteGuildMember(session.guildId, userId, seconds)
        return `已警告用户 ${userId}，当前警告次数：${warns[userId].count}\n已自动禁言 ${duration}`
      }

      return `已警告用户 ${userId}，当前警告次数：${warns[userId].count}`
    })

  // kick命令
  ctx.command('kick <user:user>', '踢出用户', { authority: 3 })
    .option('black', '-b, -black  加入黑名单')
    .action(async ({ session, options }, user) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      
      await session.bot.kickGuildMember(session.guildId, userId)
      
      if (options.black) {
        const blacklist = readData(blacklistPath)
        blacklist[userId] = { timestamp: Date.now() }
        saveData(blacklistPath, blacklist)
        return `已踢出用户 ${userId} 并加入黑名单`
      }
      
      return `已踢出用户 ${userId}`
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
        
        return `=== 入群欢迎 ===
默认欢迎语：${ctx.config.defaultWelcome || '未设置'}
本群欢迎语：${currentWelcome}

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
${formatBlacklist || '无记录'}`
      }

      // 黑名单管理
      if (options.b) {
        const blacklist = readData(blacklistPath)
        if (options.a) {
          blacklist[options.a] = { timestamp: Date.now() }
          saveData(blacklistPath, blacklist)
          return `已将 ${options.a} 加入黑名单`
        }
        if (options.r) {
          delete blacklist[options.r]
          saveData(blacklistPath, blacklist)
          return `已将 ${options.r} 从黑名单移除`
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
      
      let response = `用户 ${userId} 的记录：\n`
      response += `警告次数：${warns[userId]?.count || 0}\n`
      response += `是否在黑名单：${blacklist[userId] ? '是' : '否'}`
      
      return response
    })

  // 添加关键词命令
  ctx.command('addkeyword <keyword>', '添加入群关键词')
    .alias('akw')
    .action(async ({ session }, keyword) => {
      if (!keyword) return '请提供关键词'
      ctx.config.keywords.push(keyword)
      return `已添加关键词：${keyword}`
    })

  // ban命令
  ctx.command('ban <user:user> <duration>', '禁言用户', { authority: 3 })
    .action(async ({ session }, user, duration) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      
      try {
        const milliseconds = parseTimeString(duration)
        const seconds = Math.floor(milliseconds / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)

        let timeStr = ''
        if (hours >= 1) {
          timeStr = `${hours}小时`
          const remainingMinutes = minutes % 60
          if (remainingMinutes > 0) {
            timeStr += `${remainingMinutes}分钟`
          }
        } else if (minutes >= 1) {
          timeStr = `${minutes}分钟`
          const remainingSeconds = seconds % 60
          if (remainingSeconds > 0) {
            timeStr += `${remainingSeconds}秒`
          }
        } else {
          timeStr = `${seconds}秒`
        }

        await session.bot.muteGuildMember(session.guildId, userId, milliseconds)
        return `已禁言用户 ${userId} ${duration} (${timeStr})`
      } catch (e) {
        return e.message
      }
    })

  // unban命令
  ctx.command('unban <user:user>', '解除用户禁言', { authority: 3 })
    .action(async ({ session }, user) => {
      if (!user) return '请指定用户'
      const userId = String(user).split(':')[1]
      
      await session.bot.muteGuildMember(session.guildId, userId, 0)
      return `已解除 ${userId} 的禁言`
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
        return `警告次数（${warnCount}）未达到自动禁言标准`
      }
      
      // 转换时间并执行禁言
      let seconds = 0
      if (duration.endsWith('h')) {
        seconds = parseInt(duration) * 3600 * 1000
      } else if (duration.endsWith('min')) {
        seconds = parseInt(duration) * 60 * 1000
      } else if (duration.endsWith('s')) {
        seconds = parseInt(duration) * 1000
      }
      
      await session.bot.muteGuildMember(session.guildId, userId, seconds)
      return `已自动禁言用户 ${userId} ${duration}`
    })

  // grouphelper命令
  ctx.command('grouphelper', '群管理帮助', { authority: 3 })
    .action(async ({ session }) => {
      return `=== 关键词管理 ===
groupkw  群关键词管理：
  -l  列出本群关键词
  -a <关键词>  添加本群关键词
  -r <关键词>  移除本群关键词
  -p  管理入群审核关键词（需配合上述参数使用）

=== 基础命令 ===
kick {@用户} [-b]  踢出用户，-b 表示加入黑名单
ban {@用户} {时长}  禁言用户，支持表达式
unban {@用户}  解除用户禁言
ban-all  开启全体禁言
unban-all  解除全体禁言
delmsg (回复)  撤回指定消息

=== 警告系统 ===
warn {@用户} [次数]  警告用户，默认1次
check {@用户}  查询用户记录
autoban {@用户}  根据警告次数自动禁言

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
  · 加减乘除：+, -, *, /
  · 幂运算：^
  · 开方：sqrt()
  · 科学计数：1e2
· 表达式示例：
  · (sqrt(100)+1e1)^2s = 400秒 = 6分40秒
  · sqrt(100)min = 10分钟
  · (1+2)^3s = 27秒
  · 1e2s = 100秒
· 时间范围：1秒 ~ 29天23小时59分59秒`
    })

  // delmsg命令
  ctx.command('delmsg', '撤回消息', { authority: 3 })
    .action(async ({ session }) => {
      if (!session.quote) return '请回复要撤回的消息'
      
      try {
        await session.bot.deleteMessage(session.channelId, session.quote.id)
        return '已撤回消息'
      } catch (e) {
        return '撤回失败，可能没有权限或消息已过期'
      }
    })

  // ban-all命令
  ctx.command('ban-all', '全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, true)
        return '已开启全体禁言'
      } catch (e) {
        return `全体禁言失败，可能没有权限:
`+e
      }
    })

  // unban-all命令
  ctx.command('unban-all', '解除全体禁言', { authority: 3 })
    .action(async ({ session }) => {
      try {
        await session.bot.internal.setGroupWholeBan(session.guildId, false)
        return '已解除全体禁言'
      } catch (e) {
        return `解除全体禁言失败，可能没有权限:
`+e
      }
    })

  // 添加群关键词管理命令
  ctx.command('groupkw', '群关键词管理', { authority: 3 })
    .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
    .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
    .option('l', '-l 列出关键词')
    .option('p', '-p 管理入群审核关键词')
    .action(async ({ session, options }) => {
      if (!session.guildId) return '此命令只能在群内使用'

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
          return `已添加群入群审核关键词：${newKeywords.join('、')}`
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
            return `已移除群入群审核关键词：${removed.join('、')}`
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
        return `已添加群禁言关键词：${newKeywords.join('、')}`
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
          return `已移除群禁言关键词：${removed.join('、')}`
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
      if (!session.guildId) return '此命令只能在群内使用'

      const groupConfigs = readData(groupConfigPath)
      groupConfigs[session.guildId] = groupConfigs[session.guildId] || { 
        keywords: [], 
        approvalKeywords: [],
        welcomeMsg: ''
      }

      if (options.s) {
        groupConfigs[session.guildId].welcomeMsg = options.s
        saveData(groupConfigPath, groupConfigs)
        return '已设置欢迎语，可用 -t 测试效果'
      }

      if (options.r) {
        delete groupConfigs[session.guildId].welcomeMsg
        saveData(groupConfigPath, groupConfigs)
        return '已移除群欢迎语'
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
    const keywords = [...ctx.config.keywordBan.keywords, ...groupConfig.keywords]  // 合并全局和群专属关键词

    // 检查消息是否包含关键词
    for (const keyword of keywords) {
      try {
        // 尝试将关键词作为正则表达式处理
        const regex = new RegExp(keyword)
        if (regex.test(content)) {
          // 计算禁言时长
          const duration = ctx.config.keywordBan.duration
          let seconds = 0
          if (duration.endsWith('h')) {
            seconds = parseInt(duration) * 3600 * 1000
          } else if (duration.endsWith('min')) {
            seconds = parseInt(duration) * 60 * 1000
          } else if (duration.endsWith('s')) {
            seconds = parseInt(duration) * 1000
          }

          try {
            await session.bot.muteGuildMember(session.guildId, session.userId, seconds)
            await session.send(`检测到关键词"${keyword}"，已自动禁言 ${duration}`)
          } catch (e) {
            await session.send('自动禁言失败，可能没有权限')
          }
          break
        }
      } catch (e) {
        // 如果正则表达式无效，则使用普通字符串匹配
        if (content.includes(keyword)) {
          const duration = ctx.config.keywordBan.duration
          let seconds = 0
          if (duration.endsWith('h')) {
            seconds = parseInt(duration) * 3600 * 1000
          } else if (duration.endsWith('min')) {
            seconds = parseInt(duration) * 60 * 1000
          } else if (duration.endsWith('s')) {
            seconds = parseInt(duration) * 1000
          }

          try {
            await session.bot.muteGuildMember(session.guildId, session.userId, seconds)
            await session.send(`检测到关键词"${keyword}"，已自动禁言 ${duration}`)
          } catch (e) {
            await session.send('自动禁言失败，可能没有权限')
          }
          break
        }
      }
    }

    return next()
  })
}
