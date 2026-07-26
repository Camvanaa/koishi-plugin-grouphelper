/**
 * 校验 SFC 中模板用到的类名是否都能在自身 <style scoped> 里找到定义。
 *
 * Vue 的 scoped 样式不会作用到子组件内部，因此把一段标记抽成子组件时，
 * 对应的样式规则必须一并搬过去——漏掉的话构建不会报错，只有打开页面才看得出来。
 * 这个脚本把这类遗漏变成可自动检查的项。
 *
 * 用法：node scripts/check-scoped-css.mjs client/components/xxx.vue [...]
 * 退出码非 0 表示存在模板用到但本文件未定义的类名。
 */
import { readFileSync } from 'fs'

/** 这些类名由 Koishi 控制台或第三方组件提供，不需要本文件定义 */
const EXTERNAL_PREFIXES = ['el-', 'k-', 'gh-']
const EXTERNAL_EXACT = new Set(['spin', 'active', 'collapsed', 'self', 'error', 'loading', 'danger', 'primary', 'secondary'])

function extractBlock(source, tagRe) {
  const m = source.match(tagRe)
  return m ? m[1] : ''
}

function classesInTemplate(tpl) {
  const found = new Set()

  // 静态 class="a b c"
  for (const m of tpl.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && !c.includes('{') && !c.includes('$')) found.add(c)
    }
  }
  // 动态 :class="{ a: x, 'b-c': y }" 与 :class="['a', ...]"
  for (const m of tpl.matchAll(/\s:class="([^"]*)"/g)) {
    for (const c of m[1].matchAll(/['"]([\w-]+)['"]\s*:/g)) found.add(c[1])
    for (const c of m[1].matchAll(/(^|[{,\s])([a-zA-Z][\w-]*)\s*:/g)) found.add(c[2])
    for (const c of m[1].matchAll(/['"]([\w-]+)['"]/g)) found.add(c[1])
  }
  return found
}

function classesInStyle(style) {
  const found = new Set()
  for (const m of style.matchAll(/\.([a-zA-Z][\w-]*)/g)) found.add(m[1])
  return found
}

let failed = false

for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf-8')
  const tpl = extractBlock(src, /<template>([\s\S]*)<\/template>/)
  const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')

  const used = classesInTemplate(tpl)
  const defined = classesInStyle(styles)

  const missing = [...used].filter(c =>
    !defined.has(c) &&
    !EXTERNAL_EXACT.has(c) &&
    !EXTERNAL_PREFIXES.some(p => c.startsWith(p))
  )

  if (missing.length) {
    failed = true
    console.log(`\n${file}`)
    console.log(`  模板使用但本文件未定义样式的类名 (${missing.length}):`)
    for (const c of missing.sort()) console.log(`    .${c}`)
  } else {
    console.log(`${file}  OK（模板类名均有对应样式）`)
  }
}

process.exit(failed ? 1 : 0)
