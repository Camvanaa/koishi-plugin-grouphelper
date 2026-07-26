/**
 * 实时聊天、图片代理与消息广播 API
 */
import { Context, h } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'
import * as crypto from 'crypto'

export function registerChatAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 聊天功能 API =====

  /** 获取群成员列表 */
  addListener('grouphelper/chat/guild-members' as any, async (params: { guildId: string }) => {
    try {
      const { guildId } = params
      ctx.logger('grouphelper').debug('getGuildMembers called:', guildId)
      if (!guildId) return error('缺少 guildId 参数')

      for (const bot of ctx.bots) {
        ctx.logger('grouphelper').debug('Trying bot:', bot.platform, bot.selfId)
        try {
          // 使用 getGuildMemberList 获取成员列表
          const members: any[] = []
          let next: string | undefined

          do {
            const result = await bot.getGuildMemberList(guildId, next)
            if (result.data) {
              members.push(...result.data)
            }
            next = result.next
          } while (next)

          // 格式化成员数据
          const formattedMembers = members.map(member => {
            const userId = member.user?.id || member.userId
            let avatar = member.user?.avatar || member.avatar
            
            // OneBot/QQ 头像回退
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }

            return {
              id: userId,
              name: member.nick || member.user?.nick || member.user?.name || userId,
              avatar,
              isAdmin: member.roles?.includes('admin') || false,
              isOwner: member.roles?.includes('owner') || false,
              title: member.title || '',
              joinedAt: member.joinedAt
            }
          })

          // 排序：群主 > 管理员 > 普通成员，同级别按名称排序
          formattedMembers.sort((a, b) => {
            if (a.isOwner && !b.isOwner) return -1
            if (!a.isOwner && b.isOwner) return 1
            if (a.isAdmin && !b.isAdmin) return -1
            if (!a.isAdmin && b.isAdmin) return 1
            return (a.name || '').localeCompare(b.name || '')
          })

          return success({
            members: formattedMembers,
            total: formattedMembers.length
          })
        } catch (e) {
          ctx.logger('grouphelper').warn('获取群成员列表失败:', e)
        }
      }
      return error('无法获取群成员列表')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取群成员列表失败')
    }
  })

  /** 获取群信息 */
  addListener('grouphelper/chat/guild-info' as any, async (params: { guildId: string }) => {
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

  /** 获取用户信息 */
  addListener('grouphelper/chat/user-info' as any, async (params: { userId: string }) => {
    try {
      const { userId } = params
      if (!userId) return error('缺少 userId 参数')

      for (const bot of ctx.bots) {
        try {
          const user = await bot.getUser(userId)
          if (user) {
            let avatar = user.avatar
            // OneBot/QQ 个人头像回退
            if (!avatar && (bot.platform === 'onebot' || bot.platform === 'red' || bot.platform === 'qq')) {
              avatar = `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`
            }
            return success({ name: user.name || user.nick || userId, avatar })
          }
        } catch {}
      }
      return error('无法获取用户信息')
    } catch (e) {
      return error(e instanceof Error ? e.message : '获取用户信息失败')
    }
  })

  /** 发送消息 */
  addListener('grouphelper/chat/send' as any, async (params: { channelId: string, content: string, platform?: string, guildId?: string }) => {
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

  /** 撤回消息 */
  addListener('grouphelper/chat/recall' as any, async (params: { channelId: string, messageId: string, platform?: string }) => {
    try {
      const { channelId, messageId, platform } = params
      if (!channelId || !messageId) return error('缺少必要参数')

      const bot = ctx.bots.find(b => !platform || b.platform === platform)
      if (!bot) return error('未找到可用的 Bot')

      await bot.deleteMessage(channelId, messageId)
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('撤回消息失败:', e)
      return error(e instanceof Error ? e.message : '撤回失败')
    }
  })

  /** 图片代理 - 使用 get_image API 获取图片 */
  addListener('grouphelper/image/fetch' as any, async (params: { url: string, file?: string }) => {
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

  // 将 Koishi elements 序列化为字符串（保留 quote、at、image 等）
  const serializeElements = (elements: any[]): string => {
    if (!elements || !Array.isArray(elements)) return ''
    
    return elements.map(el => {
      if (!el) return ''
      
      // 文本节点
      if (el.type === 'text') {
        return el.attrs?.content || ''
      }
      
      // 引用消息
      if (el.type === 'quote') {
        const id = el.attrs?.id || ''
        // 如果有子元素，也序列化
        if (el.children && el.children.length > 0) {
          const childContent = serializeElements(el.children)
          return `<quote id="${id}">${childContent}</quote>`
        }
        return `<quote id="${id}" />`
      }
      
      // @某人
      if (el.type === 'at') {
        const id = el.attrs?.id || ''
        const name = el.attrs?.name || ''
        if (name) {
          return `<at id="${id}" name="${name}" />`
        }
        return `<at id="${id}" />`
      }
      
      // 图片
      if (el.type === 'img' || el.type === 'image') {
        const src = el.attrs?.src || el.attrs?.url || ''
        const file = el.attrs?.file || ''
        if (file) {
          return `<img src="${src}" file="${file}" />`
        }
        return `<img src="${src}" />`
      }
      
      // 表情
      if (el.type === 'face') {
        const id = el.attrs?.id || ''
        return `<face id="${id}" />`
      }
      
      // 其他元素，尝试保留原始格式
      if (el.type) {
        const attrs = Object.entries(el.attrs || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')
        return attrs ? `<${el.type} ${attrs} />` : `<${el.type} />`
      }
      
      return ''
    }).join('')
  }

  // 已广播消息去重（'send' 事件与协议端上报的 message_sent 可能重复到达）
  const broadcastedIds = new Set<string>()

  /** 当前是否有控制台客户端在线 */
  const hasActiveClients = () => {
    const clients = (ctx.console as any)?.clients
    return !!clients && Object.keys(clients).length > 0
  }

  // 监听并广播消息
  const broadcastMessage = async (session: any, isSelf = false) => {
    // 无人打开控制台时直接返回：下面的富化会对每条群消息调用 getGuild 与
    // 逐个 at 元素的 getGuildMember，对协议端造成持续且完全无用的 API 压力
    if (!hasActiveClients()) return

    ctx.logger('grouphelper').debug('broadcastMessage called:', { isSelf, channelId: session.channelId, userId: session.userId })

    // 消息去重：同一条消息只广播一次（去重键在真正广播前才登记，见下方）
    const dedupKey = session.messageId
      ? `${session.platform}:${session.channelId || ''}:${session.messageId}`
      : null
    if (dedupKey && broadcastedIds.has(dedupKey)) return

    // 获取消息内容
    let content = session.content
    let elements = session.elements
    // 内容是否来自 get_msg 反查（此时已是完整 CQ 码，无需再序列化 elements）
    let recoveredFromApi = false

    // 自己发送的消息（'send' 事件会话内容为空），通过 get_msg API 反查内容
    if (isSelf && session.messageId && !content) {
      const bot = session.bot || ctx.bots.find(b => b.selfId === session.selfId)

      if (bot?.platform === 'onebot' && (bot as any).internal?.getMsg) {
        // 刚发送的消息协议端可能尚未入库，失败时短暂延迟后重试一次
        for (let attempt = 0; attempt < 2 && !content; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 500))
          try {
            const msgInfo = await (bot as any).internal.getMsg(session.messageId)
            if (msgInfo) {
              // 优先使用 raw_message (CQ 码格式)
              if (msgInfo.raw_message) {
                content = msgInfo.raw_message
                elements = h.parse(content)
                recoveredFromApi = true
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
                recoveredFromApi = true
              }
            }
          } catch (e) {
            ctx.logger('grouphelper').debug('get_msg 反查自身消息失败:', e)
          }
        }
      }
    }

    // 处理引用消息：session.quote 存储了被引用的消息信息
    // 需要将其添加到 content 开头
    if (session.quote && session.quote.messageId) {
      const quoteId = session.quote.messageId
      const quoteUser = session.quote.user?.name || session.quote.user?.id || ''
      const quoteContent = session.quote.content || session.quote.elements?.map((el: any) =>
        el.type === 'text' ? (el.attrs?.content || '') : `[${el.type}]`
      ).join('') || ''
      
      // 构造引用元素字符串
      const quoteTag = `<quote id="${quoteId}" user="${quoteUser}" content="${quoteContent.replace(/"/g, '&quot;').substring(0, 100)}" />`
      content = quoteTag + content
    }
    
    // 将 elements 序列化为包含完整信息的字符串（get_msg 反查得到的内容已是完整 CQ 码，跳过）
    // 因为 session.content 可能不包含 quote、at 等元素的完整信息
    if (!recoveredFromApi && elements && Array.isArray(elements) && elements.length > 0) {
      // 检查是否有需要序列化的特殊元素（排除 quote，因为已经处理过了）
      const hasSpecialElements = elements.some(el =>
        el.type === 'at' || el.type === 'img' || el.type === 'image' || el.type === 'face'
      )
      if (hasSpecialElements) {
        const serializedContent = serializeElements(elements)
        // 如果有 quote，保留 quote 前缀
        if (session.quote && session.quote.messageId) {
          const quoteMatch = content.match(/^<quote[^>]*\/>/)
          if (quoteMatch) {
            content = quoteMatch[0] + serializedContent
          }
        } else {
          content = serializedContent
        }
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

    // 自身消息内容反查失败且为空时：不广播也不登记去重键，
    // 让协议端 message_sent 上报（若开启）稍后携带完整内容补全，避免空气泡占位
    if (isSelf && !content) {
      ctx.logger('grouphelper').debug('自身消息内容为空且反查失败，跳过广播:', session.messageId)
      return
    }

    // 广播前登记去重键（成功取得内容后才登记，避免空消息挡住后到的完整上报）
    if (dedupKey) {
      if (broadcastedIds.has(dedupKey)) return
      broadcastedIds.add(dedupKey)
      setTimeout(() => broadcastedIds.delete(dedupKey), 5 * 60 * 1000)
    }

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
  // 注意：协议端（LLOneBot/NapCat 等）开启"上报自身消息"后，Bot 自己发出的消息
  // （含手机 QQ 手动发送）会以 message_sent 上报并转为 message 事件到达这里
  ctx.on('message', (session) => {
    broadcastMessage(session, session.userId === session.selfId)
      .catch(e => ctx.logger('grouphelper').warn('广播消息失败:', e))
  })
  ctx.logger('grouphelper').info('Chat message listener registered')

  // 监听发送消息（通过 bot.sendMessage 发出的消息，会话内容为空需反查）
  // @ts-ignore - send 事件类型定义可能不完整
  ctx.on('send', (session) => {
    broadcastMessage(session, true)
      .catch(e => ctx.logger('grouphelper').warn('广播自身消息失败:', e))
  })
}
