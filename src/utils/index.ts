import * as fs from 'fs'
import * as path from 'path'
import { Context } from 'koishi'


export const MIN_DURATION = 1000
export const MAX_DURATION = 29 * 24 * 3600 * 1000 + 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000

const BEIJING_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

/**
 * 格式化为北京时间 `YYYY-MM-DD HH:mm`。
 *
 * 不要用 `setHours(getHours() + 8)` + `toISOString()`：那是在本地时间上再加 8 小时，
 * 只有服务器恰好运行在 UTC 时才正确；在本就是 UTC+8 的机器上会整整快 8 小时。
 */
export function formatBeijingTime(date: Date = new Date()): string {
  const parts = BEIJING_TIME_FORMAT.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'y', 'on'])
const FALSY_VALUES = new Set(['false', '0', 'no', 'n', 'off'])

/**
 * 解析命令里的布尔开关值。
 *
 * 各模块此前各写一份判断，接受的字面量集合已开始不一致。
 *
 * @returns true / false，无法识别时返回 null（调用方据此提示格式错误，
 *          而不是把无法识别的输入静默当成 false）
 */
export function parseBoolOption(value: unknown): boolean | null {
  const text = String(value ?? '').trim().toLowerCase()
  if (TRUTHY_VALUES.has(text)) return true
  if (FALSY_VALUES.has(text)) return false
  return null
}

/** 关键词以此前缀开头时才按正则处理，其余一律字面量匹配 */
export const REGEX_KEYWORD_PREFIX = 're:'

/** 显式正则关键词的长度上限，压缩灾难性回溯模式的构造空间 */
const MAX_REGEX_KEYWORD_LENGTH = 200

/** 编译缓存上限，超出后整体清空（关键词由管理员配置，正常规模远低于此） */
const REGEX_CACHE_LIMIT = 500

const regexKeywordCache = new Map<string, RegExp | null>()

/**
 * 把关键词编译成正则。
 *
 * 只有以 `re:` 开头的关键词才当正则处理；返回 null 表示调用方应走字面量匹配。
 * 编译失败或超长的模式同样返回 null，避免把非法输入升级成异常。
 */
function compileKeyword(keyword: string): RegExp | null {
  const cached = regexKeywordCache.get(keyword)
  if (cached !== undefined) return cached

  let regex: RegExp | null = null
  if (keyword.startsWith(REGEX_KEYWORD_PREFIX)) {
    const pattern = keyword.slice(REGEX_KEYWORD_PREFIX.length)
    if (pattern && pattern.length <= MAX_REGEX_KEYWORD_LENGTH) {
      try {
        regex = new RegExp(pattern, 'i')
      } catch {
        regex = null
      }
    }
  }

  if (regexKeywordCache.size >= REGEX_CACHE_LIMIT) regexKeywordCache.clear()
  regexKeywordCache.set(keyword, regex)
  return regex
}

/**
 * 校验一条关键词是否可用，返回错误原因（null 表示合法）。
 * 供添加关键词的命令在写入前调用，把非法正则挡在配置之外。
 */
export function validateKeyword(keyword: string): string | null {
  if (!keyword) return '关键词不能为空'
  if (!keyword.startsWith(REGEX_KEYWORD_PREFIX)) return null

  const pattern = keyword.slice(REGEX_KEYWORD_PREFIX.length)
  if (!pattern) return `${REGEX_KEYWORD_PREFIX} 后面需要跟正则表达式`
  if (pattern.length > MAX_REGEX_KEYWORD_LENGTH) {
    return `正则关键词过长（上限 ${MAX_REGEX_KEYWORD_LENGTH} 字符）`
  }
  try {
    new RegExp(pattern, 'i')
  } catch (e) {
    return `正则表达式无效：${e instanceof Error ? e.message : String(e)}`
  }
  return null
}

/**
 * 判断内容是否命中关键词。
 *
 * 默认按字面量、大小写不敏感匹配；只有显式以 `re:` 开头的关键词才当正则用。
 * 这一区分是必要的：关键词由管理员自由输入并对每条消息求值，
 * 若一律当正则，一条 `(a+)+$` 就足以让任意成员用一串 a 触发灾难性回溯、
 * 阻塞事件循环拖垮整个机器人；且 `.` 这类模式会误伤全部消息。
 */
export function matchesKeyword(content: string, keyword: string): boolean {
  if (!content || !keyword) return false

  const regex = compileKeyword(keyword)
  if (regex) return regex.test(content)

  const literal = keyword.startsWith(REGEX_KEYWORD_PREFIX)
    ? keyword.slice(REGEX_KEYWORD_PREFIX.length)
    : keyword
  if (!literal) return false
  return content.toLowerCase().includes(literal.toLowerCase())
}

/**
 * 读取数据文件
 * @param filePath 文件路径
 * @returns 解析后的JSON数据
 */
export function readData(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * 保存数据到文件
 * @param filePath 文件路径
 * @param data 要保存的数据
 */
export function saveData(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

/**
 * 从各种形式中解析出用户 ID。
 *
 * 需要同时覆盖三种来源，此前三个模块各写一份、各只处理其中一部分：
 *   - Koishi `user:user` 参数传入的 `platform:id`
 *   - 消息里的 `<at id="123"/>` 元素
 *   - 用户手输的 `@123` 或裸 `123`
 *
 * @returns 解析出的纯 ID，无法解析时返回 null
 */
export function parseUserId(user: string | any): string | null {
  if (!user) return null
  const raw = String(user).trim()
  if (!raw) return null

  const atMatch = raw.match(/<at[^>]*id="([^"]+)"/)
  if (atMatch) return atMatch[1]

  // platform:id —— 取最后一段，兼容 id 本身不含冒号的所有平台
  const colonIndex = raw.lastIndexOf(':')
  if (colonIndex >= 0) {
    const id = raw.slice(colonIndex + 1).trim()
    if (id) return id
  }

  return raw.replace(/^@/, '').trim() || null
}

/**
 * 解析表达式
 * @param expr 表达式字符串
 * @returns 计算结果
 */
export function evaluateExpression(expr: string): number {


  expr = expr.replace(/\s/g, '')


  if (!/^[\d+\-*/()^.esqrtx]+$/.test(expr)) {
    throw new Error(`表达式包含非法字符: ${expr}`)
  }


  const openBrackets = (expr.match(/\(/g) || []).length
  const closeBrackets = (expr.match(/\)/g) || []).length
  if (openBrackets !== closeBrackets) {
    throw new Error('表达式括号不匹配')
  }


  expr = expr.replace(/x/g, '*')


  expr = expr.replace(/(\d+)e(\d+)/g, (_, base, exp) =>
    String(Number(base) * Math.pow(10, Number(exp))))

  while (expr.includes('sqrt')) {
    expr = expr.replace(/sqrt\(([^()]+)\)/g, (_, num) =>
      String(Math.sqrt(calculateBasic(num))))
  }

  return calculateBasic(expr)
}

/**
 * 基础计算函数
 * @param expr 表达式字符串
 * @returns 计算结果
 */
export function calculateBasic(expr: string): number {

  let loopCount = 0;
  const MAX_LOOPS = 999;


  expr = expr.replace(/\+-+/g, (match) => {
    return match.length % 2 === 0 ? '+' : '-';
  });

  expr = expr.replace(/--+/g, (match) => {
    return match.length % 2 === 0 ? '+' : '-';
  });

  while (expr.includes('(')) {
    if (++loopCount > MAX_LOOPS) {
      throw new Error('表达式过于复杂，计算超时')
    }

    expr = expr.replace(/\(([^()]+)\)/g, (_, subExpr) =>
      String(calculateBasic(subExpr)))
  }


  loopCount = 0;
  while (expr.includes('^')) {
    if (++loopCount > MAX_LOOPS) {
      throw new Error('表达式过于复杂，计算超时')
    }

    expr = expr.replace(/(-?\d+\.?\d*)\^(-?\d+\.?\d*)/, (_, base, exp) =>
      String(Math.pow(Number(base), Number(exp))))
  }


  loopCount = 0;
  while (/[*/]/.test(expr)) {
    if (++loopCount > MAX_LOOPS) {
      throw new Error('表达式过于复杂，计算超时')
    }

    expr = expr.replace(/(-?\d+\.?\d*)[*/](-?\d+\.?\d*)/, (match, a, b) => {
      if (match.includes('*')) return String(Number(a) * Number(b))
      return String(Number(a) / Number(b))
    })
  }


  if (/^-?\d+\.?\d*$/.test(expr)) {
    return Number(expr);
  }



  const parts = [];
  let currentNumber = '';
  let currentIsNegative = false;


  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    const nextChar = expr[i + 1];

    if (i === 0 && char === '-') {
      currentIsNegative = true;
    } else if (char === '+' || char === '-') {
      if (char === '-' && i > 0 && (expr[i-1] === '+' || expr[i-1] === '-' || expr[i-1] === '*' || expr[i-1] === '/' || expr[i-1] === '^')) {
        currentIsNegative = true;
        continue;
      }
      if (char === '+' && nextChar === '-') {
        if (currentNumber !== '' || currentIsNegative) {
          parts.push(currentIsNegative ? -Number(currentNumber || '0') : Number(currentNumber || '0'));
        }
        parts.push(char);
        currentNumber = '';
        currentIsNegative = true;
        i++;
        continue;
      }

      parts.push(currentIsNegative ? -Number(currentNumber || '0') : Number(currentNumber || '0'));
      parts.push(char);
      currentNumber = '';
      currentIsNegative = false;
    } else if (/[\d.]/.test(char)) {
      currentNumber += char;
    } else {
      throw new Error(`表达式包含非法字符: ${char}`);
    }
  }


  if (currentNumber !== '') {
    parts.push(currentIsNegative ? -Number(currentNumber) : Number(currentNumber));
  }


  let result = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const operator = parts[i];
    const operand = parts[i + 1];

    if (operator === '+') {
      result += operand;
    } else if (operator === '-') {
      result -= operand;
    }
  }

  return result;
}

/**
 * 解析时间字符串
 * @param timeStr 时间字符串，如 "10min", "1h30m", "2days6hours"
 * @returns 毫秒数
 */
export function parseTimeString(timeStr: string): number {
  try {
    if (!timeStr) {
      throw new Error('未提供时间')
    }



    const combinedPattern = /(\d+\.?\d*)(d(?:ays?)?|h(?:ours?)?|m(?:ins?)?|s(?:econds?)?)/gi
    let combinedMatches = [...timeStr.matchAll(combinedPattern)]


    if (combinedMatches.length > 1) {
      let totalMilliseconds = 0

      for (const match of combinedMatches) {
        const value = parseFloat(match[1])
        const unitStr = match[2].toLowerCase()
        const unit = unitStr.charAt(0)


        switch (unit) {
          case 'd':
            totalMilliseconds += value * 24 * 3600 * 1000
            break
          case 'h':
            totalMilliseconds += value * 3600 * 1000
            break
          case 'm':
            totalMilliseconds += value * 60 * 1000
            break
          case 's':
            totalMilliseconds += value * 1000
            break
        }
      }


      if (totalMilliseconds < MIN_DURATION) {
        return MIN_DURATION
      }
      if (totalMilliseconds > MAX_DURATION) {
        return MAX_DURATION
      }

      return totalMilliseconds
    }




    const match = timeStr.match(/^(.+?)(d(?:ays?)?|h(?:ours?)?|m(?:ins?)?|s(?:econds?)?)$/i)
    if (!match) {
      throw new Error(`时间格式错误：${timeStr}`)
    }

    const [, expr, unitStr] = match
    let value: number


    const simpleNumber = parseFloat(expr)
    if (!isNaN(simpleNumber) && expr === simpleNumber.toString()) {
      value = simpleNumber
    } else {

      try {
        value = evaluateExpression(expr)
      } catch (error) {
        throw new Error(`表达式解析失败: ${(<Error>error).message}`)
      }
    }


    const unit = unitStr.toLowerCase().charAt(0)


    let milliseconds: number
    switch (unit) {
      case 'd':
        milliseconds = value * 24 * 3600 * 1000
        break
      case 'h':
        milliseconds = value * 3600 * 1000
        break
      case 'm':
        milliseconds = value * 60 * 1000
        break
      case 's':
        milliseconds = value * 1000
        break
      default:
        throw new Error('未知时间单位')
    }


    if (milliseconds < MIN_DURATION) {
      return MIN_DURATION
    }
    if (milliseconds > MAX_DURATION) {
      return MAX_DURATION
    }

    return milliseconds
  } catch (e) {
    throw new Error(`时间解析错误: ${(<Error>e).message}`)
  }
}

/**
 * 格式化持续时间
 * @param milliseconds 毫秒数
 * @returns 格式化的时间字符串
 */
export function formatDuration(milliseconds: number): string {
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

/**
 * 睡眠函数
 * @param ms 毫秒数
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
