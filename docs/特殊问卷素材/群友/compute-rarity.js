const fs = require('fs')
const path = require('path')

const profiles = [
  { name: '显眼包',           profile: [98, 55, 75, 95, 90, 85, 25] },
  { name: '群中头牌',         profile: [99, 60, 70, 99, 85, 85, 65] },
  { name: '社交天花板',       profile: [97, 5,  45, 95, 45, 80, 75] },
  { name: '气氛组组长',       profile: [95, 5,  50, 98, 10, 85, 95] },
  { name: '快乐源泉',         profile: [90, 5,  45, 90, 10, 75, 80] },
  { name: '抬杠运动员',       profile: [85, 98, 15, 85, 5,  80, 5]  },
  { name: '毒舌评委',         profile: [80, 97, 25, 70, 40, 55, 15] },
  { name: '反矫情战士',       profile: [70, 95, 10, 65, 5,  50, 30] },
  { name: '阴阳怪气大师',     profile: [75, 85, 60, 55, 10, 55, 15] },
  { name: '吐槽区UP主',       profile: [85, 65, 50, 80, 15, 60, 45] },
  { name: '搞钱急先锋',       profile: [50, 50, 10, 55, 55, 30, 20] },
  { name: '屎学家',           profile: [75, 20, 98, 70, 5,  55, 10] },
  { name: '搬屎专员',         profile: [80, 15, 97, 25, 5,  55, 5]  },
  { name: '谣言搬运工',       profile: [45, 10, 95, 15, 5,  45, 5]  },
  { name: '神秘学大师',       profile: [20, 5,  90, 20, 5,  25, 20] },
  { name: '干饭总指挥官',     profile: [55, 10, 5,  70, 10, 40, 75] },
  { name: '新闻播报员',       profile: [65, 5,  3,  15, 5,  55, 85] },
  { name: '养生复读机',       profile: [65, 10, 5,  20, 5,  80, 75] },
  { name: '鸡汤批发商',       profile: [50, 3,  5,  15, 5,  50, 70] },
  { name: '凡尔赛主编',       profile: [80, 15, 10, 75, 95, 55, 40] },
  { name: '画饼大师',         profile: [75, 10, 65, 80, 95, 50, 15] },
  { name: '潜水冠军',         profile: [3,  5,  5,  3,  3,  15, 5]  },
  { name: '群幽灵',           profile: [1,  3,  3,  1,  1,  5,  1]  },
  { name: '已读不回专业户',   profile: [5,  10, 5,  5,  5,  53, 5]  },
  { name: '特困生',           profile: [15, 5,  5,  5,  5,  10, 10] },
  { name: '熬夜守群人',       profile: [25, 5,  10, 5,  5,  98, 55] },
  { name: '摸鱼办主任',       profile: [40, 10, 40, 15, 5,  85, 15] },
  { name: '观察者',           profile: [15, 15, 55, 5,  5,  75, 45] },
]

const POSSIBLE_VALUES = [0, 16.666666666666668, 33.333333333333336, 50, 66.66666666666667, 83.33333333333333, 100]

function euclideanDist(a, b) {
  let sumSq = 0
  for (let i = 0; i < a.length; i++) sumSq += Math.pow(a[i] - b[i], 2)
  return Math.sqrt(sumSq)
}

const counts = {}
profiles.forEach(p => { counts[p.name] = 0 })
let tieCount = 0
let total = 0

let out = []
out.push('开始穷举 7^7 = 823,543 种组合...\n')

const N = 7
let permCount = 0

for (let i0 = 0; i0 < N; i0++) {
for (let i1 = 0; i1 < N; i1++) {
for (let i2 = 0; i2 < N; i2++) {
for (let i3 = 0; i3 < N; i3++) {
for (let i4 = 0; i4 < N; i4++) {
for (let i5 = 0; i5 < N; i5++) {
for (let i6 = 0; i6 < N; i6++) {

  const raw = [
    POSSIBLE_VALUES[i0], POSSIBLE_VALUES[i1], POSSIBLE_VALUES[i2],
    POSSIBLE_VALUES[i3], POSSIBLE_VALUES[i4], POSSIBLE_VALUES[i5],
    POSSIBLE_VALUES[i6],
  ]

  let minDist = Infinity, winnerIdx = -1, tie = false

  for (let p = 0; p < profiles.length; p++) {
    const d = euclideanDist(raw, profiles[p].profile)
    if (d < minDist) { minDist = d; winnerIdx = p; tie = false }
    else if (d === minDist) { tie = true }
  }

  if (tie) tieCount++
  else counts[profiles[winnerIdx].name]++
  total++

  permCount++
  if (permCount % 100000 === 0) {
    out.push(`  进度: ${permCount} / 823543 (${(permCount / 823543 * 100).toFixed(1)}%)`)
  }

}}}}}}}

out.push(`\n穷举完成。总计 ${total.toLocaleString()} 种组合，平局 ${tieCount.toLocaleString()} 次 (${(tieCount / total * 100).toFixed(2)}%)`)
out.push(`有效唯一匹配: ${(total - tieCount).toLocaleString()} 次\n`)

const totalEffective = total - tieCount
const results = profiles.map(p => ({
  name: p.name, profile: p.profile,
  count: counts[p.name],
  pct: totalEffective > 0 ? (counts[p.name] / totalEffective * 100) : 0,
}))

results.sort((a, b) => b.count - a.count)

function rarityTier(pct) {
  if (pct > 10)    return { tier: '🌟🌟🌟🌟🌟', label: '极常见',    cn: '每~10人就有1人命中' }
  if (pct > 5)     return { tier: '🌟🌟🌟🌟',   label: '常见',      cn: '每~20人就有1人命中' }
  if (pct > 2)     return { tier: '🌟🌟🌟',     label: '普通',      cn: '每~50人就有1人命中' }
  if (pct > 1)     return { tier: '🌟🌟',       label: '稀有',      cn: '每~100人就有1人命中' }
  if (pct > 0.3)   return { tier: '🌟',         label: '非常稀有',  cn: '每~333人就有1人命中' }
  if (pct > 0.1)   return { tier: '💎',         label: '极其稀有',  cn: '每~1000人只有1人' }
  if (pct > 0.03)  return { tier: '💎💎',       label: '传说级',    cn: '每~3333人只有1人' }
  return { tier: '💎💎💎', label: '神话级', cn: '万里挑一' }
}

out.push('='.repeat(100))
out.push('群友成分鉴定 - 理论命中率 & 稀有度表')
out.push('='.repeat(100))

const header = '排名  | 结果类型       | 命中次数     | 命中率   | 概率 1/N    | 稀有度        | 稀有等级       | 描述'
out.push(header)
out.push('-'.repeat(100))

results.forEach((r, idx) => {
  const rarity = rarityTier(r.pct)
  const odds = totalEffective > 0 ? String(Math.round(totalEffective / r.count)) : 'N/A'
  const line =
    String(idx + 1).padEnd(5) + '| ' +
    r.name.padEnd(13) + ' | ' +
    r.count.toLocaleString().padEnd(11) + ' | ' +
    (r.pct.toFixed(3) + '%').padEnd(8) + ' | ' +
    ('1/' + odds).padEnd(11) + ' | ' +
    rarity.tier.padEnd(12) + ' | ' +
    rarity.label.padEnd(12) + ' | ' +
    rarity.cn
  out.push(line)
})

out.push('')
out.push('='.repeat(100))
out.push('稀有度分级标准：')
out.push('  💎💎💎 神话级     < 0.03%')
out.push('  💎💎   传说级     0.03% ~ 0.1%')
out.push('  💎     极其稀有   0.1% ~ 0.3%')
out.push('  🌟     非常稀有   0.3% ~ 1%')
out.push('  🌟🌟   稀有       1% ~ 2%')
out.push('  🌟🌟🌟 普通       2% ~ 5%')
out.push('  🌟🌟🌟🌟 常见     5% ~ 10%')
out.push('  🌟🌟🌟🌟🌟 极常见  > 10%')
out.push('='.repeat(100))

// 写入文件
const outputPath = path.join(__dirname, 'rarity-result.txt')
fs.writeFileSync(outputPath, out.join('\n'), 'utf-8')
console.log('Done! Result written to: ' + outputPath)
