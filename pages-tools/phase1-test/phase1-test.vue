<!-- 阶段一验收测试页 -->
<template>
	<view class="page">
		<view class="header">
			<text class="title">阶段一验收测试</text>
			<text class="subtitle">广告 Modal + Coze 额度耗尽</text>
		</view>

		<!-- 测试结果日志 -->
		<view class="log-panel">
			<view class="log-header">
				<text class="log-title">运行日志</text>
				<text class="log-clear" @click="logs = []">清空</text>
			</view>
			<scroll-view class="log-body" scroll-y :scroll-top="logScrollTop">
				<view v-for="(log, i) in logs" :key="i" :class="'log-line log-' + log.type">
					<text class="log-time">{{ log.time }}</text>
					<text class="log-msg">{{ log.msg }}</text>
				</view>
				<view v-if="logs.length === 0" class="log-empty">点击下方按钮开始测试</view>
			</scroll-view>
		</view>

		<!-- 测试按钮区 -->
		<view class="btn-group">
			<text class="section-label">场景 1：广告 Modal（生成问卷路径，无 surveyId）</text>
			<view class="btn-row">
				<view class="test-btn" @click="testPlayAdNoSurveyId">
					<text class="btn-icon">📋</text>
					<text class="btn-text">playAd() 无参调用</text>
					<text class="btn-hint">应弹 Modal "广告功能尚未实装"</text>
				</view>
			</view>

			<text class="section-label">场景 2：广告 Modal（置顶路径，有 surveyId）</text>
			<view class="btn-row">
				<view class="test-btn" @click="testPlayAdWithSurveyId">
					<text class="btn-icon">📌</text>
					<text class="btn-text">playAd('mock-survey-123')</text>
					<text class="btn-hint">先 pin 检查（会失败），验证错误处理</text>
				</view>
			</view>

			<text class="section-label">场景 3：Coze 额度耗尽 Modal</text>
			<view class="btn-row">
				<view class="test-btn" @click="testCozeExhausted">
					<text class="btn-icon">⚠️</text>
					<text class="btn-text">模拟 COZE_QUOTA_EXHAUSTED</text>
					<text class="btn-hint">直接弹 "AI 额度已用完" Modal</text>
				</view>
			</view>

			<text class="section-label">场景 4：动态导入 ad-utils（search-page 同款写法）</text>
			<view class="btn-row">
				<view class="test-btn" @click="testDynamicImport">
					<text class="btn-icon">🔄</text>
					<text class="btn-text">动态 import('@/common/ad-utils.js')</text>
					<text class="btn-hint">验证 search-page 中的导入路径可用</text>
				</view>
			</view>

			<text class="section-label">快捷：一键全跑</text>
			<view class="btn-row">
				<view class="test-btn test-btn-all" @click="testAll">
					<text class="btn-icon">🚀</text>
					<text class="btn-text">一键运行全部测试</text>
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
			logScrollTop: 0
		}
	},
	methods: {
		addLog(msg, type) {
			const now = new Date()
			const time = now.getHours().toString().padStart(2, '0') + ':' +
				now.getMinutes().toString().padStart(2, '0') + ':' +
				now.getSeconds().toString().padStart(2, '0')
			this.logs.push({ time, msg, type: type || 'info' })
			this.$nextTick(() => {
				this.logScrollTop = 99999
			})
		},

		/** 场景 1：无 surveyId 调用 playAd */
		async testPlayAdNoSurveyId() {
			this.addLog('========== 场景1 开始 ==========', 'title')
			try {
				const { playAd } = await import('@/common/ad-utils.js')
				this.addLog('playAd 导入成功', 'ok')
				this.addLog('调用 playAd() 无参数（模拟生成问卷路径）...', 'info')
				const result = await playAd()
				if (result === null) {
					this.addLog('用户点击了取消 → 返回 null ✓', 'warn')
				} else if (result && result.adPassed) {
					this.addLog('用户点击了确认 → 返回 { adPassed: true } ✓', 'ok')
				} else {
					this.addLog('意外返回值: ' + JSON.stringify(result), 'err')
				}
			} catch (e) {
				this.addLog('异常: ' + e.message, 'err')
				console.error(e)
			}
			this.addLog('========== 场景1 结束 ==========', 'title')
		},

		/** 场景 2：有 surveyId 调用 playAd */
		async testPlayAdWithSurveyId() {
			this.addLog('========== 场景2 开始 ==========', 'title')
			try {
				const { playAd } = await import('@/common/ad-utils.js')
				this.addLog('playAd 导入成功', 'ok')
				this.addLog('调用 playAd("mock-survey-123")（模拟置顶路径）...', 'info')
				this.addLog('预期：先调 pin-system 检查（mock ID 会失败），应有错误提示', 'info')
				const result = await playAd('mock-survey-123')
				if (result === null) {
					this.addLog('返回 null（pin 检查失败或用户取消） ✓', 'warn')
				} else {
					this.addLog('返回: ' + JSON.stringify(result), 'ok')
				}
			} catch (e) {
				this.addLog('异常: ' + e.message, 'err')
				console.error(e)
			}
			this.addLog('========== 场景2 结束 ==========', 'title')
		},

		/** 场景 3：模拟 Coze 额度耗尽 */
		testCozeExhausted() {
			this.addLog('========== 场景3 开始 ==========', 'title')
			this.addLog('弹出 "AI 额度已用完" Modal...', 'info')
			uni.showModal({
				title: 'AI 额度已用完',
				content: '当前 AI 生成额度已耗尽，您可以：\n1. 等待每日额度重置\n2. 联系开发者获取更多额度',
				showCancel: false,
				confirmText: '知道了',
				success: (res) => {
					if (res.confirm) {
						this.addLog('用户点击了「知道了」 → Modal 关闭 ✓', 'ok')
					}
					this.addLog('========== 场景3 结束 ==========', 'title')
				}
			})
		},

		/** 场景 4：验证动态导入路径 */
		async testDynamicImport() {
			this.addLog('========== 场景4 开始 ==========', 'title')
			try {
				const module = await import('@/common/ad-utils.js')
				this.addLog('动态导入成功', 'ok')
				if (typeof module.playAd === 'function') {
					this.addLog('playAd 是函数 ✓', 'ok')
				} else {
					this.addLog('playAd 不是函数: ' + typeof module.playAd, 'err')
				}
				// 不实际调用 playAd，只验证导入可用
				const exports = Object.keys(module).join(', ')
				this.addLog('模块导出: ' + exports, 'info')
			} catch (e) {
				this.addLog('动态导入失败: ' + e.message, 'err')
				console.error(e)
			}
			this.addLog('========== 场景4 结束 ==========', 'title')
		},

		/** 一键全跑 */
		async testAll() {
			this.addLog('========================================', 'title')
			this.addLog('一键运行全部测试', 'title')
			this.addLog('========================================', 'title')
			// 场景 4 先跑（不需要用户交互）
			await this.testDynamicImport()
			// 场景 1（需要用户点 Modal 确认/取消）
			await this.testPlayAdNoSurveyId()
			// 场景 2
			await this.testPlayAdWithSurveyId()
			// 场景 3（需要用户点 Modal）
			await this.testCozeExhausted()
			this.addLog('========================================', 'title')
			this.addLog('全部测试完成！请检查上方日志', 'ok')
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
	margin-bottom: 32rpx;
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
.log-clear {
	font-size: 24rpx;
	color: #667085;
	padding: 4rpx 16rpx;
}
.log-body {
	max-height: 480rpx;
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
.test-btn:active {
	opacity: 0.7;
	transform: scale(0.97);
}
.test-btn-all {
	background: #1D2939;
}
.test-btn-all .btn-icon { color: #FFF; }
.test-btn-all .btn-text { color: #F2F4F7; }
.test-btn-all .btn-hint { color: #667085; }

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
</style>
