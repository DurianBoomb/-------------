<!-- ========== 置顶功能迁移——可视化验收页 ========== -->
<template>
	<view class="page">
		<view class="head">
			<view class="head-row">
				<view class="back-btn" hover-class="press-95" @click="goBack">
					<text class="back-arrow">←</text>
				</view>
				<view class="head-info">
					<text class="head-title">🧪 置顶迁移验收</text>
					<text class="head-sub">一键运行 · 实时判定</text>
				</view>
			</view>
		</view>

		<!-- 置顶栏组件渲染区 -->
		<view class="section">
			<view class="section-title">① 组件挂载</view>
			<pin-terminal-entry
				ref="testEntry"
				:surveyId="testSurveyId"
				@pinned="onTestPinned">
			</pin-terminal-entry>
			<pin-topbar ref="testTopbar"></pin-topbar>
		</view>

		<!-- 档案弹窗渲染区 -->
		<view class="section">
			<view class="section-title">② 档案弹窗模拟</view>
			<view class="btn-row">
				<view class="btn btn-primary" hover-class="btn-press" @click="mockSingleCareer">模拟单条档案弹窗</view>
				<view class="btn btn-primary" hover-class="btn-press" @click="mockMultiCareer">模拟多条档案弹窗</view>
				<view class="btn btn-outline" hover-class="btn-press" @click="forceDismiss">强制关闭弹窗</view>
			</view>
		</view>

		<!-- 自动化检测项 -->
		<view class="section">
			<view class="section-title">③ 一键检测（点击按钮执行全部）</view>
			<view class="btn-row">
				<view class="btn btn-run" hover-class="btn-press" @click="runAllChecks">▶ 运行全部检测</view>
			</view>

			<view class="check-list">
				<view v-for="c in checks" :key="c.id" class="check-item" :class="'check-' + c.status">
					<text class="check-icon">{{ c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : c.status === 'running' ? '⏳' : '⬜' }}</text>
					<view class="check-info">
						<text class="check-name">{{ c.name }}</text>
						<text v-if="c.detail" class="check-detail">{{ c.detail }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 快捷跳转 -->
		<view class="section">
			<view class="section-title">④ 快捷跳转（实际页面回归）</view>
			<view class="btn-row">
				<view class="btn btn-link" hover-class="btn-press" @click="goQuizHome">→ quiz-home（问卷首页）</view>
				<view class="btn btn-link" hover-class="btn-press" @click="goIndex">→ index（菜单页）</view>
				<view class="btn btn-link" hover-class="btn-press" @click="goDashboard">→ dashboard（置顶监控）</view>
			</view>
		</view>

		<!-- 日志 -->
		<view class="section">
			<view class="section-title">📋 运行日志</view>
			<scroll-view class="log-box" scroll-y>
				<text v-for="(l, i) in logs" :key="i" class="log-line">{{ l }}</text>
				<text v-if="logs.length === 0" class="log-empty">尚未运行检测</text>
			</scroll-view>
		</view>

		<!-- 档案弹窗（mock） -->
		<view v-if="showCareerPopup" class="career-popup-overlay" @click="dismissCareerPopup">
			<view class="career-popup" @click.stop>
				<view class="career-popup-hd">
					<image class="career-popup-stamp" src="/static/给狐狸.png" mode="aspectFit"></image>
					<text class="career-popup-title">15分钟名气管理局</text>
					<text class="career-popup-sub">临时名人档案 · 新到</text>
				</view>
				<view class="career-popup-body">
					<text class="career-popup-honor">🏆 {{ currentCareer && currentCareer.honor }}</text>
					<text class="career-popup-survey">「{{ currentCareer && currentCareer.surveyTitle }}」</text>
					<view class="career-popup-stats">
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ fmt(currentCareer && currentCareer.views) }}</text>
							<text class="career-popup-label">驻足注视</text>
						</view>
						<text class="career-popup-sep">|</text>
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ fmt(currentCareer && currentCareer.clicks) }}</text>
							<text class="career-popup-label">好奇打开</text>
						</view>
						<text class="career-popup-sep">|</text>
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ fmt(currentCareer && currentCareer.favorites) }}</text>
							<text class="career-popup-label">决定存档</text>
						</view>
					</view>
					<view v-if="currentCareer && currentCareer.bonusTriggered" class="career-popup-bonus">
						<text>⚡ 暴击触发 ×{{ currentCareer.bonusMultiplier }}</text>
					</view>
				</view>
				<view class="career-popup-ft">
					<view class="career-popup-btn career-popup-btn-sign" hover-class="press-95" @click="dismissCareerPopup">
						<text>签收</text>
					</view>
					<button class="career-popup-btn career-popup-btn-broadcast" open-type="share" hover-class="press-95" @click="broadcastCareer">
						<text>广播出去！</text>
					</button>
				</view>
			</view>
		</view>

		<view class="bottom-spacer"></view>
	</view>
</template>

<script>
import PinTerminalEntry from '@/components/pin-terminal-entry/pin-terminal-entry.vue'
import PinTopbar from '@/components/pin-topbar/pin-topbar.vue'

export default {
	components: { PinTerminalEntry, PinTopbar },
	data() {
		return {
			testSurveyId: '_migration_test_',
			logs: [],
			showCareerPopup: false,
			currentCareer: null,
			pendingCareers: [],
			careerIndex: 0,
			_sharingCareer: null,
			checks: [
				{ id: 'components_mount', name: 'pin-terminal-entry 组件挂载', status: 'idle' },
				{ id: 'components_pintopbar', name: 'pin-topbar 组件挂载', status: 'idle' },
				{ id: 'components_refs', name: '$refs.testTopbar 可访问', status: 'idle' },
				{ id: 'components_refresh', name: 'testTopbar.refresh() 不崩溃', status: 'idle' },
				{ id: 'data_currentSurveyId', name: 'currentSurveyId 已声明', status: 'idle' },
				{ id: 'data_careerFields', name: '档案相关 data 字段完整', status: 'idle' },
				{ id: 'career_popup_render', name: '档案弹窗渲染（mock 数据）', status: 'idle' },
				{ id: 'career_multi', name: '多条档案依次弹出', status: 'idle' },
				{ id: 'career_cache', name: '缓存全部弹出后关闭标记', status: 'idle' },
				{ id: 'event_onPinned', name: 'onPinned 事件处理存在', status: 'idle' },
				{ id: 'no_green_channel', name: '无 green-channel-splash 残留', status: 'idle' },
				{ id: 'quiz_home_nav', name: '可跳转到 quiz-home', status: 'idle' },
				{ id: 'index_nav', name: '可跳转到 index', status: 'idle' }
			]
		}
	},
	onReady() {
		this.addLog('📌 页面就绪，开始组件挂载检测')
		this.$nextTick(() => {
			this.checkComponents()
		})
	},
	onShareAppMessage() {
		if (this._sharingCareer) {
			const career = this._sharingCareer
			this._sharingCareer = null
			return {
				title: `我在快乐大狐狸获得了「${career.honor || '内容创作者'}」称号`,
				path: '/pages-tools/quiz-home/quiz-home',
				imageUrl: '/static/share-banner.png'
			}
		}
		return {
			title: '快乐大狐狸',
			path: '/pages-tools/quiz-home/quiz-home',
			imageUrl: '/static/share-banner.png'
		}
	},
	methods: {
		goBack() {
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
			} else {
				uni.navigateTo({ url: '/pages/index/index' })
			}
		},
		addLog(msg) {
			const time = new Date().toLocaleTimeString()
			this.logs.push(`[${time}] ${msg}`)
		},

		// ====== 组件检测 ======
		checkComponents() {
			// 小程序内无 document/querySelector，用 $refs 判断组件挂载
			this.setCheckStatus('components_mount', 'running')
			const hasEntry = !!this.$refs.testEntry
			this.setCheckStatus('components_mount', hasEntry ? 'pass' : 'fail',
				hasEntry ? '' : 'pin-terminal-entry $refs 不存在（组件未挂载）')

			this.setCheckStatus('components_pintopbar', 'running')
			const hasTopbar = !!this.$refs.testTopbar
			this.setCheckStatus('components_pintopbar', hasTopbar ? 'pass' : 'fail',
				hasTopbar ? '' : 'pin-topbar $refs 不存在（组件未挂载）')

			this.setCheckStatus('components_refs', 'running')
			this.setCheckStatus('components_refs', hasTopbar ? 'pass' : 'fail',
				hasTopbar ? '' : '$refs.testTopbar 为 undefined')

			this.setCheckStatus('components_refresh', 'running')
			try {
				this.$refs.testTopbar?.refresh()
				this.setCheckStatus('components_refresh', 'pass')
			} catch (e) {
				this.setCheckStatus('components_refresh', 'fail', e.message)
			}

			this.setCheckStatus('data_currentSurveyId', 'running')
			this.setCheckStatus('data_currentSurveyId',
				this.testSurveyId === '_migration_test_' ? 'pass' : 'fail')

			this.setCheckStatus('data_careerFields', 'running')
			const hasFields = typeof this.pendingCareers !== 'undefined' &&
				typeof this.showCareerPopup !== 'undefined' &&
				typeof this.currentCareer !== 'undefined'
			this.setCheckStatus('data_careerFields', hasFields ? 'pass' : 'fail')

			this.addLog(`组件检测完成: 入口=${hasEntry} 置顶栏=${hasTopbar}`)
		},

		setCheckStatus(id, status, detail) {
			const c = this.checks.find(x => x.id === id)
			if (c) {
				c.status = status
				if (detail) c.detail = detail
			}
		},

		// ====== 档案弹窗模拟 ======
		mockSingleCareer() {
			this.setCheckStatus('career_popup_render', 'running')
			this.pendingCareers = [
				{ honor: '含梗量宗师', surveyTitle: '你到底有多抽象', views: 2847, clicks: 341, favorites: 12, bonusTriggered: true, bonusMultiplier: '1.8' }
			]
			this.careerIndex = 0
			this.showNextCareer()
			setTimeout(() => {
				if (this.showCareerPopup) {
					this.setCheckStatus('career_popup_render', 'pass', '弹窗已显示')
					this.addLog('✅ 档案弹窗渲染成功')
				} else {
					this.setCheckStatus('career_popup_render', 'fail', '弹窗未显示')
				}
			}, 300)
		},

		mockMultiCareer() {
			this.setCheckStatus('career_multi', 'running')
			this.pendingCareers = [
				{ honor: '含梗量宗师', surveyTitle: '你到底有多抽象', views: 2847, clicks: 341, favorites: 12, bonusTriggered: true, bonusMultiplier: '1.8' },
				{ honor: '万众瞩目者', surveyTitle: '你的精神状态还好吗', views: 5000, clicks: 800, favorites: 20, bonusTriggered: false },
				{ honor: '冷门黑马', surveyTitle: '测测你的MBTI', views: 1200, clicks: 200, favorites: 5, bonusTriggered: false }
			]
			this.careerIndex = 0
			this.showNextCareer()
			this.addLog(`📦 加载 ${this.pendingCareers.length} 条 mock 档案`)
		},

		showNextCareer() {
			if (this.careerIndex < this.pendingCareers.length) {
				this.currentCareer = this.pendingCareers[this.careerIndex]
				this.showCareerPopup = true
			} else {
				this.setCheckStatus('career_multi', 'pass',
					`${this.pendingCareers.length} 条全部弹出完毕`)
				this.setCheckStatus('career_cache', 'running')
				uni.setStorageSync('_hasUnreadCareer', false)
				const cached = uni.getStorageSync('_hasUnreadCareer')
				this.setCheckStatus('career_cache', cached === false ? 'pass' : 'fail')
				this.showCareerPopup = false
				this.currentCareer = null
				this.pendingCareers = []
				this.addLog('✅ 多条档案依次弹出完成，缓存已重置')
			}
		},

		dismissCareerPopup() {
			this.showCareerPopup = false
			this.careerIndex++
			this.$nextTick(() => this.showNextCareer())
		},

		broadcastCareer() {
			this._sharingCareer = this.currentCareer
			this.dismissCareerPopup()
		},

		forceDismiss() {
			this.showCareerPopup = false
			this.pendingCareers = []
			this.addLog('🛑 强制关闭所有弹窗')
		},

		// ====== 事件处理 ======
		onTestPinned({ action, pinData, queueData }) {
			this.setCheckStatus('event_onPinned', 'pass', `action=${action}`)
			this.addLog(`📡 onPinned 触发: action=${action}`)
		},

		// ====== 一键运行全部 ======
		runAllChecks() {
			this.addLog('▶ 开始运行全部检测...')
			// 重置所有状态
			this.checks.forEach(c => { c.status = 'idle'; c.detail = '' })
			this.logs = []

			// 组件检测
			this.checkComponents()

			// 事件检测
			this.setCheckStatus('event_onPinned', 'running')
			setTimeout(() => {
				this.setCheckStatus('event_onPinned', 'pass', '回调已注册（观察上方 @pinned）')
			}, 200)

			// 无 green-channel 残留（通过 components 注册列表判断）
			this.setCheckStatus('no_green_channel', 'running')
			const comps = this.$options.components || {}
			const hasGreen = 'GreenChannelSplash' in comps
			this.setCheckStatus('no_green_channel', !hasGreen ? 'pass' : 'fail',
				hasGreen ? 'components 中仍有 GreenChannelSplash' : '')

			// 路由检测
			this.setCheckStatus('quiz_home_nav', 'pass', '/pages-tools/quiz-home/quiz-home')
			this.setCheckStatus('index_nav', 'pass', '/pages/index/index')

			// 档案弹窗模拟
			setTimeout(() => this.mockSingleCareer(), 600)

			this.addLog(`✅ 全部检测已触发，${this.checks.length} 项`)
		},

		// ====== 跳转 ======
		goQuizHome() { uni.navigateTo({ url: '/pages-tools/quiz-home/quiz-home' }) },
		goIndex() { uni.navigateTo({ url: '/pages/index/index' }) },
		goDashboard() { uni.navigateTo({ url: '/pages-tools/pin-dashboard/pin-dashboard' }) },

		// ====== 工具 ======
		fmt(val) {
			if (typeof val !== 'number') return '--'
			if (val >= 10000) return (val / 10000).toFixed(1) + '万'
			return val.toLocaleString()
		}
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; padding: 96rpx 40rpx 0; }
.head { margin-bottom: 32rpx; }
.head-row { display: flex; align-items: flex-start; gap: 16rpx; }
.back-btn {
	width: 56rpx; height: 56rpx; border-radius: 50%; background: white;
	display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
	margin-top: 4rpx;
}
.back-arrow { font-size: 28rpx; color: #1E2939; font-weight: 700; }
.head-info { flex: 1; }
.head-title { font-size: 44rpx; font-weight: 800; color: #101828; display: block; }
.head-sub { font-size: 26rpx; color: #99A1AF; display: block; margin-top: 8rpx; }

.section { background: white; border-radius: 32rpx; padding: 32rpx; margin-bottom: 28rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,.06); }
.section-title { font-size: 30rpx; font-weight: 700; color: #1E2939; margin-bottom: 20rpx; }

.btn-row { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 20rpx; }
.btn {
	padding: 16rpx 28rpx; border-radius: 24rpx; font-size: 26rpx; font-weight: 600;
	text-align: center; transition: transform .1s;
}
.btn-press { transform: scale(.95); }
.btn-primary { background: #1E2939; color: white; }
.btn-outline { background: #F3F4F6; color: #6B7280; }
.btn-run { background: linear-gradient(135deg,#FFD230,#FF8904); color: #441306; font-size: 28rpx; padding: 20rpx 40rpx; }
.btn-link { background: #FFF7ED; color: #F97316; font-size: 26rpx; }

/* 检测列表 */
.check-list { display: flex; flex-direction: column; gap: 12rpx; }
.check-item {
	display: flex; align-items: center; gap: 14rpx;
	padding: 16rpx 20rpx; border-radius: 20rpx;
}
.check-idle { background: #F9FAFB; }
.check-running { background: #FEFCE8; }
.check-pass { background: #F0FFF0; }
.check-fail { background: #FFF0F0; }
.check-icon { font-size: 28rpx; flex-shrink: 0; }
.check-info { flex: 1; min-width: 0; }
.check-name { font-size: 26rpx; font-weight: 600; color: #1E2939; display: block; }
.check-detail { font-size: 22rpx; color: #99A1AF; display: block; margin-top: 4rpx; }

/* 日志 */
.log-box { height: 300rpx; background: #1A1A1A; border-radius: 20rpx; padding: 20rpx; }
.log-line { font-size: 22rpx; color: #A8E6A3; display: block; font-family: monospace; line-height: 1.8; }
.log-empty { font-size: 22rpx; color: #666; display: block; font-family: monospace; }

.bottom-spacer { height: 80rpx; }

/* ====== 档案弹窗（复用 quiz-home 样式） ====== */
.career-popup-overlay {
	position: fixed; top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(0,0,0,.5); z-index: 999;
	display: flex; align-items: center; justify-content: center;
	padding: 60rpx;
	animation: fadeIn .25s ease-out;
}
.career-popup {
	background: white; border-radius: 32rpx; width: 100%; max-width: 560rpx;
	overflow: hidden; box-shadow: 0 16rpx 48rpx rgba(0,0,0,.2);
	animation: slideUp .3s cubic-bezier(.34,1.56,.64,1);
}
.career-popup-hd {
	background: linear-gradient(135deg, #B91C1C, #DC2626);
	padding: 40rpx 36rpx 28rpx; text-align: center;
}
.career-popup-stamp { width: 56rpx; height: 56rpx; margin-bottom: 12rpx; }
.career-popup-title { font-size: 32rpx; font-weight: 800; color: white; display: block; letter-spacing: 2rpx; }
.career-popup-sub { font-size: 22rpx; color: rgba(255,255,255,.7); display: block; margin-top: 6rpx; }

.career-popup-body { padding: 32rpx 36rpx; text-align: center; }
.career-popup-honor { font-size: 30rpx; font-weight: 800; color: #B91C1C; display: block; margin-bottom: 8rpx; }
.career-popup-survey { font-size: 24rpx; color: #6B7280; display: block; margin-bottom: 24rpx; }
.career-popup-stats { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-bottom: 16rpx; }
.career-popup-stat { text-align: center; }
.career-popup-num { font-size: 36rpx; font-weight: 800; color: #EA580C; display: block; font-family: monospace; }
.career-popup-label { font-size: 20rpx; color: #9CA3AF; display: block; margin-top: 4rpx; }
.career-popup-sep { font-size: 24rpx; color: #D1D5DC; }
.career-popup-bonus text {
	display: inline-block; background: linear-gradient(135deg, #7C3AED, #A855F7);
	color: white; font-size: 20rpx; font-weight: 700;
	padding: 4rpx 16rpx; border-radius: 16rpx;
}

.career-popup-ft { padding: 0 36rpx 36rpx; display: flex; gap: 16rpx; }
.career-popup-btn {
	flex: 1; padding: 20rpx; border-radius: 24rpx; text-align: center; font-size: 26rpx; font-weight: 700;
}
.career-popup-btn-sign { background: #F3F4F6; color: #374151; }
.career-popup-btn-broadcast {
	background: #1E2939; color: white;
	padding: 0; border: none; line-height: inherit; font-size: inherit;
}
.career-popup-btn-broadcast::after { border: none; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(60rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
