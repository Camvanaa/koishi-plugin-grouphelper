/**
 * WebSocket API 模块
 * 提供 WebUI 前端所需的实时数据接口
 */

import { Context, h } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { Subscription } from '../../types'
import * as crypto from 'crypto'

/** API 响应格式 */
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/** 失败响应 */
function error(message: string): ApiResponse {
  return { success: false, error: message }
}

/**
 * 注册所有 WebSocket API
 */
export function registerWebSocketAPI(ctx: Context, service: GroupHelperService) {
  // 确保 console 服务存在
  if (!ctx.console) {
    ctx.logger('grouphelper').warn('console 服务未启用，WebSocket API 跳过注册')
    return
  }

  const data = service.data

  // ===== 群组配置 API =====
  
  /** 获取所有群组配置 */
  ctx.console.addListener('grouphelper/config/list', async (params?: { fetchNames?: boolean }) => {
    const allConfigs = data.groupConfig.getAll()
    const results: Record<string, any> = {}

    // 并行获取群组名称
    await Promise.all(Object.entries(allConfigs).map(async ([guildId, config]) => {
      let guildName = ''
      if (params?.fetchNames) {
        for (const bot of ctx.bots) {
          try {
            const guild = await bot.getGuild(guildId)
            if (guild?.name) {
              guildName = guild.name
              break
            }
          } catch {
            continue
          }
        }
      }
      results[guildId] = { ...config, guildName }
    }))

    return success(results)
  })

  /** 获取单个群组配置 */
  ctx.console.addListener('grouphelper/config/get', async (params: { guildId: string }) => {
    return success(data.groupConfig.get(params.guildId))
  })

  /** 更新群组配置 */
  ctx.console.addListener('grouphelper/config/update', async (params: { guildId: string, config: any }) => {
    data.groupConfig.set(params.guildId, params.config)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 创建群组配置 */
  ctx.console.addListener('grouphelper/config/create', async (params: { guildId: string }) => {
    if (data.groupConfig.get(params.guildId)) {
      return error('配置已存在')
    }
    // 创建默认配置
    const defaultConfig = {
      welcomeEnabled: false,
      antiRecall: { enabled: false },
      antiRepeat: { enabled: false, threshold: 3 },
      forbidden: { autoDelete: false, autoBan: false, autoKick: false, muteDuration: 600000 },
      dice: { enabled: true, lengthLimit: 1000 },
      banme: {
        enabled: true, baseMin: 1, baseMax: 30, growthRate: 30,
        jackpot: { enabled: true, baseProb: 0.006, softPity: 73, hardPity: 89, upDuration: '24h', loseDuration: '12h' }
      },
      openai: { enabled: true }
    }
    data.groupConfig.set(params.guildId, defaultConfig)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 删除群组配置 */
  ctx.console.addListener('grouphelper/config/delete', async (params: { guildId: string }) => {
    data.groupConfig.delete(params.guildId)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  // ===== 警告记录 API =====

  /** 获取所有警告记录 (Enriched) */
  ctx.console.addListener('grouphelper/warns/list', async (params?: { fetchNames?: boolean }) => {
    const rawWarns = data.warns.getAll()
    const result = []

    for (const [key, record] of Object.entries(rawWarns)) {
      // key format: guildId:userId
      const parts = key.split(':')
      const guildId = parts[0]
      const userId = parts[1] || 'Unknown'
      const groupData = record.groups?.[guildId]

      if (guildId && groupData) {
        let guildName = ''
        let userName = ''

        // Try to fetch names if requested
        if (params?.fetchNames) {
          for (const bot of ctx.bots) {
            try {
              if (!guildName) {
                const guild = await bot.getGuild(guildId)
                if (guild?.name) guildName = guild.name
              }
              if (!userName) {
                const member = await bot.getGuildMember(guildId, userId)
                if (member?.user?.name || member?.nick) userName = member.nick || member.user.name
              }
              if (guildName && userName) break
            } catch {
              continue
            }
          }
        }

        result.push({
          key,
          guildId,
          userId,
          guildName: guildName || 'Unknown',
          userName: userName || 'Unknown',
          count: groupData.count,
          timestamp: groupData.timestamp
        })
      }
    }

    return success(result)
  })

  /** 更新警告次数 */
  ctx.console.addListener('grouphelper/warns/update', async (params: { key: string, count: number }) => {
    const record = data.warns.get(params.key)
    if (record) {
      const parts = params.key.split(':')
      const guildId = parts[0]
      if (record.groups[guildId]) {
        if (params.count <= 0) {
          // Count <= 0 means clear
          delete record.groups[guildId]
          if (Object.keys(record.groups).length === 0) {
            data.warns.delete(params.key)
          } else {
            data.warns.set(params.key, record)
          }
        } else {
          record.groups[guildId].count = params.count
          data.warns.set(params.key, record)
        }
        await data.warns.flush()
        return success({ success: true })
      }
    }
    return error('Record not found')
  })

  /** 添加警告 */
  ctx.console.addListener('grouphelper/warns/add', async (params: { guildId: string, userId: string }) => {
    const key = `${params.guildId}:${params.userId}`
    let record = data.warns.get(key)
    
    if (!record) {
      record = { groups: {} }
    }
    
    if (!record.groups[params.guildId]) {
      record.groups[params.guildId] = { count: 0, timestamp: 0 }
    }
    
    record.groups[params.guildId].count++
    record.groups[params.guildId].timestamp = Date.now()
    
    data.warns.set(key, record)
    await data.warns.flush()
    return success({ success: true })
  })

  /** 获取用户警告记录 */
  ctx.console.addListener('grouphelper/warns/get', async (params: { key: string }) => {
    return success(data.warns.get(params.key))
  })

  /** 清除用户警告 */
  ctx.console.addListener('grouphelper/warns/clear', async (params: { key: string }) => {
    data.warns.delete(params.key)
    await data.warns.flush()
    return success({ success: true })
  })

  // ===== 黑名单 API =====

  /** 获取黑名单 */
  ctx.console.addListener('grouphelper/blacklist/list', async () => {
    return success(data.blacklist.getAll())
  })

  /** 添加黑名单 */
  ctx.console.addListener('grouphelper/blacklist/add', async (params: { userId: string, record: any }) => {
    data.blacklist.set(params.userId, params.record)
    await data.blacklist.flush()
    return success({ success: true })
  })

  /** 移除黑名单 */
  ctx.console.addListener('grouphelper/blacklist/remove', async (params: { userId: string }) => {
    data.blacklist.delete(params.userId)
    await data.blacklist.flush()
    return success({ success: true })
  })

  // ===== 订阅 API =====

  /** 获取订阅列表 */
  ctx.console.addListener('grouphelper/subscriptions/list', async (params?: { fetchNames?: boolean }) => {
    const subsData = data.subscriptions.get('list') || []
    
    if (params?.fetchNames) {
      const enrichedList = await Promise.all(subsData.map(async (sub) => {
        let name = ''
        if (sub.type === 'group') {
          for (const bot of ctx.bots) {
            try {
              const guild = await bot.getGuild(sub.id)
              if (guild?.name) {
                name = guild.name
                break
              }
            } catch {}
          }
        } else if (sub.type === 'private') {
          for (const bot of ctx.bots) {
            try {
              const user = await bot.getUser(sub.id)
              if (user?.name || user?.nick) {
                name = user.nick || user.name
                break
              }
            } catch {}
          }
        }
        return { ...sub, name }
      }))
      return success(enrichedList)
    }

    return success(subsData)
  })

  /** 添加订阅 */
  ctx.console.addListener('grouphelper/subscriptions/add', async (params: { subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    list.push(params.subscription)
    data.subscriptions.set('list', list)
    await data.subscriptions.flush()
    return success({ success: true })
  })

  /** 移除订阅 */
  ctx.console.addListener('grouphelper/subscriptions/remove', async (params: { index: number }) => {
    const list = data.subscriptions.get('list') || []
    if (params.index >= 0 && params.index < list.length) {
      list.splice(params.index, 1)
      data.subscriptions.set('list', list)
      await data.subscriptions.flush()
    }
    return success({ success: true })
  })

  /** 更新订阅 */
  ctx.console.addListener('grouphelper/subscriptions/update', async (params: { index: number, subscription: Subscription }) => {
    const list = data.subscriptions.get('list') || []
    if (params.index >= 0 && params.index < list.length) {
      list[params.index] = params.subscription
      data.subscriptions.set('list', list)
      await data.subscriptions.flush()
    }
    return success({ success: true })
  })

  // ===== 统计 API =====

  /** 获取仪表盘统计 */
  ctx.console.addListener('grouphelper/stats/dashboard', async () => {
    const allWarns = data.warns.getAll()
    const allBlacklist = data.blacklist.getAll()
    const allConfigs = data.groupConfig.getAll()
    const subsList = data.subscriptions.get('list') || []

    return success({
      totalGroups: Object.keys(allConfigs).length,
      totalWarns: Object.keys(allWarns).length,
      totalBlacklisted: Object.keys(allBlacklist).length,
      totalSubscriptions: subsList.length,
      timestamp: Date.now()
    })
  })

  // ===== 日志检索 API =====

  ctx.console.addListener('grouphelper/logs/search', async (params: {
    startTime?: string | number
    endTime?: string | number
    command?: string
    userId?: string
    username?: string
    details?: string
    guildId?: string
    page?: number
    pageSize?: number
  }) => {
    const logModule = service.getAllModules().find(m => m.meta.name === 'log') as any
    if (!logModule) return error('Log module not found')

    // 获取所有日志进行检索
    let logs = await logModule.getAllLogs()
    
    // 过滤
    logs = logs.filter((log: any) => {
      const time = new Date(log.timestamp).getTime()
      if (params.startTime && time < new Date(params.startTime).getTime()) return false
      if (params.endTime && time > new Date(params.endTime).getTime()) return false
      if (params.command && !log.command.toLowerCase().includes(params.command.toLowerCase())) return false
      if (params.userId && log.userId !== params.userId) return false
      if (params.username && (!log.username || !log.username.toLowerCase().includes(params.username.toLowerCase()))) return false
      if (params.details) {
        const keyword = params.details.toLowerCase()
        const matchResult = log.result?.toLowerCase().includes(keyword)
        const matchError = log.error?.toLowerCase().includes(keyword)
        const matchArgs = log.args?.some((arg: string) => arg.toLowerCase().includes(keyword))
        const matchOptions = JSON.stringify(log.options || {}).toLowerCase().includes(keyword)
        
        if (!matchResult && !matchError && !matchArgs && !matchOptions) return false
      }
      if (params.guildId && log.guildId !== params.guildId) return false
      return true
    })

    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const total = logs.length
    const list = logs.slice((page - 1) * pageSize, page * pageSize)

    return success({ list, total, page, pageSize })
  })

  // ===== 设置 API =====

  /** 获取插件设置 */
  ctx.console.addListener('grouphelper/settings/get', async () => {
    // 获取当前设置
    return success(service.settings.settings)
  })

  /** 更新插件设置 */
  ctx.console.addListener('grouphelper/settings/update', async (params: { settings: any }) => {
    try {
      const { settings } = params
      
      // 检查 settings 是否有效
      if (!settings || typeof settings !== 'object') {
        return error('无效的设置数据')
      }
      
      // 更新设置
      await service.settings.update(settings)
      
      ctx.logger('grouphelper').info('设置已更新')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('更新设置失败:', e)
      return error(e instanceof Error ? e.message : '更新设置失败')
    }
  })

  /** 重置插件设置 */
  ctx.console.addListener('grouphelper/settings/reset', async () => {
    try {
      await service.settings.reset()
      ctx.logger('grouphelper').info('设置已重置为默认值')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('重置设置失败:', e)
      return error(e instanceof Error ? e.message : '重置设置失败')
    }
  })

  // ===== 聊天功能 API =====

  /** 获取群信息 */
  ctx.console.addListener('grouphelper/chat/guild-info' as any, async (params: { guildId: string }) => {
    try {
      const { guildId } = params
      if (!guildId) return error('缺少 guildId 参数')

      for (const bot of ctx.bots) {
        try {
          const guild = await bot.getGuild(guildId)
          if (guild) {
            let avatar = guild.avatar
            // OneBot/QQ 群头像回退
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`
            }
            return success({ name: guild.name, avatar })
          }
        } catch {}
      }
      return error('无法获取群信息')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取群信息失败')
    }
  })

  /** 发送消息 */
  ctx.console.addListener('grouphelper/chat/send' as any, async (params: { channelId: string, content: string, platform?: string, guildId?: string }) => {
    try {
      const { channelId, content, platform, guildId } = params
      if (!channelId || !content) return error('缺少必要参数')

      // 寻找合适的 bot
      const bot = ctx.bots.find(b => !platform || b.platform === platform)
      if (!bot) return error('未找到可用的 Bot')

      await bot.sendMessage(channelId, content, guildId)
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('发送消息失败:', e)
      return error(e instanceof Error ? e.message : '发送失败')
    }
  })

  /** 图片代理 - 使用 get_image API 获取图片 */
  ctx.console.addListener('grouphelper/image/fetch' as any, async (params: { url: string, file?: string }) => {
    try {
      const { url, file } = params
      if (!url) return error('缺少 URL 参数')

      // 尝试从 URL 中提取文件名（如果没有提供 file 参数）
      let fileToUse = file
      
      if (!fileToUse) {
        try {
          const urlObj = new URL(url)
          const urlPath = urlObj.pathname
          const pathParts = urlPath.split('/')
          const lastPart = pathParts[pathParts.length - 1]
          if (lastPart && (lastPart.includes('.') || /^[A-F0-9]{32}$/i.test(lastPart))) {
            fileToUse = lastPart
          }
        } catch {}
      }

      // 使用 OneBot get_image API 获取图片
      for (const bot of ctx.bots) {
        if (bot.platform === 'onebot' && (bot as any).internal?.getImage) {
          try {
            const fileParam = fileToUse || url
            const result = await (bot as any).internal.getImage(fileParam)
            
            // 优先使用返回的 base64
            if (result?.base64) {
              let mimeType = 'image/png'
              const fileName = result.file_name || result.file || ''
              if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg'
              else if (fileName.endsWith('.gif')) mimeType = 'image/gif'
              else if (fileName.endsWith('.webp')) mimeType = 'image/webp'
              
              const dataUrl = `data:${mimeType};base64,${result.base64}`
              const hash = crypto.createHash('md5').update(url).digest('hex')
              return success({ dataUrl, hash, mimeType, source: 'local-base64' })
            }
            
            // 其次使用返回的新 url
            if (result?.url && result.url !== url) {
              const newResponse = await fetch(result.url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': ''
                }
              })
              if (newResponse.ok) {
                const buffer = await newResponse.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                const contentType = newResponse.headers.get('content-type') || 'image/jpeg'
                const dataUrl = `data:${contentType};base64,${base64}`
                const hash = crypto.createHash('md5').update(url).digest('hex')
                return success({ dataUrl, hash, mimeType: contentType, source: 'local-url' })
              }
            }
            
            // 最后尝试读取本地文件
            if (result?.file) {
              try {
                const fs = await import('fs/promises')
                const localBuffer = await fs.readFile(result.file)
                const base64 = localBuffer.toString('base64')
                
                let mimeType = 'image/png'
                if (result.file.endsWith('.jpg') || result.file.endsWith('.jpeg')) mimeType = 'image/jpeg'
                else if (result.file.endsWith('.gif')) mimeType = 'image/gif'
                else if (result.file.endsWith('.webp')) mimeType = 'image/webp'
                
                const dataUrl = `data:${mimeType};base64,${base64}`
                const hash = crypto.createHash('md5').update(url).digest('hex')
                return success({ dataUrl, hash, mimeType, source: 'local-file' })
              } catch {}
            }
          } catch {}
        }
      }
      
      return error('无法获取图片')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取图片失败')
    }
  })

  // 缓存 bot 登录信息，避免重复请求
  const botLoginInfoCache = new Map<string, { userId: string; nickname: string }>()

  // 获取 bot 登录信息（使用 get_login_info API）
  const getBotLoginInfo = async (bot: any): Promise<{ userId: string; nickname: string } | null> => {
    const cacheKey = `${bot.platform}:${bot.selfId}`
    if (botLoginInfoCache.has(cacheKey)) {
      return botLoginInfoCache.get(cacheKey)!
    }
    
    // 尝试使用 OneBot get_login_info API
    if (bot.platform === 'onebot' && bot.internal?.getLoginInfo) {
      try {
        const info = await bot.internal.getLoginInfo()
        if (info?.user_id && info?.nickname) {
          const result = { userId: String(info.user_id), nickname: info.nickname }
          botLoginInfoCache.set(cacheKey, result)
          return result
        }
      } catch {}
    }
    
    // 回退到 bot.user
    if (bot.user?.name || bot.user?.id) {
      const result = { userId: bot.selfId, nickname: bot.user.name || bot.selfId }
      botLoginInfoCache.set(cacheKey, result)
      return result
    }
    
    return null
  }

  // 监听并广播消息
  const broadcastMessage = async (session: any, isSelf = false) => {
    // 获取消息内容
    let content = session.content
    let elements = session.elements
    
    // 如果是自己发送的消息，通过 get_msg API 获取内容
    if (isSelf && session.messageId) {
      const bot = session.bot || ctx.bots.find(b => b.selfId === session.selfId)
      
      if (bot?.platform === 'onebot' && (bot as any).internal?.getMsg) {
        try {
          const msgInfo = await (bot as any).internal.getMsg(session.messageId)
          if (msgInfo) {
            // 优先使用 raw_message (CQ 码格式)
            if (msgInfo.raw_message) {
              content = msgInfo.raw_message
              elements = h.parse(content)
            } else if (Array.isArray(msgInfo.message)) {
              // 数组格式消息段
              elements = msgInfo.message.map((seg: any) => ({
                type: seg.type,
                attrs: seg.data || {}
              }))
              content = elements.map((el: any) => {
                if (el.type === 'text') return el.attrs?.text || el.attrs?.content || ''
                return `[${el.type}]`
              }).join('')
            }
          }
        } catch {}
      }
    }
    
    
    // 尝试获取更多信息
    let guildAvatar = session.event?.guild?.avatar
    
    // 如果没有群头像但有群ID，尝试获取
    if (!guildAvatar && session.guildId) {
      const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
      if (bot) {
        try {
          const guild = await bot.getGuild(session.guildId)
          if (guild?.avatar) guildAvatar = guild.avatar
        } catch {}
      }
    }

    // OneBot/QQ 协议特有头像处理
    if (session.platform === 'onebot' || session.platform === 'red' || session.platform === 'qq') {
      if (!guildAvatar && session.guildId) {
        guildAvatar = `https://p.qlogo.cn/gh/${session.guildId}/${session.guildId}/640/`
      }
    }

    // 使用已获取的 elements 或解析 content
    const finalElements = elements || session.elements || (content ? h.parse(content) : [])

    // 如果是自己发送的消息，补充作者信息
    let username = session.author?.name || session.author?.nick || session.userId
    let avatar = session.author?.avatar

    if (isSelf) {
      // 尝试从 bot 登录信息获取准确的昵称
      const bot = session.bot || ctx.bots.find(b => b.selfId === session.selfId)
      if (bot) {
        const loginInfo = await getBotLoginInfo(bot)
        if (loginInfo) {
          username = loginInfo.nickname
        } else {
          username = bot.user?.name || username || '我'
        }
        avatar = bot.user?.avatar || avatar
      }
    }

    // OneBot/QQ 个人头像回退
    if (!avatar && (session.platform === 'onebot' || session.platform === 'red' || session.platform === 'qq')) {
      const targetId = isSelf ? session.selfId : session.userId
      if (targetId) {
        avatar = `https://q1.qlogo.cn/g?b=qq&nk=${targetId}&s=640`
      }
    }

    // 尝试获取群名称 (如果缺失)
    let guildName = (session as any).guildName || (session.event?.guild?.name)
    if (!guildName && session.guildId) {
       const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
       if (bot) {
         try {
           const guild = await bot.getGuild(session.guildId)
           if (guild?.name) guildName = guild.name
         } catch {}
       }
    }

    // 尝试解析 elements 中的 at 标签，补充名称
    const enrichedElements = await Promise.all(finalElements.map(async (el: any) => {
      if (el.type === 'at' && el.attrs?.id) {
         if (!el.attrs.name) {
             // 尝试获取被 at 用户的昵称
             const bot = session.bot || ctx.bots.find(b => b.platform === session.platform)
             if (bot && session.guildId) {
               try {
                 const member = await bot.getGuildMember(session.guildId, el.attrs.id)
                 if (member?.nick || member?.user?.name) {
                   el.attrs.name = member.nick || member.user.name
                 }
               } catch {}
             }
         }
      }
      return el
    }))

    ctx.console.broadcast('grouphelper/chat/message', {
      id: session.messageId || session.id || Date.now().toString(),
      timestamp: session.timestamp || Date.now(),
      userId: session.userId || session.selfId,
      username,
      avatar,
      content: content || session.content,
      elements: enrichedElements, // 传递处理后的元素
      platform: session.platform,
      guildId: session.guildId,
      guildName,
      guildAvatar, // 传递群头像
      channelId: session.channelId,
      channelName: (session as any).channelName || (session.event?.channel?.name),
      selfId: session.selfId,
    })
  }

  // 监听收到消息
  ctx.on('message', (session) => {
    broadcastMessage(session)
  })

  // 监听发送消息
  // @ts-ignore - send 事件类型定义可能不完整
  ctx.on('send', (session) => {
    broadcastMessage(session, true)
  })
}