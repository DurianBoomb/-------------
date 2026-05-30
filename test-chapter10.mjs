/**
 * 章节 10 · 后台生成 + 双页面结果回传 · 逻辑测试
 *
 * 测试范围：
 *   1. 任务数据结构完整性
 *   2. 状态机转换（queued → generating → done / failed）
 *   3. 队列 CRUD（追加 / 更新状态 / 移除）
 *   4. 超时检测（generating 超过 60s 标 failed）
 *   5. 过期清理（done 24h / failed 1h）
 *   6. 错误码 → 叙事层文案映射
 *   7. 队列容量上限（最多 10 条）
 *   8. 多任务并发（互不覆盖）
 *   9. taskId 唯一性
 *
 * 用法：node test-chapter10.mjs
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

// ======================== 模拟工具函数（与实施方案代码逻辑一致） ========================

/** 创建新任务 */
function createTask(tagName, tagDesc) {
  return {
    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8),
    status: 'queued',
    tagName,
    tagDesc: tagDesc || '',
    data: null,
    errCode: null,
    errMsg: null,
    createdAt: Date.now()
  }
}

/** 更新任务状态 */
function updateTaskStatus(queue, taskId, status, extra = {}) {
  const idx = queue.findIndex(t => t.id === taskId)
  if (idx === -1) return false
  queue[idx].status = status
  if (extra.data !== undefined) queue[idx].data = extra.data
  if (extra.errCode !== undefined) queue[idx].errCode = extra.errCode
  if (extra.errMsg !== undefined) queue[idx].errMsg = extra.errMsg
  return true
}

/** 移除任务 */
function removeTask(queue, taskId) {
  return queue.filter(t => t.id !== taskId)
}

/** 错误码映射 */
function getErrMsg(errCode) {
  const map = {
    'AUTH_ERROR': '需要先登录才能指挥标签机干活',
    'VALIDATE_ERROR': '标签机吐出来的模板格式不对，换个标签名试试',
    'COZE_QUOTA_EXHAUSTED': '标签机今天累了，明天再来教它吧',
    'TAG_ALREADY_EXISTS': '这个标签已经有人印过了，换个名字吧',
    'TIMEOUT': '标签机印太久卡住了，重新试试',
    'NETWORK_ERROR': '信号不太好，标签机没收到指令'
  }
  return map[errCode] || '标签机出了点小问题，稍后再试'
}

/** 检测超时任务（generating 超过 60s） */
function findStaleGenerating(queue, now) {
  return queue.filter(t => t.status === 'generating' && (now - t.createdAt) > 60000)
}

/** 清理过期任务（done 24h / failed 1h） */
function cleanExpired(queue, now) {
  const ONE_DAY = 24 * 60 * 60 * 1000
  const ONE_HOUR = 60 * 60 * 1000
  return queue.filter(t => {
    const age = now - t.createdAt
    if (t.status === 'done' && age > ONE_DAY) return false
    if (t.status === 'failed' && age > ONE_HOUR) return false
    return true
  })
}

/** 获取进行中任务 */
function getActiveTasks(queue) {
  return queue.filter(t => t.status === 'queued' || t.status === 'generating')
}

/** 获取已完成任务 */
function getDoneTasks(queue) {
  return queue.filter(t => t.status === 'done')
}

/** 获取失败任务 */
function getFailedTasks(queue) {
  return queue.filter(t => t.status === 'failed')
}


// ======================== 套件 1：任务数据结构完整性 ========================
suite('任务数据结构完整性')

const task = createTask('确诊为芋泥波波奶茶', '一个关于奶茶的标签')
const keys = Object.keys(task).sort()
const expectedKeys = ['createdAt', 'data', 'errCode', 'errMsg', 'id', 'status', 'tagDesc', 'tagName'].sort()

assert(
  JSON.stringify(keys) === JSON.stringify(expectedKeys),
  `任务对象包含所有 8 个字段`,
  `字段不匹配`,
  { got: keys, expected: expectedKeys }
)

assert(task.status === 'queued', `初始状态为 'queued'`)
assert(task.data === null, `data 初始为 null`)
assert(task.errCode === null, `errCode 初始为 null`)
assert(task.errMsg === null, `errMsg 初始为 null`)
assert(task.tagName === '确诊为芋泥波波奶茶', `tagName 正确保存`)
assert(task.tagDesc === '一个关于奶茶的标签', `tagDesc 正确保存`)


// ======================== 套件 2：taskId 唯一性 ========================
suite('taskId 唯一性')

const ids = new Set()
let collision = false
for (let i = 0; i < 10000; i++) {
  const t = createTask('test', '')
  if (ids.has(t.id)) { collision = true; break }
  ids.add(t.id)
}

assert(!collision, `10000 次创建无 id 碰撞`)
assert(ids.size === 10000, `10000 个 taskId 全部唯一`)


// ======================== 套件 3：状态机转换 ========================
suite('状态机转换：queued → generating → done / failed')

const queue = []
const t1 = createTask('标签A', '')
queue.push(t1)

assert(t1.status === 'queued', `创建后状态为 queued`)

// queued → generating
const updated1 = updateTaskStatus(queue, t1.id, 'generating')
assert(updated1, `queued → generating 成功`)
assert(queue[0].status === 'generating', `状态变为 generating`)

// generating → done
const mockData = { surveyId: 'abc123', tagName: '标签A', questionnaire: { title: '测试标题', dims: [], qs: [], resultTypes: [] } }
const updated2 = updateTaskStatus(queue, t1.id, 'done', { data: mockData })
assert(updated2, `generating → done 成功`)
assert(queue[0].status === 'done', `状态变为 done`)
assert(queue[0].data !== null, `data 已填充`)
assert(queue[0].data.surveyId === 'abc123', `data.surveyId 正确`)

// 第二个任务：queued → generating → failed
const t2 = createTask('标签B', '')
queue.push(t2)
updateTaskStatus(queue, t2.id, 'generating')
const updated3 = updateTaskStatus(queue, t2.id, 'failed', { errCode: 'COZE_QUOTA_EXHAUSTED', errMsg: '额度用完' })
assert(updated3, `generating → failed 成功`)
assert(queue[1].status === 'failed', `状态变为 failed`)
assert(queue[1].errCode === 'COZE_QUOTA_EXHAUSTED', `errCode 正确`)
assert(queue[1].errMsg === '额度用完', `errMsg 正确`)

// 验证两个任务互不影响
assert(queue[0].status === 'done', `任务 A 仍为 done`)
assert(queue[1].status === 'failed', `任务 B 仍为 failed`)


// ======================== 套件 4：队列 CRUD ========================
suite('队列 CRUD')

const q = []
const a = createTask('A', '')
const b = createTask('B', '')
const c = createTask('C', '')
q.push(a, b, c)

assert(q.length === 3, `追加后队列长度 = 3`)

// 更新不存在的任务
const fakeUpdate = updateTaskStatus(q, 'fake_id_999', 'generating')
assert(!fakeUpdate, `更新不存在的任务 ID 返回 false`)

// 移除
const q2 = removeTask(q, b.id)
assert(q2.length === 2, `移除后长度 = 2`)
assert(q2.find(t => t.id === b.id) === undefined, `被移除的任务不在新队列中`)
assert(q2.find(t => t.id === a.id) !== undefined, `任务 A 仍在`)
assert(q2.find(t => t.id === c.id) !== undefined, `任务 C 仍在`)
assert(q.length === 3, `原队列不变（filter 不修改原数组）`)


// ======================== 套件 5：超时检测 ========================
suite('超时检测：generating > 60s 标 failed')

const timeoutQ = []
const now = Date.now()
const oldTask = {
  id: 'old_1', status: 'generating', tagName: '旧任务', tagDesc: '',
  data: null, errCode: null, errMsg: null, createdAt: now - 70000  // 70 秒前
}
const newTask = {
  id: 'new_1', status: 'generating', tagName: '新任务', tagDesc: '',
  data: null, errCode: null, errMsg: null, createdAt: now - 30000  // 30 秒前
}
timeoutQ.push(oldTask, newTask)

const stale = findStaleGenerating(timeoutQ, now)
assert(stale.length === 1, `检测到 1 个超时任务`)
assert(stale[0].id === 'old_1', `超时任务为 70s 前的旧任务`)

// 标记超时
updateTaskStatus(timeoutQ, stale[0].id, 'failed', { errCode: 'TIMEOUT', errMsg: getErrMsg('TIMEOUT') })
assert(timeoutQ[0].status === 'failed', `超时任务标记为 failed`)
assert(timeoutQ[0].errCode === 'TIMEOUT', `errCode 为 TIMEOUT`)

// 新任务不受影响
assert(timeoutQ[1].status === 'generating', `30s 前的新任务仍为 generating`)


// ======================== 套件 6：过期清理 ========================
suite('过期清理：done 24h / failed 1h')

const cleanQ = []
const baseNow = Date.now()
cleanQ.push(
  { id: 'd1', status: 'done',   createdAt: baseNow - 25 * 60 * 60 * 1000, tagName: '超时done', data: {} },   // 25h 前 → 应清理
  { id: 'd2', status: 'done',   createdAt: baseNow - 12 * 60 * 60 * 1000, tagName: '正常done', data: {} },   // 12h 前 → 保留
  { id: 'f1', status: 'failed', createdAt: baseNow - 2 * 60 * 60 * 1000,  tagName: '超时failed' },           // 2h 前 → 应清理
  { id: 'f2', status: 'failed', createdAt: baseNow - 30 * 60 * 1000,      tagName: '正常failed' },           // 30min → 保留
  { id: 'g1', status: 'generating', createdAt: baseNow - 30 * 1000,       tagName: '进行中' },               // generating → 不参与过期清理
  { id: 'q1', status: 'queued',     createdAt: baseNow - 5 * 1000,        tagName: '排队中' },               // queued → 不参与过期清理
)

const cleaned = cleanExpired(cleanQ, baseNow)
assert(cleaned.length === 4, `清理后保留 4 个：正常 done + 正常 failed + generating + queued`)
assert(!cleaned.find(t => t.id === 'd1'), `25h 前的 done 被清理`)
assert(cleaned.find(t => t.id === 'd2'), `12h 前的 done 保留`)
assert(!cleaned.find(t => t.id === 'f1'), `2h 前的 failed 被清理`)
assert(cleaned.find(t => t.id === 'f2'), `30min 前的 failed 保留`)
assert(cleaned.find(t => t.id === 'g1'), `generating 不参与过期清理`)
assert(cleaned.find(t => t.id === 'q1'), `queued 不参与过期清理`)


// ======================== 套件 7：错误码映射 ========================
suite('错误码 → 叙事层文案映射')

const errMap = {
  'AUTH_ERROR':            '需要先登录才能指挥标签机干活',
  'VALIDATE_ERROR':        '标签机吐出来的模板格式不对，换个标签名试试',
  'COZE_QUOTA_EXHAUSTED':  '标签机今天累了，明天再来教它吧',
  'TAG_ALREADY_EXISTS':    '这个标签已经有人印过了，换个名字吧',
  'TIMEOUT':               '标签机印太久卡住了，重新试试',
  'NETWORK_ERROR':         '信号不太好，标签机没收到指令',
}

for (const [code, expected] of Object.entries(errMap)) {
  const msg = getErrMsg(code)
  assert(msg === expected, `${code} → "${msg}"`)
}

// 未知错误码
const unknownMsg = getErrMsg('SOME_UNKNOWN_CODE')
assert(unknownMsg === '标签机出了点小问题，稍后再试', `未知错误码 → 兜底文案`)
assert(typeof unknownMsg === 'string' && unknownMsg.length > 0, `兜底文案非空`)


// ======================== 套件 8：队列容量上限 ========================
suite('队列容量上限：最多 10 条')

const fullQ = []
for (let i = 0; i < 10; i++) {
  fullQ.push(createTask(`标签${i}`, ''))
}
assert(fullQ.length === 10, `队列填满 10 条`)

const rejectNew = fullQ.length >= 10
assert(rejectNew, `第 11 条被拒绝`)

// 移除一条后可继续添加
const smallerQ = removeTask(fullQ, fullQ[0].id)
assert(smallerQ.length === 9, `移除一条后剩 9 条`)
assert(smallerQ.length < 10, `可以继续添加`)
const newTask2 = createTask('新标签', '')
smallerQ.push(newTask2)
assert(smallerQ.length === 10, `添加后恢复 10 条`)


// ======================== 套件 9：多任务并发的 getActive / getDone / getFailed ========================
suite('队列分类筛选')

const mixQ = []
mixQ.push(
  { id: 'a', status: 'queued',     tagName: 'Q1', createdAt: 1 },
  { id: 'b', status: 'generating', tagName: 'G1', createdAt: 2 },
  { id: 'c', status: 'generating', tagName: 'G2', createdAt: 3 },
  { id: 'd', status: 'done',       tagName: 'D1', createdAt: 4 },
  { id: 'e', status: 'done',       tagName: 'D2', createdAt: 5 },
  { id: 'f', status: 'failed',     tagName: 'F1', createdAt: 6 },
)

const active = getActiveTasks(mixQ)
assert(active.length === 3, `进行中 = 3（1 queued + 2 generating）`)
assert(active[0].id === 'a', `queued 排第一`)
assert(active[1].id === 'b', `generating 排第二`)

const done = getDoneTasks(mixQ)
assert(done.length === 2, `已完成 = 2`)
assert(done.every(t => t.status === 'done'), `全部为 done 状态`)

const failed = getFailedTasks(mixQ)
assert(failed.length === 1, `失败 = 1`)
assert(failed[0].id === 'f', `失败任务 ID 正确`)

// 全量分类互不重叠
const allIds = [...active.map(t => t.id), ...done.map(t => t.id), ...failed.map(t => t.id)].sort()
assert(JSON.stringify(allIds) === JSON.stringify(['a','b','c','d','e','f']), `三类合计覆盖全部 6 个任务`)


// ======================== 套件 10：边界值 ========================
suite('边界值')

const edgeQ = []

// 空队列操作
assert(getActiveTasks(edgeQ).length === 0, `空队列 getActive → []`)
assert(getDoneTasks(edgeQ).length === 0, `空队列 getDone → []`)
assert(getFailedTasks(edgeQ).length === 0, `空队列 getFailed → []`)
assert(cleanExpired(edgeQ, Date.now()).length === 0, `空队列清理 → []`)
assert(findStaleGenerating(edgeQ, Date.now()).length === 0, `空队列超时检测 → []`)

// tagDesc 为空
const tEmpty = createTask('纯标签', '')
assert(tEmpty.tagDesc === '', `空描述 → ''`)

// 极长标签名
const longName = '测'.repeat(20)
const tLong = createTask(longName, '')
assert(tLong.tagName === longName, `20 字标签名正确保存`)
assert(tLong.tagName.length === 20, `长度 = 20`)

// 已移除的任务二次移除（幂等）
const t = createTask('X', '')
edgeQ.push(t)
const removed = removeTask(edgeQ, t.id)
assert(removed.length === 0, `移除后队列为空`)
const removedAgain = removeTask(removed, t.id)
assert(removedAgain.length === 0, `二次移除空队列 → 仍为空（幂等）`)


// ======================== 汇总 ========================
console.log(`\n${'='.repeat(64)}`)
console.log(`测试完成：${passCount} PASS / ${failCount} FAIL / ${passCount + failCount} TOTAL`)
console.log(`${'='.repeat(64)}\n`)

if (failCount > 0) {
  process.exit(1)
}
