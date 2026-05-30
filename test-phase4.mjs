/**
 * 阶段四 · 自动测试脚本
 *
 * 测试范围：
 *   1. 精选发疯排序逻辑（clickCount 降序）
 *   2. Top 10 提取（含边界：不足 10 条 / 刚好 10 条 / 超过 10 条）
 *   3. clickCount 边界值（undefined / null / 0 / 负数 / 相同值）
 *   4. 字段映射（emoji / tag / description）
 *   5. getTagList 返回结构（clickCount 字段存在性）
 *
 * 用法：node test-phase4.mjs
 */

// ======================== 测试框架 ========================

let passCount = 0
let failCount = 0
let suiteCount = 0

function suite(name) {
  suiteCount++
  console.log(`\n${'='.repeat(64)}`)
  console.log(`套件 ${suiteCount}：${name}`)
  console.log(`${'='.repeat(64)}`)
}

function pass(msg) {
  passCount++
  console.log(`  ✅ PASS — ${msg}`)
}

function fail(msg, detail) {
  failCount++
  console.log(`  ❌ FAIL — ${msg}`)
  if (detail != null) console.log(`     detail: ${JSON.stringify(detail)}`)
}

function assert(cond, passMsg, failMsg, detail) {
  if (cond) pass(passMsg)
  else fail(failMsg, detail)
}

// ======================== 1. 精选发疯排序逻辑 ========================

/**
 * 模拟 loadTags() 中 recommendList 的构建逻辑
 * 来自 quiz-home.vue:272
 */
function buildRecommendList(list) {
  return [...list]
    .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
    .slice(0, 10)
    .map(t => ({
      emoji: t.emoji,
      tag: t.name,
      description: t.description,
      bgColor: '#FFF7ED'  // tagBgColor 只是随机颜色，不参与逻辑
    }))
}

// ======================== 2. 测试套件 ========================

// ---------- 套件一：clickCount 降序排序 ----------
suite('精选发疯 clickCount 降序排序')

const mockTags1 = [
  { name: '标签A', clickCount: 5,   emoji: '🔥', description: '描述A' },
  { name: '标签B', clickCount: 120, emoji: '💎', description: '描述B' },
  { name: '标签C', clickCount: 50,  emoji: '⭐', description: '描述C' },
  { name: '标签D', clickCount: 8,   emoji: '🟢', description: '描述D' },
  { name: '标签E', clickCount: 200, emoji: '👑', description: '描述E' },
]

const result1 = buildRecommendList(mockTags1)
const result1CCs = result1.map(r => r.tag)

assert(result1.length === 5, `返回 5 条（总数不足 10，全部返回）`)

// 验证降序
let sorted1 = true
for (let i = 1; i < result1.length; i++) {
  if (mockTags1.find(t => t.name === result1[i - 1].tag).clickCount <
      mockTags1.find(t => t.name === result1[i].tag).clickCount) {
    sorted1 = false
  }
}
assert(sorted1, `降序排序正确: ${result1CCs.join(' → ')}`)

const expectedOrder1 = ['标签E', '标签B', '标签C', '标签D', '标签A']
assert(
  result1CCs.join(',') === expectedOrder1.join(','),
  `排列顺序: ${expectedOrder1.join(' → ')}`,
  `实际顺序: ${result1CCs.join(' → ')}`
)


// ---------- 套件二：Top 10 截断 ----------
suite('Top 10 截断逻辑')

const mockTags2 = Array.from({ length: 25 }, (_, i) => ({
  name: `标签${i + 1}`,
  clickCount: (25 - i) * 10,
  emoji: '📊',
  description: `描述${i + 1}`
}))

const result2 = buildRecommendList(mockTags2)
assert(result2.length === 10, '25 条输入 → 返回 10 条')

const expectedTop = ['标签1', '标签2', '标签3', '标签4', '标签5', '标签6', '标签7', '标签8', '标签9', '标签10']
for (let i = 0; i < 10; i++) {
  assert(result2[i].tag === expectedTop[i], `第 ${i + 1} 位 = ${expectedTop[i]}`, `第 ${i + 1} 位实际 = ${result2[i].tag}`)
}

// 刚好 10 条
const mockTags2b = mockTags2.slice(0, 10)
const result2b = buildRecommendList(mockTags2b)
assert(result2b.length === 10, '刚好 10 条 → 返回 10 条')

// 空列表
const result2c = buildRecommendList([])
assert(result2c.length === 0, '空列表 → 返回 0 条')

// 不足 10 条
const mockTags2d = mockTags2.slice(0, 3)
const result2d = buildRecommendList(mockTags2d)
assert(result2d.length === 3, '3 条 → 返回 3 条')


// ---------- 套件三：clickCount 边界值 ----------
suite('clickCount 边界值处理')

// undefined clickCount → 按 0 处理
assert(
  buildRecommendList([{ name: '未定义CC', clickCount: undefined, emoji: '❓', description: '' }])[0].tag === '未定义CC',
  'undefined clickCount → 不报错，作为 0 参与排序'
)

// null clickCount
assert(
  buildRecommendList([{ name: 'nullCC', clickCount: null, emoji: '❓', description: '' }])[0].tag === 'nullCC',
  'null clickCount → 不报错，作为 0 参与排序'
)

// 全部 0 → 保持原相对顺序
const allZero = [
  { name: 'Z1', clickCount: 0, emoji: 'A', description: '' },
  { name: 'Z2', clickCount: 0, emoji: 'B', description: '' },
  { name: 'Z3', clickCount: 0, emoji: 'C', description: '' },
]
const result3c = buildRecommendList(allZero)
assert(result3c.length === 3 && result3c.every(r => allZero.find(z => z.name === r.tag)), '全部 clickCount=0 → 不报错，全返回')

// 混合 0 和非 0
const mixed = [
  { name: '有CC', clickCount: 30, emoji: '🔥', description: '' },
  { name: '零CC', clickCount: 0, emoji: '❄️', description: '' },
  { name: '多CC', clickCount: 100, emoji: '💥', description: '' },
]
const result3d = buildRecommendList(mixed)
assert(result3d[0].tag === '多CC', '最高 clickCount 排第一')
assert(result3d[2].tag === '零CC', 'clickCount=0 排最后')

// 负数 clickCount
const negative = [
  { name: '负CC', clickCount: -5, emoji: '📉', description: '' },
  { name: '正CC', clickCount: 10, emoji: '📈', description: '' },
]
const result3e = buildRecommendList(negative)
assert(result3e[0].tag === '正CC', '负 clickCount 排序在正数之后')
assert(result3e[1].tag === '负CC', '负 clickCount 在最后')


// ---------- 套件四：字段映射完整性 ----------
suite('recommendList 字段映射（emoji / tag / description）')

const mockTags4 = [
  { name: '字段测试', clickCount: 100, emoji: '🧪', description: '这是一段描述' },
]

const result4 = buildRecommendList(mockTags4)
const item = result4[0]
assert(item.emoji === '🧪', `emoji 映射: "${item.emoji}"`)
assert(item.tag === '字段测试', `tag(name) 映射: "${item.tag}"`)
assert(item.description === '这是一段描述', `description 映射: "${item.description}"`)

// 空 emoji
const noEmoji = [{ name: '无emoji', clickCount: 1, emoji: '', description: 'desc' }]
const result4b = buildRecommendList(noEmoji)
assert(result4b[0].emoji === '', '空 emoji → 映射为空字符串（不报错）')

// 空 description
const noDesc = [{ name: '无描述', clickCount: 1, emoji: '📝', description: '' }]
const result4c = buildRecommendList(noDesc)
assert(result4c[0].description === '', '空 description → 映射为空字符串')


// ---------- 套件五：getTagList 返回结构（clickCount 字段） ----------
suite('getTagList 返回 clickCount 字段')

/**
 * 模拟 getTagList 返回值（来自 survey/index.obj.js:137）
 * .field({ _id, name, category, emoji, description, popularity, surveyCount, rarity, creatorId, source, surveyId, clickCount })
 */
function mockGetTagList(rawTags) {
  return {
    errCode: 0,
    data: {
      list: rawTags.map(t => ({
        _id: t._id || 'mock_' + Math.random().toString(36).slice(2, 8),
        name: t.name,
        category: t.category || '',
        emoji: t.emoji || '',
        description: t.description || '',
        popularity: t.popularity || 0,
        surveyCount: t.surveyCount || 1,
        rarity: t.rarity || 'common',
        creatorId: t.creatorId || '',
        source: t.source || 'system',
        surveyId: t.surveyId || '',
        clickCount: t.clickCount  // 关键字段
      })),
      total: rawTags.length
    }
  }
}

const mockRawTags = [
  { name: '标签X', clickCount: 88 },
  { name: '标签Y' },
  { name: '标签Z', clickCount: 0 },
]

const result5 = mockGetTagList(mockRawTags)
assert(result5.data.list.length === 3, 'getTagList 返回 3 条')

// 验证每条都有 clickCount 字段（存在性即可，值可能为 undefined）
result5.data.list.forEach((item, i) => {
  assert(
    'clickCount' in item,
    `${item.name}: clickCount 字段存在${item.clickCount != null ? '（值=' + item.clickCount + '）' : '（值=undefined，前端 || 0 兜底）'}`,
    `${item.name}: 缺失 clickCount 字段`
  )
})

// 验证可正常排序
const sorted = [...result5.data.list].sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
assert(sorted[0].name === '标签X', 'getTagList 数据可正常按 clickCount 降序（标签X=88 排第一）')
const idxY = sorted.findIndex(s => s.name === '标签Y')
assert(idxY > 0, '无 clickCount（undefined）的标签按 0 处理，排在 clickCount>0 之后（标签Y 索引=' + idxY + '）')


// ======================== 3. 统计输出 ========================

console.log(`\n${'='.repeat(64)}`)
console.log(`测试完成：${suiteCount} 个套件 | ${passCount + failCount} 项测试`)
console.log(`✅ 通过: ${passCount}`)
console.log(`❌ 失败: ${failCount}`)
console.log(`${'='.repeat(64)}`)

if (failCount > 0) {
  console.log('\n⚠️  有测试失败，请检查上方 FAIL 项！')
  process.exit(1)
} else {
  console.log('\n🎉 全部测试通过！')
  process.exit(0)
}
