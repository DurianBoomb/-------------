const fs = require('fs')
const dir = __dirname + '/上传到服务器/'

// 问卷status分布
const sRaw = fs.readFileSync(dir + '02_问卷_1-50.json', 'utf8')
const statusMap = {}
sRaw.split('\n').filter(l => l.trim()).forEach(l => {
  const o = JSON.parse(l)
  const s = o.status || 'undefined'
  statusMap[s] = (statusMap[s] || 0) + 1
})
console.log('问卷status分布:')
Object.entries(statusMap).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

// 标签status分布
const tRaw = fs.readFileSync(dir + '01_标签全部.json', 'utf8')
const tags = JSON.parse(tRaw)
const tMap = {}
tags.forEach(t => {
  const s = t.status || 'undefined'
  tMap[s] = (tMap[s] || 0) + 1
})
console.log('\n标签status分布:')
Object.entries(tMap).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

// 标签第一条的字段
console.log('\n标签第一条字段:', Object.keys(tags[0]))
console.log('标签第一条:', JSON.stringify(tags[0]).substring(0, 200))
