// ========== 置顶功能迁移——静态验证脚本 ==========
// 验证 quiz-home.vue 和 index.vue 的代码结构是否符合迁移清单
// 运行：node verify_migration.js

const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const QUIZ_HOME = path.join(ROOT, 'pages-tools/quiz-home/quiz-home.vue')
const INDEX = path.join(ROOT, 'pages/index/index.vue')

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail) {
	if (condition) {
		passed++
		console.log(`  ✅ ${name}`)
	} else {
		failed++
		const msg = `  ❌ ${name}${detail ? ' — ' + detail : ''}`
		failures.push(msg)
		console.log(msg)
	}
}

function loadFile(filePath) {
	if (!fs.existsSync(filePath)) {
		console.error(`文件不存在: ${filePath}`)
		process.exit(1)
	}
	return fs.readFileSync(filePath, 'utf-8')
}

// ------- quiz-home.vue -------
console.log('\n📋 一、quiz-home.vue —— 应包含的项')
console.log('─'.repeat(50))

const qh = loadFile(QUIZ_HOME)

// region 提取
const qhTemplate = (qh.match(/<template>([\s\S]*?)<\/template>/) || ['', ''])[1]
const qhScript = (qh.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1]
const qhStyle = (qh.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1]

// ====== 模板 ======
console.log('  [模板]')
check('pin-terminal-entry 组件', qhTemplate.includes('pin-terminal-entry'))
check('pin-topbar 组件', qhTemplate.includes('pin-topbar'))
check('未读档案弹窗 overlay', qhTemplate.includes('career-popup-overlay'))
check('弹窗标题 "15分钟名气管理局"', qhTemplate.includes('15分钟名气管理局'))
check('"查看档案" 按钮', qhTemplate.includes('查看档案'))
check('"稍后再说" 按钮', qhTemplate.includes('稍后再说'))
check('不存在 green-channel-splash', !qhTemplate.includes('green-channel-splash'))

// ====== 脚本 ======
console.log('  [脚本 — import]')
check('import PinTerminalEntry', qhScript.includes("import PinTerminalEntry"))
check('import PinTopbar', qhScript.includes("import PinTopbar"))
check('不存在 import GreenChannelSplash', !qhScript.includes("import GreenChannelSplash"))

console.log('  [脚本 — components]')
check('注册两个组件 (PinTerminalEntry, PinTopbar)',
	qhScript.includes('components: { PinTerminalEntry, PinTopbar') &&
	!qhScript.includes('GreenChannelSplash'))

console.log('  [脚本 — data]')
const qhDataBlock = (qhScript.match(/data\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\}\s*\}/) || ['', ''])[1]
check('currentSurveyId', qhDataBlock.includes('currentSurveyId'))
check('不存在 showGreenChannel', !qhDataBlock.includes('showGreenChannel'))
check('不存在 greenChannelPinData', !qhDataBlock.includes('greenChannelPinData'))
check('pendingCareers', qhDataBlock.includes('pendingCareers'))
check('showCareerPopup', qhDataBlock.includes('showCareerPopup'))
check('currentCareer', qhDataBlock.includes('currentCareer'))
check('careerIndex', qhDataBlock.includes('careerIndex'))

console.log('  [脚本 — 生命周期]')
check('onReady()', qhScript.includes('onReady()'))
check('onShow 中有 pinTopbar?.refresh()', qhScript.includes('pinTopbar?.refresh()'))
check('onShow 中有 checkUnreadCareer()', qhScript.includes('checkUnreadCareer()'))

console.log('  [脚本 — 方法]')
check('onPinned', qhScript.includes('onPinned'))
check('不存在 onGreenChannel', !qhScript.includes('onGreenChannel'))
check('不存在 onGreenChannelClose', !qhScript.includes('onGreenChannelClose'))
check('checkUnreadCareer', qhScript.includes('checkUnreadCareer'))
check('showNextCareer', qhScript.includes('showNextCareer'))
check('dismissCareerPopup', qhScript.includes('dismissCareerPopup'))
check('viewCareer', qhScript.includes('viewCareer'))
check('formatNum', qhScript.includes('formatNum'))

// ====== 样式 ======
console.log('  [样式]')
check('档案弹窗样式 .career-popup-overlay', qhStyle.includes('.career-popup-overlay'))
check('档案弹窗样式 .career-popup-stamp', qhStyle.includes('.career-popup-stamp'))
check('档案弹窗样式 .career-popup-btn', qhStyle.includes('.career-popup-btn'))
check('档案弹窗 fadeIn 动画', qhStyle.includes('@keyframes fadeIn'))

// ====== 应删除的 ======
console.log('  [应删除的项]')
check('不存在 mockCards', !qhDataBlock.includes('mockCards'))
check('不存在 .ptb-inline 样式', !qhStyle.includes('.ptb-inline'))
check('不存在 .ptb-card 样式', !qhStyle.includes('.ptb-card'))

// ------- index.vue -------
console.log('\n📋 二、index.vue —— 不应包含的项')
console.log('─'.repeat(50))

const idx = loadFile(INDEX)

const idxTemplate = (idx.match(/<template>([\s\S]*?)<\/template>/) || ['', ''])[1]
const idxScript = (idx.match(/<script>([\s\S]*?)<\/script>/) || ['', ''])[1]
const idxStyle = (idx.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1]

// ====== 模板 ======
console.log('  [模板 — 不应出现]')
check('不存在 pin-terminal-entry', !idxTemplate.includes('pin-terminal-entry'))
check('不存在 pin-topbar', !idxTemplate.includes('pin-topbar'))
check('不存在 green-channel-splash', !idxTemplate.includes('green-channel-splash'))
check('不存在 career-popup-overlay', !idxTemplate.includes('career-popup-overlay'))
check('不存在 "15分钟名气管理局"', !idxTemplate.includes('15分钟名气管理局'))

// ====== 脚本 ======
console.log('  [脚本 — 不应出现的 import]')
check('不存在 import PinTerminalEntry', !idxScript.includes('import PinTerminalEntry'))
check('不存在 import PinTopbar', !idxScript.includes('import PinTopbar'))
check('不存在 import GreenChannelSplash', !idxScript.includes('import GreenChannelSplash'))

console.log('  [脚本 — 不应出现的 data]')
const idxDataBlock = (idxScript.match(/data\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\}\s*\}/) || ['', ''])[1]
check('不存在 currentSurveyId', !idxDataBlock.includes('currentSurveyId'))
check('不存在 showGreenChannel', !idxDataBlock.includes('showGreenChannel'))
check('不存在 greenChannelPinData', !idxDataBlock.includes('greenChannelPinData'))
check('不存在 pendingCareers', !idxDataBlock.includes('pendingCareers'))
check('不存在 showCareerPopup', !idxDataBlock.includes('showCareerPopup'))

console.log('  [脚本 — 不应出现的方法]')
check('不存在 onReady', !idxScript.includes('onReady()') || idxScript.includes('// onReady'))
check('不存在 goPinTest', !idxScript.includes('goPinTest'))
check('不存在 goStage7Test', !idxScript.includes('goStage7Test'))
check('不存在 onPinned', !idxScript.includes('onPinned'))
check('不存在 onGreenChannel', !idxScript.includes('onGreenChannel'))
check('不存在 onGreenChannelClose', !idxScript.includes('onGreenChannelClose'))
check('不存在 checkUnreadCareer', !idxScript.includes('checkUnreadCareer'))
check('不存在 showNextCareer', !idxScript.includes('showNextCareer'))
check('不存在 dismissCareerPopup', !idxScript.includes('dismissCareerPopup'))
check('不存在 viewCareer', !idxScript.includes('viewCareer'))
check('不存在 formatNum', !idxScript.includes('formatNum'))

console.log('  [脚本 — 不应出现 onShow 中的置顶/档案调用]')
// pinTopbar 引用不应出现在 onShow 里
const idxOnShow = (idxScript.match(/onShow\(\)\s*\{([\s\S]*?)\},/) || ['', ''])[1]
check('onShow 中不存在 pinTopbar', !idxOnShow.includes('pinTopbar'))
check('onShow 中不存在 checkUnreadCareer', !idxOnShow.includes('checkUnreadCareer'))

console.log('  [脚本 — 保留的项]')
check('保留 goRadarFakeTest', idxScript.includes('goRadarFakeTest'))
check('保留 goImageDebug', idxScript.includes('goImageDebug'))
check('保留 goDarkgoldQuiz', idxScript.includes('goDarkgoldQuiz'))
check('保留 openTool', idxScript.includes('openTool'))
check('保留 tools 数组', idxDataBlock.includes('tools'))

// ====== 样式 ======
console.log('  [样式 — 不应出现]')
check('不存在 .career-popup-overlay', !idxStyle.includes('.career-popup-overlay'))
check('不存在 career-popup-stamp', !idxStyle.includes('.career-popup-stamp'))

// ====== 交叉验证 ======
console.log('\n📋 三、交叉验证')
console.log('─'.repeat(50))

// 确保 unique 云对象调用只在 quiz-home 中
const qhPinSystemRefs = (qhScript.match(/pin-system/g) || []).length
const idxPinSystemRefs = (idxScript.match(/pin-system/g) || []).length
console.log(`  quiz-home.vue 中引用 pin-system: ${qhPinSystemRefs} 次`)
console.log(`  index.vue 中引用 pin-system: ${idxPinSystemRefs} 次`)
check('quiz-home 引用了 pin-system', qhPinSystemRefs > 0)
check('index 未引用 pin-system', idxPinSystemRefs === 0,
	idxPinSystemRefs > 0 ? `仍有 ${idxPinSystemRefs} 处引用` : '')

// 确保唯一 pin-system importObject 调用只在 quiz-home 中
const qhImportObject = (qhScript.match(/importObject\(['"]pin-system['"]\)/g) || []).length
const idxImportObject = (idxScript.match(/importObject\(['"]pin-system['"]\)/g) || []).length
check('quiz-home 调用了 uniCloud.importObject("pin-system")', qhImportObject > 0)
check('index 未调用 uniCloud.importObject("pin-system")', idxImportObject === 0,
	idxImportObject > 0 ? `仍有 ${idxImportObject} 处调用` : '')

// ------- 结果 -------
console.log('\n' + '═'.repeat(50))
console.log(`\n📊 测试结果：${passed} 通过 / ${passed + failed} 总计`)

if (failed > 0) {
	console.log(`\n❌ ${failed} 项失败：`)
	failures.forEach(f => console.log(f))
	process.exit(1)
} else {
	console.log('\n✅ 全部通过！迁移静态验证成功。\n')
}
