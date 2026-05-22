const fs = require('fs')
const path = require('path')

const inputPath = path.join(__dirname, 'docs', '问卷置顶系统', '终端语料库.md')
const outputPath = path.join(__dirname, 'docs', '问卷置顶系统', '终端语料库_新.md')

const lines = fs.readFileSync(inputPath, 'utf-8').split(/\r?\n/)

const result = []

for (const line of lines) {
  // 1. 跳过系统填充池的标题行和内容行
  if (/^## 池4：系统填充池/.test(line)) continue
  if (/^\[系统\]/.test(line)) continue

  // 2. 前缀替换：【xx员X】 → 【xx】
  let newLine = line
  newLine = newLine.replace(/^\[审核员[A-Z]\]/, '【审核】')
  newLine = newLine.replace(/^\[质检员[A-Z]\]/, '【质检】')
  newLine = newLine.replace(/^\[推送员[A-Z]\]/, '【推送】')

  result.push(newLine)
}

// 写入新文件
fs.writeFileSync(outputPath, result.join('\n'), 'utf-8')

// 统计
const totalOriginal = lines.length
const totalNew = result.length
const removedLines = totalOriginal - totalNew

// 统计各池行数
let shenheCount = 0, zhijianCount = 0, tuisongCount = 0, texCount = 0
for (const line of result) {
  if (/^【审核】/.test(line)) shenheCount++
  if (/^【质检】/.test(line)) zhijianCount++
  if (/^【推送】/.test(line)) tuisongCount++
  if (/^\[(?:加速|新人|深夜|下班前)\]/.test(line)) texCount++
}

console.log(`原始行数: ${totalOriginal}`)
console.log(`新文件行数: ${totalNew}`)
console.log(`移除行数: ${removedLines}`)
console.log('---')
console.log(`审核池语料行数: ${shenheCount}`)
console.log(`质检池语料行数: ${zhijianCount}`)
console.log(`推送池语料行数: ${tuisongCount}`)
console.log(`特殊状态池语料行数: ${texCount}`)
console.log(`合计吐槽行数: ${shenheCount + zhijianCount + tuisongCount + texCount}`)
console.log('---')
console.log(`输出文件: ${outputPath}`)
