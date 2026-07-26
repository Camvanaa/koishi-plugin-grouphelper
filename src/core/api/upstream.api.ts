/**
 * 上游信息 API —— 公告、版本、更新日志
 *
 * 这些数据原本由前端直接 fetch GitHub 与 npm。改为后端代理有三个理由：
 *   1. 前端 fetch 无超时，raw.githubusercontent.com 在国内常不可达，
 *      请求会一直挂起，界面上的版本号永远停在占位符
 *   2. GitHub 未鉴权接口按 IP 限流 60 次/小时，多个管理员共用出口 IP 时
 *      更新日志会直接 403
 *   3. 每次进入仪表盘都重新发三个跨域请求，且显式禁用了缓存
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success } from './api-utils'

const REPO = 'Camvanaa/koishi-plugin-grouphelper'

/** 上游请求超时，避免不可达时长时间占用连接 */
const UPSTREAM_TIMEOUT = 8000

/** 服务端缓存有效期。上游内容变化很慢，没必要每次打开面板都回源 */
const CACHE_TTL = 10 * 60 * 1000

interface CacheEntry {
  value: unknown
  expireAt: number
}

export function registerUpstreamAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const cache = new Map<string, CacheEntry>()

  /** 带缓存与超时地取一次上游数据；失败返回 null 而不抛出，由前端展示降级文案 */
  const fetchCached = async <T>(key: string, url: string, as: 'json' | 'text'): Promise<T | null> => {
    const hit = cache.get(key)
    if (hit && hit.expireAt > Date.now()) return hit.value as T

    try {
      const value = as === 'json'
        ? await ctx.http.get(url, { timeout: UPSTREAM_TIMEOUT })
        : await ctx.http.get(url, { timeout: UPSTREAM_TIMEOUT, responseType: 'text' })
      cache.set(key, { value, expireAt: Date.now() + CACHE_TTL })
      return value as T
    } catch (e) {
      ctx.logger('grouphelper').debug(`获取上游数据失败 ${key}:`, e)
      // 回源失败时宁可用过期缓存，也好过让界面空着
      return (hit?.value as T) ?? null
    }
  }

  /** 公告（仓库根目录 notice.md） */
  addListener('grouphelper/upstream/notice', async () => {
    const text = await fetchCached<string>(
      'notice',
      `https://raw.githubusercontent.com/${REPO}/dev/notice.md`,
      'text'
    )
    return success({ notice: text ?? '' })
  })

  /** 各渠道版本号；取不到的渠道返回 null，由前端显示为 Fail */
  addListener('grouphelper/upstream/versions', async () => {
    const [main, dev, npm] = await Promise.all([
      fetchCached<any>('main', `https://raw.githubusercontent.com/${REPO}/main/package.json`, 'json'),
      fetchCached<any>('dev', `https://raw.githubusercontent.com/${REPO}/dev/package.json`, 'json'),
      fetchCached<any>('npm', 'https://registry.npmjs.org/koishi-plugin-grouphelper/latest', 'json')
    ])

    return success({
      main: main?.version ?? null,
      dev: dev?.version ?? null,
      npm: npm?.version ?? null
    })
  })

  /** 最近提交 */
  addListener('grouphelper/upstream/commits', async () => {
    const commits = await fetchCached<any[]>(
      'commits',
      `https://api.github.com/repos/${REPO}/commits?sha=dev&per_page=5`,
      'json'
    )
    return success({ commits: Array.isArray(commits) ? commits : [] })
  })
}
