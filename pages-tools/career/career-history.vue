<!-- ========== 历史档案页（阶段四：三槽位管理台 + 候场交互） ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">历史档案</text>
				<text class="hd-capacity">{{ usedSlots }} / 3</text>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<!-- ====== 上半：三槽位管理台 ====== -->
				<view class="section-title">🛸 置顶管理台</view>
				<view class="slots-row">
					<view v-for="(slot, idx) in slotList" :key="idx"
						class="slot-card" :class="'slot-' + slot.status"
						hover-class="press-95" @click="onSlotTap(slot, idx)">
						<view class="slot-icon">
							<text>{{ slotIcons[slot.status] || '⚪' }}</text>
						</view>
						<text class="slot-status">{{ slotLabels[slot.status] || slot.status }}</text>
						<u-count-down
							v-if="slot.status === 'active' && slot.countdownTime > 0"
							:time="slot.countdownTime"
							format="mm:ss"
							:auto-start="true"
							@finish="onCountdownFinish"
							class="slot-countdown"
						/>
						<text v-else class="slot-desc">{{ slot.desc || '' }}</text>
					</view>
				</view>

				<!-- ====== 下半：历史档案列表 ====== -->
				<view class="section-title" style="margin-top: 40rpx;">📂 我的档案</view>

				<!-- 置顶生涯综述卡片 -->
				<view class="overview-card">
					<view class="overview-stats">
						<view class="overview-item">
							<text class="overview-num">{{ careerTotal }}</text>
							<text class="overview-label">认证次数</text>
						</view>
						<view class="overview-item">
							<text class="overview-num">{{ formatNum(summary.totalViews) }}</text>
							<text class="overview-label">累计注视</text>
						</view>
						<view class="overview-item">
							<text class="overview-num">{{ formatNum(summary.totalClicks) }}</text>
							<text class="overview-label">累计打开</text>
						</view>
						<view class="overview-item">
							<text class="overview-num">{{ formatNum(summary.totalFavs) }}</text>
							<text class="overview-label">累计存档</text>
						</view>
					</view>
					<text class="overview-comment">{{ summary.oneLiner }}</text>
				</view>

				<!-- 空状态 -->
				<view v-if="careerTotal === 0 && !loadingCareers" class="empty-state">
					<text class="empty-icon">📋</text>
					<text class="empty-txt">暂无历史档案</text>
					<text class="empty-sub">置顶过的问卷到期后，战绩单会出现在这里</text>
				</view>

				<!-- 加载态 -->
				<view v-if="loadingCareers" class="empty-state">
					<text class="empty-txt">加载中...</text>
				</view>

				<!-- 档案手风琴列表 -->
				<view v-if="careerTotal > 0" class="accordion-list">
					<view v-for="(group, gi) in careerGroups" :key="gi" class="accordion-group">
						<!-- 主标签 -->
						<view class="accordion-header" hover-class="press-95" @click="toggleGroup(gi)">
							<view class="accordion-header-left">
								<text class="accordion-title">{{ group.surveyTitle }}</text>
								<text class="accordion-count">共 {{ group.records.length }} 条</text>
							</view>
							<view class="accordion-header-right">
								<text class="accordion-latest">最近：{{ formatShortDate(group.latestAt) }}</text>
								<text class="accordion-arrow" :class="{ expanded: group.expanded }">›</text>
							</view>
						</view>

						<!-- 子标签列表 -->
						<view v-if="group.expanded" class="accordion-body">
							<view
								v-for="(rec, ri) in group.records"
								:key="rec.careerId || ri"
								class="accordion-item"
								:class="{ 'item-bonus': rec.bonusTriggered }"
								hover-class="press-95"
								@click="goDetail(rec.careerId)"
							>
								<view class="item-left">
									<text class="item-date">{{ formatDate(rec.createdAt) }}</text>
									<view class="item-honor-row">
										<text class="item-honor">🏅 {{ (rec.honor && rec.honor.name) || '内容创作者' }}</text>
										<text v-if="rec.pinType === 'promote'" class="item-tag item-tag-promote">推广</text>
										<text v-if="rec.careerNumber === 1" class="item-tag item-tag-debut">首秀</text>
										<text v-if="rec.bonusTriggered" class="item-tag item-tag-bonus">破格</text>
									</view>
								</view>
								<view class="item-right">
									<text class="item-views">{{ formatNum(rec.stats && rec.stats.views) }}</text>
									<text class="item-views-label">注视</text>
									<text class="item-arrow">›</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>

		<!-- 候场终端半屏面板 -->
		<QueueTerminal
			:visible="terminalVisible"
			:queueId="terminalQueueId"
			@close="terminalVisible = false"
			@completed="onQueueCompleted"
		/>
	</view>
</template>

<script>
import QueueTerminal from '@/components/queue-terminal/queue-terminal.vue'

export default {
	components: { QueueTerminal },
	data() {
		return {
			_pollTimer: null,
			slots: [],
			pinPool: [],
			queueRecords: [],
			careerTotal: 0,
			careerRecords: [],
			loadingCareers: false,
			terminalVisible: false,
			terminalQueueId: '',
			slotIcons: { idle: '⚪', queuing: '⏳', active: '🟢', claimable: '📜' },
			slotLabels: { idle: '闲置', queuing: '候场中', active: '置顶中', claimable: '待签收' }
		}
	},
	computed: {
		slotList() {
			const raw = this.slots.length === 3 ? this.slots : [
				{ status: 'idle', surveyId: null, pinId: null, queueId: null },
				{ status: 'idle', surveyId: null, pinId: null, queueId: null },
				{ status: 'idle', surveyId: null, pinId: null, queueId: null }
			]
			return raw.map((s, idx) => {
				const item = { ...s, idx }
				if (s.status === 'queuing') {
					const q = this.queueRecords.find(r => r.queueId === s.queueId)
					item.desc = q ? `处理中 · ${q.currentPhase || 'queuing'}` : '候场中'
				} else if (s.status === 'active') {
					const pin = this.pinPool.find(p => p._id === s.pinId)
					if (pin && pin.expireAt) {
						const remainMs = pin.expireAt - Date.now()
						// countdownTime 传给 u-count-down，组件内部基于绝对时间戳，
						// 每 ~30ms 算一次 endTime - Date.now()，实现平滑递减
						item.countdownTime = Math.max(0, remainMs)
						item.desc = remainMs > 0 ? this.formatMMSS(Math.floor(remainMs / 1000)) : '即将结束'
					} else {
						item.countdownTime = 0
						item.desc = '置顶中'
					}
				} else if (s.status === 'claimable') {
					item.desc = '点击查看战绩'
				} else {
					item.desc = '空闲中'
				}
				return item
			})
		},
		usedSlots() {
			return this.slotList.filter(s => s.status !== 'idle').length
		},

		// 按 surveyTitle 分组，按最新记录倒序
		careerGroups() {
			const groups = {}
			for (const rec of this.careerRecords) {
				const key = rec.surveyTitle || '未知问卷'
				if (!groups[key]) { groups[key] = { surveyTitle: key, records: [], latestAt: 0, expanded: false } }
				groups[key].records.push(rec)
				if (rec.createdAt > groups[key].latestAt) groups[key].latestAt = rec.createdAt
			}
			const arr = Object.values(groups)
			arr.forEach(g => g.records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
			arr.sort((a, b) => b.latestAt - a.latestAt)
			return arr
		},

		// 生涯统计
		summary() {
			let totalViews = 0, totalClicks = 0, totalFavs = 0
			for (const rec of this.careerRecords) {
				totalViews += rec.stats?.views || 0
				totalClicks += rec.stats?.clicks || 0
				totalFavs += rec.stats?.favorites || 0
			}
			const audience = totalViews
			let oneLiner = ''
			if (audience >= 100000) oneLiner = '你的问卷累计被世界注视过 ' + this.formatNum(audience) + ' 次，相当于一场大型演唱会的观众人数。本局对此表示认可。'
			else if (audience >= 10000) oneLiner = '你的问卷累计被世界注视过 ' + this.formatNum(audience) + ' 次，相当于一座小型体育馆的观众数。'
			else if (audience >= 1000) oneLiner = '你的问卷累计被世界注视过 ' + this.formatNum(audience) + ' 次，已经超过一个班级的人数啦。'
			else oneLiner = '你的每一份档案都在积累，万丈高楼从地起。'
			return { totalViews, totalClicks, totalFavs, oneLiner }
		}
	},
	onLoad() { this.refresh(); this.startPolling() },
	onShow() { this.refresh() },
	onHide() { this.stopPolling() },
	onUnload() { this.stopPolling() },
	methods: {
		async refresh() {
			try {
				const ps = uniCloud.importObject('pin-system')
				const seniorityRes = await ps.getSeniority()
				const queueRes = await ps.getQueueStatus({})
				this.queueRecords = (queueRes.data && queueRes.data.records) || []
				const poolRes = await ps.getPoolContents()
				this.pinPool = (poolRes.data && poolRes.data.pins) || []
				const slotRes = await ps.getSlotStatus()
				this.slots = (slotRes.data && slotRes.data.slots) || [
					{ status: 'idle', surveyId: null, pinId: null, queueId: null },
					{ status: 'idle', surveyId: null, pinId: null, queueId: null },
					{ status: 'idle', surveyId: null, pinId: null, queueId: null }
				]
			} catch (e) {
				console.error('[career-history] refresh slot error:', e)
			}
			// 加载历史档案
			await this.loadCareers()
		},

		async loadCareers() {
			this.loadingCareers = true
			try {
				const db = uniCloud.database()
				const uid = uni.getStorageSync('uni-id-pages-userInfo')?.uid
				const res = await db.collection('career-records').where({
					userId: uid
				}).orderBy('createdAt', 'desc').get()
				this.careerRecords = res.data || []
				this.careerTotal = this.careerRecords.length
			} catch (e) {
				console.error('[career-history] load careers error:', e)
			} finally {
				this.loadingCareers = false
			}
		},

		toggleGroup(gi) {
			const groups = this.careerGroups
			// 只展开一个
			for (let i = 0; i < groups.length; i++) {
				if (i === gi) groups[i].expanded = !groups[i].expanded
				else groups[i].expanded = false
			}
			// 触发响应式更新
			this.careerRecords = [...this.careerRecords]
		},

		onSlotTap(slot, idx) {
			if (slot.status === 'queuing' && slot.queueId) {
				this.terminalQueueId = slot.queueId
				this.terminalVisible = true
			} else if (slot.status === 'claimable') {
				this.goSlotDetail(slot)
			} else if (slot.status === 'active') {
				uni.showToast({ title: '置顶中，可回首页查看', icon: 'none' })
			}
			// idle 不响应
		},

		// claimable 槽位点击 → 优先用 slot 自带的 careerId
		async goSlotDetail(slot) {
			// 1. slot 自带 careerId（pin-expiry / getSlotStatus 写入）
			if (slot.careerId) {
				uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + slot.careerId })
				return
			}
			// 2. 内存匹配
			let match = this.careerRecords.find(r => r.pinId === slot.pinId)
			if (match && match._id) {
				uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + match._id })
				return
			}
			// 3. 云对象兜底：按 pinId 查询 careerId
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getCareerByPinId({ pinId: slot.pinId })
				if (res.errCode === 0 && res.data && res.data.careerId) {
					uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + res.data.careerId })
					return
				}
			} catch (e) {
				console.error('[career-history] goSlotDetail cloud query error:', e)
			}
			uni.showToast({ title: '战绩单生成中，请稍后重试', icon: 'none' })
		},

		// 从档案列表跳转详情
		goDetail(careerId) {
			if (careerId) {
				uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + careerId })
			}
		},

		onQueueCompleted(e) {
			this.terminalVisible = false
			uni.showToast({ title: '入池成功！', icon: 'success' })
			this.refresh()
		},

		startPolling() {
			if (this._pollTimer) return
			this._pollTimer = setInterval(() => {
				this.pollSlots()
			}, 15000) // 每 15 秒轮询一次
		},

		stopPolling() {
			if (this._pollTimer) {
				clearInterval(this._pollTimer)
				this._pollTimer = null
			}
		},

		async pollSlots() {
			try {
				const ps = uniCloud.importObject('pin-system')
				const slotRes = await ps.getSlotStatus()
				const poolRes = await ps.getPoolContents()
				const newSlots = (slotRes.data && slotRes.data.slots) || this.slots
				const newPool = (poolRes.data && poolRes.data.pins) || []
				// 仅更新变化的数据，不触发全量 refresh 避免 flicker
				this.slots = newSlots
				this.pinPool = newPool
			} catch (e) {
				// 静默失败，下次轮询会重试
			}
		},

		onCountdownFinish() {
			this.pollSlots()
		},

		formatNum(val) {
			if (typeof val !== 'number') return '--'
			if (val >= 10000) return (val / 10000).toFixed(1) + '万'
			return val.toLocaleString()
		},

		formatMMSS(totalSeconds) {
			const m = Math.floor(totalSeconds / 60)
			const s = totalSeconds % 60
			return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
		},

		formatDate(ts) {
			if (!ts) return ''
			const d = new Date(ts)
			return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
		},

		formatShortDate(ts) {
			if (!ts) return ''
			const d = new Date(ts)
			return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
		},

		goBack() { uni.navigateBack() }
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }
.hd { background: white; padding: 96rpx 40rpx 24rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1); border-radius: 0 0 48rpx 48rpx; }
.hd-row { display: flex; align-items: center; gap: 16rpx; }
.hd-back { width: 64rpx; height: 64rpx; background: #F3F4F6; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.back-arrow { width: 28rpx; height: 28rpx; }
.hd-title { font-size: 40rpx; font-weight: 700; color: #101828; }
.hd-capacity { font-size: 28rpx; color: #99A1AF; margin-left: auto; font-weight: 600; }
.press-9 { transform: scale(.9); }
.press-95 { transform: scale(.95); }

.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }
.section-title { font-size: 28rpx; font-weight: 700; color: #1E2939; margin-bottom: 16rpx; }

/* 三槽位 */
.slots-row { display: flex; gap: 12rpx; }
.slot-card {
	flex: 1; border-radius: 24rpx; padding: 20rpx 12rpx;
	text-align: center; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.slot-idle { background: #F3F4F6; }
.slot-queuing { background: #FEF3C7; }
.slot-active { background: #D1FAE5; }
.slot-claimable { background: #FEF9C3; border: 2rpx solid #F59E0B; }
.slot-icon { font-size: 40rpx; margin-bottom: 8rpx; }
.slot-status { font-size: 24rpx; font-weight: 700; color: #1E2939; display: block; }
.slot-desc { font-size: 20rpx; color: #6B7280; display: block; margin-top: 4rpx; }

.slot-countdown {
	display: flex; justify-content: center; margin-top: 4rpx;
}
.slot-countdown .u-count-down__text {
	font-size: 22rpx; font-weight: 700; color: #059669; font-family: monospace;
}

/* 综述卡 */
.overview-card {
	background: linear-gradient(135deg, #1E2939 0%, #334155 100%);
	border-radius: 28rpx; padding: 28rpx 20rpx; margin-bottom: 20rpx;
}
.overview-stats { display: flex; gap: 8rpx; margin-bottom: 16rpx; }
.overview-item { flex: 1; text-align: center; }
.overview-num { font-size: 40rpx; font-weight: 800; color: #FBBF24; display: block; font-family: monospace; }
.overview-label { font-size: 20rpx; color: #94A3B8; margin-top: 4rpx; display: block; }
.overview-comment { font-size: 22rpx; color: #CBD5E1; line-height: 1.6; text-align: center; display: block; padding: 0 10rpx; }

/* ====== 档案手风琴列表 ====== */
.accordion-list { margin-bottom: 20rpx; }
.accordion-group {
	background: white; border-radius: 24rpx; margin-bottom: 12rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1); overflow: hidden;
}
.accordion-header {
	display: flex; align-items: center; justify-content: space-between;
	padding: 24rpx 28rpx; cursor: pointer;
}
.accordion-header-left { display: flex; flex-direction: column; gap: 4rpx; flex: 1; min-width: 0; }
.accordion-title { font-size: 28rpx; font-weight: 700; color: #1E2939; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.accordion-count { font-size: 20rpx; color: #9CA3AF; }
.accordion-header-right { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.accordion-latest { font-size: 20rpx; color: #9CA3AF; }
.accordion-arrow { font-size: 32rpx; color: #D1D5DC; font-weight: 700; transition: transform .3s; }
.accordion-arrow.expanded { transform: rotate(90deg); }

.accordion-body { border-top: 2rpx solid #F3F4F6; }
.accordion-item {
	display: flex; align-items: center; justify-content: space-between;
	padding: 20rpx 28rpx; border-bottom: 1rpx solid #F9FAFB;
}
.accordion-item:last-child { border-bottom: none; }
.accordion-item.item-bonus { background: #FFFBEB; }

.item-left { display: flex; flex-direction: column; gap: 4rpx; flex: 1; min-width: 0; }
.item-date { font-size: 20rpx; color: #9CA3AF; }
.item-honor-row { display: flex; align-items: center; gap: 8rpx; }
.item-honor { font-size: 24rpx; color: #1E2939; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-tag { font-size: 18rpx; font-weight: 700; padding: 2rpx 10rpx; border-radius: 12rpx; flex-shrink: 0; }
.item-tag-debut { background: #FEF3C7; color: #D97706; }
.item-tag-bonus { background: #EDE9FE; color: #7C3AED; }
.item-tag-promote { background: #DBEAFE; color: #2563EB; }

.item-right { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.item-views { font-size: 28rpx; font-weight: 800; color: #F97316; font-family: monospace; }
.item-views-label { font-size: 18rpx; color: #9CA3AF; }
.item-arrow { font-size: 24rpx; color: #D1D5DC; }

/* 空状态 */
.empty-state { text-align: center; padding: 80rpx 0; }
.empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-txt { font-size: 28rpx; color: #99A1AF; display: block; }
.empty-sub { font-size: 22rpx; color: #D1D5DC; margin-top: 8rpx; display: block; }

.bottom-spacer { height: 60rpx; }
</style>
