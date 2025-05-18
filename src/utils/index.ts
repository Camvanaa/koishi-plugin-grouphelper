import * as fs from 'fs'
import * as path from 'path'
import { Context } from 'koishi'


export const MIN_DURATION = 1000
export const MAX_DURATION = 29 * 24 * 3600 * 1000 + 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000

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
 * 解析用户ID
 * @param user 用户ID或用户对象
 * @returns 解析后的用户ID
 */
export function parseUserId(user: string | any): string {
  if (!user) return null


  if (typeof user === 'string') {

    return user.replace(/^@/, '').trim()
  }


  return String(user).split(':')[1]
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

  // 处理连续的负号
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
    if (i === 0 && char === '-') {
      currentIsNegative = true;
    } else if (char === '+' || char === '-') {

      if (currentNumber === '' && !currentIsNegative) {
        throw new Error(`表达式格式错误：连续的运算符 ${expr}`);
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
        throw new Error(`表达式解析失败: ${error.message}`)
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
    throw new Error(`时间解析错误: ${e.message}`)
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
 * 执行命令的通用函数
 * @param ctx Koishi上下文
 * @param session 会话对象
 * @param commandName 命令名称
 * @param args 命令参数
 * @param options 命令选项
 * @returns 命令执行结果
 */
export async function executeCommand(
  ctx: Context,
  session: any,
  commandName: string,
  args: string[] = [],
  options: Record<string, any> = {}
) {
  try {
    const command = ctx.$commander.get(commandName, session)
    if (!command) {
      throw new Error(`命令 ${commandName} 不存在`)
    }
    const result = await command.execute({
      session,
      args,
      options
    })
    return result
  } catch (error) {
    console.error(`执行命令 ${commandName} 失败:`, error)
    throw error
  }
}

/**
 * 睡眠函数
 * @param ms 毫秒数
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
