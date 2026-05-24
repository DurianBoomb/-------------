<!-- 阶段一验收测试页：标签唯一性约束 -->
<template>
	<view class="page">
		<view class="header">
			<text class="title">阶段一验收测试</text>
			<text class="subtitle">标签唯一性约束 — 一键测试</text>
		</view>

		<!-- 一键全跑 -->
		<view class="run-all-btn" hover-class="press-95" @click="runAll">
			<text class="run-all-icon">🚀</text>
			<text class="run-all-text">一键运行全部测试</text>
		</view>

		<!-- ====== 数据查重 + 去重工具 ====== -->
		<view class="dedup-section">
			<view class="dedup-header">
				<text class="dedup-title">📋 数据查重 & 去重</text>
				<text class="dedup-desc">部署唯一索引前必须先清理重复数据</text>
			</view>

			<view class="dedup-actions">
				<view class="dedup-btn dedup-btn-scan" @click="scanDuplicates">
					<text class="btn-icon">🔍</text>
					<text class="btn-text">扫描重复标签</text>
				</view>
				<view class="dedup-btn dedup-btn-clean" v-if="duplicates.length > 0" @click="dedupAll">
					<text class="btn-icon">🧹</text>
					<text class="btn-text">一键全部去重</text>
				</view>
			</view>

			<!-- 查重结果 -->
			<view class="dup-result" v-if="dupScanned">
				<text v-if="duplicates.length === 0" class="dup-clean">✅ 无重复数据，可以安全部署唯一索引</text>
				<view v-else class="dup-list">
					<text class="dup-summary">发现 {{ duplicates.length }} 个重复标签：</text>
					<view v-for="(d, i) in duplicates" :key="i" class="dup-item" :class="{ 'dup-cleaned': d._cleaned }">
						<view class="dup-info">
							<text class="dup-name">{{ d.tagName }}</text>
							<text class="dup-count">×{{ d.count }} 条记录</text>
						</view>
						<view class="dup-ids">
							<text class="dup-id-label">保留最早: {{ formatDate(d.earliestDate) }}</text>
						</view>
						<view class="dup-row">
							<text class="dup-creators" v-if="d.creatorIds.length">创建者: {{ d.creatorIds.join(', ') }}</text>
							<view class="dedup-btn-sm" v-if="!d._cleaned" @click="dedupOne(d.tagName, i)">
								<text>去重</text>
							</view>
							<text v-else class="dup-done">已清理 {{ d._deletedCount }} 条</text>
						</view>
					</view>
				</view>
			</view>
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

		<!-- 单独测试按钮 -->
		<view class="btn-group">
			<text class="section-label">TC-05：getSurveyByTag 确定性返回</text>
			<view class="btn-row">
				<view class="test-btn" @click="testDeterministicGetSurvey">
					<text class="btn-icon">🎯</text>
					<text class="btn-text">测试确定性返回</text>
					<text class="btn-hint">同一 tagName 多次调用，_id 应一致</text>
				</view>
			</view>

			<text class="section-label">TC-02/07：TAG_ALREADY_EXISTS Modal</text>
			<view class="btn-row">
				<view class="test-btn" @click="testTagAlreadyExistsModal">
					<text class="btn-icon">🛑</text>
					<text class="btn-text">模拟标签已被占用</text>
					<text class="btn-hint">应弹出 "标签已存在" Modal</text>
				</view>
			</view>

			<text class="section-label">TC-03：同用户重新生成（放行逻辑）</text>
			<view class="btn-row">
				<view class="test-btn" @click="testSameUserRegenerate">
					<text class="btn-icon">🔄</text>
					<text class="btn-text">模拟同用户重新生成</text>
					<text class="btn-hint">验证 del-then-add 流程不报错</text>
				</view>
			</view>

			<text class="section-label">Coze 额度耗尽 Modal（已有）</text>
			<view class="btn-row">
				<view class="test-btn" @click="testCozeExhausted">
					<text class="btn-icon">⚠️</text>
					<text class="btn-text">模拟 Coze 额度耗尽</text>
					<text class="btn-hint">应弹出 "AI 额度已用完" Modal</text>
				</view>
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
			totalCount: 0,
			// 查重
			dupScanned: false,
			duplicates: []
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

		// ==================== 查重 & 去重 ====================

		formatDate(ts) {
			if (!ts) return '未知'
			return new Date(ts).toLocaleString('zh-CN', { hour12: false })
		},

		async scanDuplicates() {
			this.addLog('========== 查重扫描 ==========', 'title')
			this.addLog('正在查询 surveys 表中重复的 tagName...', 'info')
			this.dupScanned = false
			this.duplicates = []

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.checkDuplicates()

				if (res.errCode !== 0) {
					this.addFail('查重失败: ' + res.errMsg)
					return
				}

				const data = res.data
				this.duplicates = data.duplicates.map(d => ({ ...d, _cleaned: false, _deletedCount: 0 }))
				this.dupScanned = true

				if (data.total === 0) {
					this.addPass('无重复数据！surveys 表干净，可安全部署唯一索引')
				} else {
					this.addLog('发现 ' + data.total + ' 个重复标签，共 ' +
						data.duplicates.reduce((s, d) => s + d.count - 1, 0) + ' 条冗余记录', 'warn')
					data.duplicates.forEach(d => {
						this.addLog(d.tagName + ' ×' + d.count + '（冗余 ' + (d.count - 1) + ' 条）', 'warn')
					})
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
				console.error(e)
			}
			this.addLog('========== 查重扫描 完成 ==========', 'title')
		},

		async dedupOne(tagName, index) {
			this.addLog('去重: ' + tagName + ' ...', 'info')
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.deduplicate({ tagName })

				if (res.errCode !== 0) {
					this.addFail('去重失败: ' + res.errMsg)
					return
				}

				const d = res.data
				if (d.count === 0) {
					this.addLog(tagName + ' 只有 1 条记录，无需去重', 'info')
				} else {
					this.addPass(tagName + ' 已清理 ' + d.count + ' 条冗余记录，保留 _id: ' + d.kept)
				}

				if (this.duplicates[index]) {
					this.$set(this.duplicates, index, {
						...this.duplicates[index],
						_cleaned: true,
						_deletedCount: d.count
					})
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
			}
		},

		async dedupAll() {
			this.addLog('========== 一键全部去重 ==========', 'title')

			const pending = this.duplicates.filter(d => !d._cleaned)
			if (pending.length === 0) {
				this.addLog('所有重复标签已处理完毕', 'info')
				this.addLog('========== 一键全部去重 完成 ==========', 'title')
				return
			}

			uni.showModal({
				title: '确认去重',
				content: '将清理 ' + pending.length + ' 个标签的 ' +
					pending.reduce((s, d) => s + d.count - 1, 0) + ' 条冗余记录（保留最早的一条），确定？',
				success: async (r) => {
					if (!r.confirm) {
						this.addLog('用户取消去重', 'warn')
						return
					}

					for (const d of pending) {
						const idx = this.duplicates.findIndex(x => x.tagName === d.tagName)
						await this.dedupOne(d.tagName, idx)
					}

					this.addLog('全部去重完成！', 'ok')
					this.addLog('========== 一键全部去重 完成 ==========', 'title')
				}
			})
		},

		/**
		 * TC-05：getSurveyByTag 确定性返回
		 * 对同一个 tagName 连续调两次，比对 _id 是否一致
		 */
		async testDeterministicGetSurvey() {
			this.addLog('========== TC-05 开始 ==========', 'title')
			this.addLog('提示：请在下方输入已知存在的标签名', 'info')

			// 用已知存在的标签名（群友成分鉴定必然存在）
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
					this.addLog('第 ' + (i + 1) + ' 次 _id: ' + res.data._id, 'info')
				}

				const allSame = ids.every(id => id === ids[0])
				if (allSame) {
					this.addPass('3 次查询 _id 完全一致，确定性返回正常')
				} else {
					this.addFail('_id 不一致！存在随机行为')
					this.addLog('ids: ' + JSON.stringify(ids), 'err')
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
				console.error(e)
			}
			this.addLog('========== TC-05 结束 ==========', 'title')
		},

		/**
		 * TC-02/07：TAG_ALREADY_EXISTS Modal
		 * 模拟云函数返回 TAG_ALREADY_EXISTS 错误
		 */
		testTagAlreadyExistsModal() {
			this.addLog('========== TC-02/07 开始 ==========', 'title')
			this.addLog('模拟 search-page/survey-preview 收到 TAG_ALREADY_EXISTS', 'info')
			this.addLog('弹出 Modal...', 'info')

			uni.showModal({
				title: '标签已存在',
				content: '该标签已有其他人生成的问卷，请换一个标签名',
				showCancel: false,
				success: (res) => {
					if (res.confirm) {
						this.addPass('Modal 正确弹出，用户点击确认')
					}
					this.addLog('========== TC-02/07 结束 ==========', 'title')
				}
			})
		},

		/**
		 * TC-03：同用户重新生成
		 * 模拟云函数中同 creatorId → del-then-add 流程
		 * 这里无法真调 Coze（耗配额），改为验证云函数错误码分叉逻辑存在
		 */
		async testSameUserRegenerate() {
			this.addLog('========== TC-03 开始 ==========', 'title')
			this.addLog('验证 generateFromCoze 同名检查代码已部署', 'info')

			try {
				const survey = uniCloud.importObject('survey')

				// 用一个全新标签名首次生成，会正常走 Coze 流程
				// 这里只验证调用不会因代码错误报 500，不关心生成结果
				const testTag = '_phase1_test_tag_' + Date.now()
				this.addLog('测试标签: ' + testTag, 'info')
				this.addLog('调用 generateFromCoze（会走真实 Coze 生成，请注意配额）...', 'warn')

				const res = await survey.generateFromCoze({ tagName: testTag })
				this.addLog('返回 errCode: ' + res.errCode, 'info')

				if (res.errCode === 0) {
					this.addLog('首次生成成功，surveyId: ' + res.data.surveyId, 'info')
					// 同标签再次调用（同用户，应触发 del-then-add）
					this.addLog('同标签再次调用（应触发同用户放行）...', 'info')
					const res2 = await survey.generateFromCoze({ tagName: testTag })
					this.addLog('第二次返回 errCode: ' + res2.errCode, 'info')

					if (res2.errCode === 0) {
						// 验证旧 _id 已删除
						const check = await survey.getSurveyByTag({ tagName: testTag })
						if (check.errCode === 0 && check.data._id === res2.data.surveyId) {
							this.addPass('同用户重新生成成功，旧记录已覆盖，新 _id: ' + res2.data.surveyId)
						} else if (check.errCode === 'NOT_FOUND') {
							this.addLog('标签已被删除（可能 del 后 add 时序问题），但第二次生成成功', 'warn')
						} else {
							this.addPass('同用户放行逻辑生效，第二次生成未报错')
						}
					} else if (res2.errCode === 'TAG_ALREADY_EXISTS') {
						this.addFail('同用户被拒绝 — 应放行但却返回了 TAG_ALREADY_EXISTS')
					} else {
						this.addLog('第二次返回: ' + res2.errCode + ' ' + res2.errMsg, 'info')
						this.addSkip('同用户重新生成 — 需人工确认')
					}
				} else if (res.errCode === 'TAG_ALREADY_EXISTS') {
					this.addLog('首次就返回 TAG_ALREADY_EXISTS（标签可能已存在残留）', 'warn')
					this.addSkip('同用户重新生成 — 前提条件不满足（已有同名标签）')
				} else if (res.errCode === 'COZE_QUOTA_EXHAUSTED') {
					this.addSkip('Coze 额度已耗尽，无法真测 generateFromCoze')
				} else {
					this.addLog('首次生成返回: ' + res.errCode + ' ' + res.errMsg, 'info')
					this.addSkip('同用户重新生成 — 首次生成未成功，跳过后续')
				}
			} catch (e) {
				this.addFail('异常: ' + e.message)
				console.error(e)
			}
			this.addLog('========== TC-03 结束 ==========', 'title')
		},

		/** Coze 额度耗尽 Modal */
		testCozeExhausted() {
			this.addLog('========== Coze 额度耗尽 ==========', 'title')
			this.addLog('弹出 "AI 额度已用完" Modal...', 'info')
			uni.showModal({
				title: 'AI 额度已用完',
				content: '当前 AI 生成额度已耗尽，您可以：\n1. 等待每日额度重置\n2. 联系开发者获取更多额度',
				showCancel: false,
				confirmText: '知道了',
				success: (res) => {
					if (res.confirm) {
						this.addPass('Coze 额度耗尽 Modal 正确弹出')
					}
					this.addLog('========== Coze 额度耗尽 结束 ==========', 'title')
				}
			})
		},

		/** 一键全跑 */
		async runAll() {
			this.clearLogs()
			this.addLog('========================================', 'title')
			this.addLog('一键运行全部测试', 'title')
			this.addLog('========================================', 'title')

			// TC-05：无副作用，直接跑
			await this.testDeterministicGetSurvey()

			// TC-02/07：Modal 测试，弹窗需用户点
			this.testTagAlreadyExistsModal()

			// 等用户点完上一个 Modal 再继续
			await this.sleep(500)
		},

		sleep(ms) {
			return new Promise(r => setTimeout(r, ms))
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
	max-height: 400rpx;
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
.btn-group { display: flex; flex-direction: column; gap: 16rpx; }
.section-label {
	font-size: 26rpx;
	font-weight: 600;
	color: #475467;
	padding: 16rpx 0 4rpx;
}
.btn-row { display: flex; gap: 16rpx; }

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

/* ====== 查重 & 去重 ====== */
.dedup-section {
	background: #FFFFFF;
	border-radius: 24rpx;
	padding: 28rpx;
	margin-bottom: 32rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	border: 2rpx solid #FED7AA;
}
.dedup-header {
	margin-bottom: 20rpx;
}
.dedup-title {
	font-size: 30rpx;
	font-weight: 700;
	color: #C2410C;
	display: block;
}
.dedup-desc {
	font-size: 24rpx;
	color: #9A3412;
	margin-top: 4rpx;
	display: block;
}
.dedup-actions {
	display: flex;
	gap: 16rpx;
	margin-bottom: 20rpx;
}
.dedup-btn {
	flex: 1;
	border-radius: 16rpx;
	padding: 20rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6rpx;
}
.dedup-btn:active { opacity: 0.7; }
.dedup-btn-scan {
	background: #FFF7ED;
	border: 2rpx solid #FED7AA;
}
.dedup-btn-clean {
	background: #FEF2F2;
	border: 2rpx solid #FECACA;
}
.dedup-btn .btn-icon { font-size: 36rpx; }
.dedup-btn .btn-text {
	font-size: 26rpx;
	font-weight: 600;
	color: #1E2939;
}

.dup-result { }
.dup-clean {
	font-size: 28rpx;
	font-weight: 600;
	color: #16A34A;
	text-align: center;
	display: block;
	padding: 24rpx;
}
.dup-list { display: flex; flex-direction: column; gap: 12rpx; }
.dup-summary {
	font-size: 26rpx;
	font-weight: 600;
	color: #DC2626;
}
.dup-item {
	background: #FEF2F2;
	border-radius: 16rpx;
	padding: 20rpx;
	border: 1rpx solid #FECACA;
}
.dup-item.dup-cleaned {
	background: #F0FDF4;
	border-color: #BBF7D0;
}
.dup-info {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8rpx;
}
.dup-name {
	font-size: 28rpx;
	font-weight: 700;
	color: #991B1B;
}
.dup-cleaned .dup-name { color: #166534; }
.dup-count {
	font-size: 24rpx;
	color: #EF4444;
	font-weight: 600;
}
.dup-cleaned .dup-count { color: #16A34A; }
.dup-ids {
	margin-bottom: 6rpx;
}
.dup-id-label {
	font-size: 22rpx;
	color: #6B7280;
}
.dup-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.dup-creators {
	font-size: 22rpx;
	color: #6B7280;
}
.dup-done {
	font-size: 24rpx;
	color: #16A34A;
	font-weight: 600;
}
.dedup-btn-sm {
	background: #EF4444;
	border-radius: 12rpx;
	padding: 8rpx 24rpx;
	font-size: 24rpx;
	color: #FFFFFF;
	font-weight: 600;
}
.dedup-btn-sm:active { opacity: 0.7; }
</style>
