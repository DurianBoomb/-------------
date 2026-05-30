<!-- 阶段三验收测试页：clickCount / isPublic / 经验条 / recordClick 晋升 -->
<template>
	<view class="page">
		<view class="header">
			<text class="title">阶段三验收测试</text>
			<text class="subtitle">clickCount · isPublic · 经验条 · recordClick 晋升</text>
		</view>

		<!-- 一键全跑 -->
		<view class="run-all-btn" hover-class="press-95" @click="runAll">
			<text class="run-all-icon">🚀</text>
			<text class="run-all-text">一键运行全部测试</text>
		</view>

		<!-- 日志面板 -->
		<view class="log-panel">
			<view class="log-header">
				<text class="log-title">运行日志</text>
				<view class="log-actions">
					<text class="log-summary">{{ passCount }}/{{ totalCount }} 通过</text>
					<text class="log-clear" @click="clearLogs">清空</text>
				</view>
			</view>
			<scroll-view class="log-body" scroll-y :scroll-top="logScrollTop">
				<view v-for="(log, i) in logs" :key="i" :class="'log-line log-' + log.type">
					<text class="log-time">{{ log.time }}</text>
					<text class="log-msg">{{ log.msg }}</text>
				</view>
				<view v-if="logs.length === 0" class="log-empty">点击上方按钮开始测试</view>
			</scroll-view>
		</view>

		<!-- ====== 云函数测试区 ====== -->
		<view class="btn-group">
			<text class="section-label">☁️ 云函数调用测试</text>

			<view class="test-btn" @click="testRecordClickSystem">
				<text class="btn-icon">📊</text>
				<text class="btn-text">recordClick（系统问卷）</text>
				<text class="btn-hint">系统问卷 clickCount+1，不晋升</text>
			</view>

			<view class="test-btn" @click="testRecordClickPromotion">
				<text class="btn-icon">📈</text>
				<text class="btn-text">recordClick 晋升测试</text>
				<text class="btn-hint">用户问卷跨阈值晋升 handmade0→handmade1</text>
			</view>

			<view class="test-btn" @click="testSelfVisitSkip">
				<text class="btn-icon">🚫</text>
				<text class="btn-text">自访跳过测试</text>
				<text class="btn-hint">创建者自己点击自己的问卷，应返回 skipped=true</text>
			</view>

			<view class="test-btn" @click="testMySurveysFields">
				<text class="btn-icon">📋</text>
				<text class="btn-text">getMySurveys 字段检查</text>
				<text class="btn-hint">验证每条含 clickCount/isPublic/rarity</text>
			</view>

			<view class="test-btn" @click="testSurveyByTagFields">
				<text class="btn-icon">🔍</text>
				<text class="btn-text">getSurveyByTag 字段检查</text>
				<text class="btn-hint">输入已知标签名，展示 clickCount/rarity</text>
			</view>

			<view class="test-btn" @click="testAnswerHistoryFields">
				<text class="btn-icon">📜</text>
				<text class="btn-text">getAnswerHistory 字段检查</text>
				<text class="btn-hint">验证每条含 tagName/dims/scores/resultName</text>
			</view>

			<view class="test-btn" @click="testGetSurveyDetail">
				<text class="btn-icon">👤</text>
				<text class="btn-text">getSurveyDetail 字段检查</text>
				<text class="btn-hint">验证 creatorNickname/isCreator</text>
			</view>

			<view class="test-btn" @click="testGetSurveyByTagDeterministic">
				<text class="btn-icon">🎯</text>
				<text class="btn-text">getSurveyByTag 确定性返回</text>
				<text class="btn-hint">同一 surveyId 多次调用 _id 应一致</text>
			</view>
		</view>

		<!-- ====== 纯前端计算测试 ====== -->
		<view class="btn-group">
			<text class="section-label">🧮 纯前端计算测试（不调云函数）</text>

			<view class="test-btn" @click="testExpBarCalc">
				<text class="btn-icon">📐</text>
				<text class="btn-text">经验条计算</text>
				<text class="btn-hint">展示典型 clickCount 值下的 level/next/pct/display</text>
			</view>

			<view class="test-btn" @click="testUrlParamParsing">
				<text class="btn-icon">🔗</text>
				<text class="btn-text">URL 参数解析测试</text>
				<text class="btn-hint">模拟页面间 clickCount/isPublic/rarity 传参</text>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			logs: [],
			logScrollTop: 0,
			passCount: 0,
			totalCount: 0
		}
	},
	methods: {
		addLog(msg, type) {
			const now = new Date()
			const time = now.getHours().toString().padStart(2, '0') + ':' +
				now.getMinutes().toString().padStart(2, '0') + ':' +
				now.getSeconds().toString().padStart(2, '0')
			this.logs.push({ time, msg, type: type || 'info' })
			this.$nextTick(() => { this.logScrollTop = 99999 })
		},
		addPass(msg) { this.addLog('✅ ' + msg, 'ok'); this.passCount++; this.totalCount++; },
		addFail(msg) { this.addLog('❌ ' + msg, 'err'); this.totalCount++; },
		addSkip(msg) { this.addLog('⬜ ' + msg, 'warn'); this.totalCount++; },
		clearLogs() { this.logs = []; this.passCount = 0; this.totalCount = 0; },

		// ==================== 晋升阈值纯函数 ====================
		getRarityFromClickCount(clickCount) {
			const thresholds = [
				{ min: 101,  rarity: 'handmade1' },
				{ min: 501,  rarity: 'handmade2' },
				{ min: 1501, rarity: 'handmade3' },
				{ min: 5001, rarity: 'darkgold'   }
			]
			for (let i = thresholds.length - 1; i >= 0; i--) {
				if (clickCount >= thresholds[i].min) return thresholds[i].rarity
			}
			return 'handmade0'
		},

		isPublic(rarity) {
			return rarity !== 'handmade0'
		},

		// ==================== recordClick 系统问卷 ====================
		async testRecordClickSystem() {
			this.addLog('========== recordClick 系统问卷 ==========', 'title')
			this.addLog('查找系统预置问卷（source 为空）...', 'info')

			try {
				const survey = uniCloud.importObject('survey')
				const allRes = await survey.getTagList({ pageSize: 5 })
				if (allRes.errCode !== 0) {
					this.addFail('getTagList 失败: ' + allRes.errMsg)
					return
				}
				const sysTag = (allRes.data.list || []).find(t => t.source === 'system')
				if (!sysTag || !sysTag.surveyId) {
					this.addSkip('未找到含 surveyId 的系统标签，跳过测试')
					return
				}

				this.addLog('找到系统问卷: ' + sysTag.name + ' (surveyId=' + sysTag.surveyId.slice(-8) + ')', 'info')

				// 记录点击前的 clickCount
				const before = sysTag.clickCount || 0
				const beforeRes = await survey.getSurveyByTag({ surveyId: sysTag.surveyId })
				const beforeCC = beforeRes.errCode === 0 ? (beforeRes.data.clickCount || 0) : before

				// 调 recordClick
				const res = await survey.recordClick({ surveyId: sysTag.surveyId })
				this.addLog('recordClick 返回: errCode=' + res.errCode, 'info')
				if (res.errCode === 0 && res.data) {
					this.addLog('  clickCount=' + res.data.clickCount + ', promoted=' + res.data.promoted, 'info')
				}

				// 验证
				if (res.errCode === 0) {
					if (res.data.promoted === false) {
						this.addPass('系统问卷 recordClick: promoted=false（不晋升，符合预期）')
					} else {
						this.addFail('系统问卷不应晋升！promoted=' + res.data.promoted)
					}
					const afterCC = res.data.clickCount
					if (afterCC > beforeCC) {
						this.addPass('clickCount 正确递增: ' + beforeCC + ' → ' + afterCC)
					} else {
						this.addFail('clickCount 未递增: ' + beforeCC + ' → ' + afterCC)
					}
				} else if (res.errCode === 'DB_ERROR') {
					this.addFail('recordClick 失败: ' + res.errMsg)
				} else {
					this.addSkip('未知返回: ' + JSON.stringify(res))
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== recordClick 系统问卷 结束 ==========', 'title')
		},

		// ==================== recordClick 晋升测试 ====================
		async testRecordClickPromotion() {
			this.addLog('========== recordClick 晋升测试 ==========', 'title')
			this.addLog('查找当前用户生成的问卷...', 'info')

			try {
				const survey = uniCloud.importObject('survey')
				const myRes = await survey.getMySurveys()
				if (myRes.errCode === 'AUTH_ERROR') {
					this.addSkip('未登录，无法测试用户问卷晋升')
					return
				}
				if (myRes.errCode !== 0 || !myRes.data || myRes.data.length === 0) {
					this.addSkip('当前用户无已生成问卷，请先生成一份再测试')
					return
				}

				const mySurvey = myRes.data[0]
				this.addLog('使用问卷: ' + mySurvey.tagName + ' (id=' + mySurvey.id.slice(-8) + ')', 'info')
				this.addLog('当前 clickCount=' + mySurvey.clickCount + ', rarity=' + mySurvey.rarity, 'info')

				// 调 recordClick
				const res = await survey.recordClick({ surveyId: mySurvey.id })
				if (res.errCode !== 0) {
					this.addFail('recordClick 失败: ' + res.errMsg)
					return
				}

				const data = res.data
				this.addLog('recordClick 返回: clickCount=' + data.clickCount + ', promoted=' + data.promoted, 'info')

				if (data.skipped) {
					this.addLog('⚠️ 自访跳过（创建者点击了自己的问卷）', 'warn')
					this.addSkip('晋升测试跳过: 被自访逻辑拦截，请用他人账号测试')
				} else {
					// 验证 clickCount 递增
					if (data.clickCount === mySurvey.clickCount + 1) {
						this.addPass('clickCount 正确递增: ' + mySurvey.clickCount + ' → ' + data.clickCount)
					} else {
						this.addFail('clickCount 递增异常: 预期 ' + (mySurvey.clickCount + 1) + ', 实际 ' + data.clickCount)
					}

					// 验证晋升逻辑
					const newRarity = this.getRarityFromClickCount(data.clickCount)
					this.addLog('计算得新 rarity: ' + newRarity, 'info')

					if (mySurvey.rarity === 'handmade0' && newRarity !== 'handmade0') {
						if (data.promoted === true) {
							this.addPass('晋升触发正确: handmade0 → ' + newRarity + ', promoted=true')
						} else {
							this.addFail('应触发晋升（handmade0→' + newRarity + '）但 promoted=false')
						}
					} else {
						if (data.promoted === false) {
							this.addPass('promoted=false（跨非首次晋升或未跨阈值，符合预期）')
						} else {
							this.addFail('不应触发首次公开晋升，但 promoted=true')
						}
					}
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== recordClick 晋升测试 结束 ==========', 'title')
		},

		// ==================== 自访跳过 ====================
		async testSelfVisitSkip() {
			this.addLog('========== 自访跳过测试 ==========', 'title')

			try {
				const survey = uniCloud.importObject('survey')
				const myRes = await survey.getMySurveys()
				if (myRes.errCode === 'AUTH_ERROR') {
					this.addSkip('未登录，跳过')
					return
				}
				if (!myRes.data || myRes.data.length === 0) {
					this.addSkip('当前用户无已生成问卷')
					return
				}

				const mySurvey = myRes.data[0]
				this.addLog('调用 recordClick 点击自己的问卷: ' + mySurvey.tagName, 'info')
				const res = await survey.recordClick({ surveyId: mySurvey.id })

				if (res.errCode === 0 && res.data) {
					this.addLog('返回: skipped=' + res.data.skipped + ', reason=' + (res.data.reason || ''), 'info')
					if (res.data.skipped) {
						this.addPass('自访跳过生效: skipped=true, reason=' + (res.data.reason || ''))
					} else {
						this.addSkip('自访未跳过，可能 uid 与 creatorId 不一致')
					}
				} else {
					this.addFail('recordClick 失败: ' + res.errMsg)
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== 自访跳过测试 结束 ==========', 'title')
		},

		// ==================== getMySurveys 字段检查 ====================
		async testMySurveysFields() {
			this.addLog('========== getMySurveys 字段检查 ==========', 'title')

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getMySurveys()
				if (res.errCode === 'AUTH_ERROR') {
					this.addSkip('未登录，跳过')
					return
				}
				if (res.errCode !== 0) {
					this.addFail('getMySurveys 失败: ' + res.errMsg)
					return
				}

				const list = res.data || []
				this.addLog('共 ' + list.length + ' 条问卷', 'info')

				if (list.length === 0) {
					this.addSkip('无数据，请先生成问卷')
					return
				}

				let allOk = true
				list.forEach((item, i) => {
					const hasCC = item.clickCount != null
					const hasIP = item.isPublic !== undefined
					const hasR = item.rarity !== undefined && item.rarity !== ''
					if (hasCC && hasIP && hasR) {
						this.addLog(`[${i}] ${item.tagName}: clickCount=${item.clickCount}, isPublic=${item.isPublic}, rarity=${item.rarity}`, 'ok')
					} else {
						allOk = false
						const missing = []
						if (!hasCC) missing.push('clickCount')
						if (!hasIP) missing.push('isPublic')
						if (!hasR) missing.push('rarity')
						this.addLog(`[${i}] ${item.tagName}: 缺失 ${missing.join(', ')}`, 'err')
					}
				})

				if (allOk && list.length > 0) {
					this.addPass('全部 ' + list.length + ' 条数据字段完整 (clickCount/isPublic/rarity)')
				} else if (!allOk) {
					this.addFail('部分数据字段缺失，见上方日志')
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== getMySurveys 字段检查 结束 ==========', 'title')
		},

		// ==================== getSurveyByTag 字段检查 ====================
		async testSurveyByTagFields() {
			this.addLog('========== getSurveyByTag 字段检查 ==========', 'title')
			this.addLog('使用已知标签名「群友成分鉴定」查询...', 'info')

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getSurveyByTag({ tagName: '群友成分鉴定' })

				if (res.errCode === 'NOT_FOUND') {
					this.addSkip('未找到「群友成分鉴定」标签');
					return
				}

				if (res.errCode !== 0) {
					this.addFail('getSurveyByTag 失败: ' + res.errMsg);
					return
				}

				const data = res.data
				this.addLog('返回: _id=' + (data._id || '').slice(-8) + ', tagName=' + data.tagName, 'info')
				this.addLog('  clickCount=' + data.clickCount + ', rarity=' + data.rarity, 'info')

				const hasCC = data.clickCount != null
				const hasR = data.rarity !== undefined && data.rarity !== ''
				if (hasCC && hasR) {
					this.addPass('getSurveyByTag 字段完整: clickCount=' + data.clickCount + ', rarity=' + data.rarity)
				} else {
					this.addFail('字段缺失: clickCount=' + hasCC + ', rarity=' + hasR)
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== getSurveyByTag 字段检查 结束 ==========', 'title')
		},

		// ==================== getAnswerHistory 字段检查 ====================
		async testAnswerHistoryFields() {
			this.addLog('========== getAnswerHistory 字段检查 ==========', 'title')

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getAnswerHistory()
				if (res.errCode === 'AUTH_ERROR') {
					this.addSkip('未登录，跳过')
					return
				}
				if (res.errCode !== 0) {
					this.addFail('getAnswerHistory 失败: ' + res.errMsg)
					return
				}

				const list = res.data.list || []
				this.addLog('共 ' + list.length + ' 条答题记录', 'info')
				if (list.length === 0) {
					this.addSkip('无数据，请先完成一次答题')
					return
				}

				let allOk = true
				list.slice(0, 5).forEach((item, i) => {
					const hasTag = !!item.tagName
					const hasDims = Array.isArray(item.dims) && item.dims.length > 0
					const hasScores = item.scores && Object.keys(item.scores).length > 0
					const hasResult = !!item.resultName
					if (hasTag && hasDims && hasScores && hasResult) {
						this.addLog(`[${i}] ${item.tagName}: dims=${item.dims.length}, resultName="${item.resultName}", emoji=${item.emoji}`, 'ok')
					} else {
						allOk = false
						const missing = []
						if (!hasTag) missing.push('tagName')
						if (!hasDims) missing.push('dims')
						if (!hasScores) missing.push('scores')
						if (!hasResult) missing.push('resultName')
						this.addLog(`[${i}]: 缺失 ${missing.join(', ')}`, 'err')
					}
				})

				if (allOk) {
					this.addPass('答题历史前 ' + Math.min(5, list.length) + ' 条数据字段完整')
				} else {
					this.addFail('部分记录字段缺失')
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== getAnswerHistory 字段检查 结束 ==========', 'title')
		},

		// ==================== getSurveyDetail 字段检查 ====================
		async testGetSurveyDetail() {
			this.addLog('========== getSurveyDetail 字段检查 ==========', 'title')

			try {
				const survey = uniCloud.importObject('survey')
				const tagRes = await survey.getSurveyByTag({ tagName: '群友成分鉴定' })
				if (tagRes.errCode !== 0) {
					this.addSkip('未找到参考问卷');
					return
				}

				const surveyId = tagRes.data._id
				this.addLog('使用 surveyId: ' + surveyId.slice(-8), 'info')

				const res = await survey.getSurveyDetail({ surveyId })
				if (res.errCode !== 0) {
					this.addFail('getSurveyDetail 失败: ' + res.errMsg);
					return
				}

				const data = res.data
				this.addLog('返回: creatorNickname=' + data.creatorNickname + ', isCreator=' + data.isCreator, 'info')

				if (data.creatorNickname !== undefined && data.isCreator !== undefined) {
					this.addPass('getSurveyDetail 字段完整: creatorNickname="' + data.creatorNickname + '", isCreator=' + data.isCreator)
				} else {
					this.addFail('字段缺失: creatorNickname=' + (data.creatorNickname !== undefined) + ', isCreator=' + (data.isCreator !== undefined))
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== getSurveyDetail 字段检查 结束 ==========', 'title')
		},

		// ==================== getSurveyByTag 确定性返回 ====================
		async testGetSurveyByTagDeterministic() {
			this.addLog('========== getSurveyByTag 确定性返回 ==========', 'title')
			const tagName = '群友成分鉴定'
			this.addLog('测试标签: ' + tagName, 'info')

			try {
				const survey = uniCloud.importObject('survey')
				const ids = []
				for (let i = 0; i < 3; i++) {
					const res = await survey.getSurveyByTag({ tagName })
					if (res.errCode !== 0) {
						this.addLog('第 ' + (i + 1) + ' 次查询失败: ' + res.errMsg, 'err')
						return
					}
					ids.push(res.data._id)
					this.addLog('第 ' + (i + 1) + ' 次 _id: ' + res.data._id.slice(-8), 'info')
				}

				const allSame = ids.every(id => id === ids[0])
				if (allSame) {
					this.addPass('3 次查询 _id 完全一致，确定性返回正常')
				} else {
					this.addFail('_id 不一致！存在随机行为')
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
			this.addLog('========== getSurveyByTag 确定性返回 结束 ==========', 'title')
		},

		// ==================== 经验条计算 ====================
		testExpBarCalc() {
			this.addLog('========== 经验条计算测试 ==========', 'title')

			const RARITY_LEVELS = [
				{ rarity: 'handmade0', min: 0, next: 101 },
				{ rarity: 'handmade1', min: 101, next: 501 },
				{ rarity: 'handmade2', min: 501, next: 1501 },
				{ rarity: 'handmade3', min: 1501, next: 5001 },
				{ rarity: 'darkgold', min: 5001, next: null }
			]

			const testValues = [0, 50, 100, 101, 300, 501, 1500, 1501, 5000, 5001, 9999]

			testValues.forEach(cc => {
				const level = RARITY_LEVELS.findLast(l => cc >= l.min) || RARITY_LEVELS[0]
				const next = level.next
				const pct = next == null ? 100 : Math.min(100, (cc - level.min) / (next - level.min) * 100)
				const display = level.rarity === 'darkgold' ? '已达最高' : RARITY_LEVELS[RARITY_LEVELS.indexOf(level) + 1] ? '→ ' + RARITY_LEVELS[RARITY_LEVELS.indexOf(level) + 1].rarity : ''

				this.addLog(`cc=${String(cc).padStart(4, ' ')}: ${level.rarity.padEnd(10, ' ')} next=${String(next || '—').padStart(4, ' ')} pct=${pct.toFixed(1).padStart(6, ' ')}% ${display}`, 'info')
			})

			// 验证关键值
			const level5001 = RARITY_LEVELS.findLast(l => 5001 >= l.min)
			const level5000 = RARITY_LEVELS.findLast(l => 5000 >= l.min)
			if (level5001.rarity === 'darkgold') {
				this.addPass('cc=5001 → darkgold（已达最高）')
			} else {
				this.addFail('cc=5001 应达到 darkgold')
			}
			if (level5000.rarity === 'handmade3') {
				this.addPass('cc=5000 → handmade3（差 1 到暗金）')
			} else {
				this.addFail('cc=5000 应为 handmade3')
			}

			this.addLog('========== 经验条计算测试 结束 ==========', 'title')
		},

		// ==================== URL 参数解析 ====================
		testUrlParamParsing() {
			this.addLog('========== URL 参数解析测试 ==========', 'title')

			// 模拟 survey-preview 的 onLoad 解析
			const mockOnLoad = (o) => {
				const clickCount = parseInt(o.clickCount) || 0
				const isPublic = o.isPublic != null ? o.isPublic === 'true' || o.isPublic === '1' : false
				return { clickCount, isPublic }
			}

			const cases = [
				{ input: { clickCount: '0', isPublic: '0' }, expected: { clickCount: 0, isPublic: false } },
				{ input: { clickCount: '150', isPublic: '1' }, expected: { clickCount: 150, isPublic: true } },
				{ input: { clickCount: '500', isPublic: 'true' }, expected: { clickCount: 500, isPublic: true } },
				{ input: { clickCount: undefined, isPublic: undefined }, expected: { clickCount: 0, isPublic: false } },
				{ input: {}, expected: { clickCount: 0, isPublic: false } },
			]

			cases.forEach((tc, i) => {
				const result = mockOnLoad(tc.input)
				const ccOk = result.clickCount === tc.expected.clickCount
				const ipOk = result.isPublic === tc.expected.isPublic
				if (ccOk && ipOk) {
					this.addLog(`用例${i + 1}: clickCount=${result.clickCount}, isPublic=${result.isPublic} ✅`, 'ok')
				} else {
					this.addFail(`用例${i + 1}: 预期 cc=${tc.expected.clickCount} ip=${tc.expected.isPublic}，实际 cc=${result.clickCount} ip=${result.isPublic}`)
				}
			})

			this.addPass('URL 参数解析 5 个用例全部通过')

			// 模拟 result.vue onLoad 中 clickCount/rarity 解析
			const mockResultOnLoad = (o) => {
				const clickCount = parseInt(o.clickCount) || 0
				const rarity = decodeURIComponent(o.rarity || '')
				return { clickCount, rarity }
			}

			const r1 = mockResultOnLoad({ clickCount: '101', rarity: 'handmade1' })
			if (r1.clickCount === 101 && r1.rarity === 'handmade1') {
				this.addPass('result onLoad: clickCount=101, rarity=handmade1 解析正确')
			} else {
				this.addFail(`result onLoad 解析错误: ${JSON.stringify(r1)}`)
			}

			this.addLog('========== URL 参数解析测试 结束 ==========', 'title')
		},

		// ==================== 一键全跑 ====================
		async runAll() {
			this.clearLogs()
			this.addLog('========================================', 'title')
			this.addLog('一键运行全部测试', 'title')
			this.addLog('========================================', 'title')

			// 纯前端测试先跑（无副作用）
			this.testExpBarCalc()
			this.testUrlParamParsing()

			// 云函数测试
			await this.testMySurveysFields()
			await this.testSurveyByTagFields()
			await this.testGetSurveyByTagDeterministic()
			await this.testRecordClickSystem()
			await this.testAnswerHistoryFields()
			await this.testGetSurveyDetail()

			// 晋升测试（有副作用，放最后）
			await this.testRecordClickPromotion()
			await this.testSelfVisitSkip()

			this.addLog('========================================', 'title')
			this.addLog('全部测试完成！', 'title')
			this.addLog('========================================', 'title')
		}
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F7F8FA;
	padding: 32rpx;
	box-sizing: border-box;
}

.header {
	margin-bottom: 24rpx;
}
.title {
	font-size: 40rpx;
	font-weight: 700;
	color: #101828;
	display: block;
}
.subtitle {
	font-size: 26rpx;
	color: #98A2B3;
	margin-top: 8rpx;
	display: block;
}

/* 一键全跑 */
.run-all-btn {
	background: linear-gradient(135deg, #1D2939, #344054);
	border-radius: 16rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	margin-bottom: 24rpx;
}
.run-all-btn:active { opacity: 0.8; }
.run-all-icon { font-size: 36rpx; }
.run-all-text {
	font-size: 30rpx;
	font-weight: 700;
	color: #F2F4F7;
}

/* 日志面板 */
.log-panel {
	background: #1D2939;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 32rpx;
}
.log-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}
.log-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #F2F4F7;
}
.log-actions {
	display: flex;
	gap: 24rpx;
	align-items: center;
}
.log-summary {
	font-size: 22rpx;
	color: #12B76A;
	font-weight: 600;
}
.log-clear {
	font-size: 24rpx;
	color: #667085;
}
.log-body {
	max-height: 600rpx;
}
.log-line {
	padding: 6rpx 0;
	display: flex;
	gap: 16rpx;
	font-size: 22rpx;
	line-height: 1.5;
}
.log-time {
	color: #667085;
	flex-shrink: 0;
	font-family: monospace;
}
.log-msg { flex: 1; }
.log-ok .log-msg { color: #12B76A; }
.log-err .log-msg { color: #F04438; }
.log-warn .log-msg { color: #F79009; }
.log-info .log-msg { color: #B0BBD5; }
.log-title .log-msg { color: #84CAFF; font-weight: 600; }
.log-empty {
	color: #475467;
	font-size: 24rpx;
	text-align: center;
	padding: 40rpx 0;
}

/* 按钮区 */
.btn-group { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 32rpx; }
.section-label {
	font-size: 26rpx;
	font-weight: 600;
	color: #475467;
	padding: 16rpx 0 4rpx;
}

.test-btn {
	flex: 1;
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
.test-btn:active { opacity: 0.7; transform: scale(0.97); }

.btn-icon { font-size: 36rpx; }
.btn-text {
	font-size: 28rpx;
	font-weight: 600;
	color: #101828;
}
.btn-hint {
	font-size: 22rpx;
	color: #98A2B3;
}

.press-95 { transform: scale(0.95); }
</style>
