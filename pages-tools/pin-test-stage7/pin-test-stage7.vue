<!-- ========== 二期助力功能 · 傻瓜式测试验收页 ========== -->
<template>
	<view class="page">
		<!-- 头顶 -->
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">二期助力测试</text>
				<text v-if="myUid" class="hd-user">{{ displayUid }}</text>
			</view>
			<text class="hd-subtitle">问卷身份体系 / 官方拦截 / 助力推广 / 新字段验证</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">

				<!-- ====== 前置说明 ====== -->
				<view class="section">
					<view class="card card-intro">
						<text class="intro-title">🧪 测试前准备</text>
						<text class="intro-line">1. 准备好几个 surveyId：自己创建的、他人创建的、官方的（在关于页找）</text>
						<text class="intro-line">2. 每个测试点击后等结果返回，绿色 ✅ 通过 / 红色 ❌ 不通过</text>
						<text class="intro-line">3. 结果 JSON 可展开查看细节</text>
					</view>
				</view>

				<!-- ====== 1. 官方问卷拦截 ====== -->
				<view class="section">
					<view class="section-title">1. 🚫 官方问卷拦截</view>
					<view class="card">
						<text class="card-desc">输入一个官方问卷的 surveyId，验证接口是否返回 OFFICIAL_SURVEY</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<input class="set-input" v-model="officialSurveyId" type="text" placeholder="输入官方 surveyId" />
							<view class="card-btn" hover-class="press-95" @click="testOfficialBlock">
								<text class="btn-txt">{{ loading.official ? '调用中...' : '测试拦截' }}</text>
							</view>
						</view>
						<view v-if="results.official" :class="'test-result ' + (results.official.pass ? 'r-pass' : 'r-fail')">
							<text class="r-icon">{{ results.official.pass ? '✅' : '❌' }}</text>
							<view class="r-body">
								<text class="r-title">{{ results.official.pass ? '拦截成功 ✓' : '未拦截 ✗' }}</text>
								<text class="r-detail">{{ results.official.msg }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 2. 自己置顶测试 ====== -->
				<view class="section">
					<view class="section-title">2. 🏠 自己置顶测试（self）</view>
					<view class="card">
						<text class="card-desc">输入一个你自己创建的问卷 surveyId，验证入池后 pinType="self"</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<input class="set-input" v-model="selfSurveyId" type="text" placeholder="输入自己的 surveyId" />
							<view class="card-btn" hover-class="press-95" @click="testSelfPin">
								<text class="btn-txt">{{ loading.self ? '调用中...' : '测试自己置顶' }}</text>
							</view>
						</view>
						<view v-if="results.self" :class="'test-result ' + (results.self.pass ? 'r-pass' : 'r-fail')">
							<text class="r-icon">{{ results.self.pass ? '✅' : '❌' }}</text>
							<view class="r-body">
								<text class="r-title">{{ results.self.pass ? 'self 置顶成功 ✓' : '失败 ✗' }}</text>
								<text class="r-detail">{{ results.self.msg }}</text>
							</view>
						</view>
						<view v-if="results.self && results.self.pass" class="field-check">
							<text class="field-label">字段校验：</text>
							<view class="field-tags">
								<text :class="'field-tag ' + (results.self.chk.pinType ? 'tag-ok' : 'tag-bad')">pinType</text>
								<text :class="'field-tag ' + (results.self.chk.pinnerId ? 'tag-ok' : 'tag-bad')">pinnerId</text>
								<text :class="'field-tag ' + (results.self.chk.surveyCreatorId ? 'tag-ok' : 'tag-bad')">surveyCreatorId</text>
								<text :class="'field-tag ' + (results.self.chk.surveyAuthor ? 'tag-ok' : 'tag-bad')">surveyAuthor</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 3. 助力推广测试 ====== -->
				<view class="section">
					<view class="section-title">3. 🤝 助力推广测试（promote）</view>
					<view class="card">
						<text class="card-desc">输入一个他人创建的问卷 surveyId，验证入池后 pinType="promote"</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<input class="set-input" v-model="promoteSurveyId" type="text" placeholder="输入他人的 surveyId" />
							<view class="card-btn" hover-class="press-95" @click="testPromotePin">
								<text class="btn-txt">{{ loading.promote ? '调用中...' : '测试助力推广' }}</text>
							</view>
						</view>
						<view v-if="results.promote" :class="'test-result ' + (results.promote.pass ? 'r-pass' : 'r-fail')">
							<text class="r-icon">{{ results.promote.pass ? '✅' : '❌' }}</text>
							<view class="r-body">
								<text class="r-title">{{ results.promote.pass ? 'promote 推广成功 ✓' : '失败 ✗' }}</text>
								<text class="r-detail">{{ results.promote.msg }}</text>
							</view>
						</view>
						<view v-if="results.promote && results.promote.pass" class="field-check">
							<text class="field-label">字段校验：</text>
							<view class="field-tags">
								<text :class="'field-tag ' + (results.promote.chk.pinType ? 'tag-ok' : 'tag-bad')">pinType=promote</text>
								<text :class="'field-tag ' + (results.promote.chk.pinnerId ? 'tag-ok' : 'tag-bad')">pinnerId 为操作人</text>
								<text :class="'field-tag ' + (results.promote.chk.surveyCreatorId ? 'tag-ok' : 'tag-bad')">surveyCreatorId 为创建者</text>
								<text :class="'field-tag ' + (results.promote.chk.surveyAuthor ? 'tag-ok' : 'tag-bad')">surveyAuthor 为创建者昵称</text>
								<text :class="'field-tag ' + (results.promote.chk.userIdIsOperator ? 'tag-ok' : 'tag-bad')">userId 是操作人</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 4. draw 接口字段验证 ====== -->
				<view class="section">
					<view class="section-title">4. 🎯 draw 接口字段验证</view>
					<view class="card">
						<text class="card-desc">验证 draw 返回数据中是否携带 pinType / pinnerId / surveyCreatorId</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<view class="card-btn" hover-class="press-95" @click="testDrawFields">
								<text class="btn-txt">{{ loading.draw ? '调用中...' : '验证 draw 字段' }}</text>
							</view>
						</view>
						<view v-if="results.draw" :class="'test-result ' + (results.draw.pass ? 'r-pass' : 'r-fail')">
							<text class="r-icon">{{ results.draw.pass ? '✅' : '❌' }}</text>
							<view class="r-body">
								<text class="r-title">{{ results.draw.pass ? '字段完整 ✓' : '字段缺失 ✗' }}</text>
								<text class="r-detail">{{ results.draw.msg }}</text>
							</view>
						</view>
						<view v-if="results.draw && results.draw.items" class="draw-list">
							<view v-for="(item, idx) in results.draw.items" :key="idx" class="draw-item">
								<view class="di-left">
									<text class="di-title">{{ item.surveyTitle || item.surveyId }}</text>
									<view class="di-tags">
										<text :class="'di-tag ' + (item.isMine ? 'tag-mine' : 'tag-other')">{{ item.isMine ? '我的' : '他人' }}</text>
										<text class="di-tag tag-blue">pinType={{ item.pinType }}</text>
										<text class="di-tag tag-gray">pinnerId={{ (item.pinnerId || '').slice(0, 6) }}..</text>
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 5. 池子查询 ====== -->
				<view class="section">
					<view class="section-title">5. 📋 池子内容查询（新字段展示）</view>
					<view class="card">
						<text class="card-desc">查看当前 pin-pool 中所有有效问卷的新字段分布</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<view class="card-btn" hover-class="press-95" @click="testPoolContents">
								<text class="btn-txt">{{ loading.pool ? '查询中...' : '查看池子' }}</text>
							</view>
						</view>
						<view v-if="results.pool && results.pool.pins && results.pool.pins.length" class="pool-list" style="margin-top: 12rpx;">
							<view v-for="(pin, idx) in results.pool.pins" :key="pin._id" :class="'pool-item ' + (pin.pinType === 'promote' ? 'pool-promote' : 'pool-self')">
								<view class="pi-hd">
									<text class="pi-title">{{ pin.surveyTitle || pin.surveyId }}</text>
									<text :class="'pi-type ' + (pin.pinType === 'promote' ? 'type-promote' : 'type-self')">{{ pin.pinType || 'self(旧)' }}</text>
								</view>
								<view class="pi-info">
									<text class="pi-field">userId={{ (pin.userId || '').slice(0, 6) }}..</text>
									<text v-if="pin.pinnerId" class="pi-field">pinnerId={{ (pin.pinnerId || '').slice(0, 6) }}..</text>
									<text v-if="pin.surveyCreatorId" class="pi-field">creator={{ (pin.surveyCreatorId || '').slice(0, 6) }}..</text>
									<text v-if="!pin.pinnerId" class="pi-field pi-old">旧数据（无新字段）</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 6. 候场区状态 ====== -->
				<view class="section">
					<view class="section-title">6. ⏳ 候场区状态（pinType）</view>
					<view class="card">
						<text class="card-desc">查看你的候场记录中是否携带 pinType 字段</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<view class="card-btn" hover-class="press-95" @click="testQueueStatus">
								<text class="btn-txt">{{ loading.queue ? '查询中...' : '查询候场状态' }}</text>
							</view>
						</view>
						<view v-if="results.queue" :class="'test-result ' + (results.queue.pass ? 'r-pass' : results.queue.failOnly ? 'r-fail' : '')">
							<text class="r-icon">{{ results.queue.pass ? '✅' : (results.queue.records || []).length ? '⚠️' : '❌' }}</text>
							<view class="r-body">
								<text class="r-title">{{ results.queue.pass ? 'pinType 正常 ✓' : (results.queue.records || []).length ? '部分记录缺失 pinType' : '无候场记录' }}</text>
								<text class="r-detail">{{ results.queue.msg }}</text>
							</view>
						</view>
						<view v-if="results.queue && results.queue.records && results.queue.records.length > 0" class="queue-list" style="margin-top: 12rpx;">
							<view v-for="(rec, idx) in results.queue.records" :key="idx" class="queue-item">
								<text class="queue-sid">{{ (rec.surveyId || '').slice(0, 10) }}..</text>
								<text class="queue-phase">{{ rec.currentPhase || 'unknown' }}</text>
								<text :class="'queue-type ' + (rec.pinType === 'promote' ? 'type-promote' : 'type-self')">{{ rec.pinType || 'self(旧)' }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 7. 槽位状态 ====== -->
				<view class="section">
					<view class="section-title">7. 📋 槽位状态</view>
					<view class="card">
						<text class="card-desc">查看你的三个槽位当前的状态</text>
						<view class="set-custom" style="margin-top: 12rpx;">
							<view class="card-btn" hover-class="press-95" @click="testSlotStatus">
								<text class="btn-txt">{{ loading.slots ? '查询中...' : '查看槽位' }}</text>
							</view>
						</view>
						<view v-if="results.slots" class="slot-list" style="margin-top: 12rpx;">
							<view v-if="!results.slots.slots || results.slots.slots.length === 0" class="slot-item" style="justify-content:center;">
								<text class="slot-idle">无槽位数据</text>
							</view>
							<view v-for="(s, idx) in results.slots.slots" :key="idx" :class="'slot-item slot-' + s.status">
								<view class="slot-hd">
									<text class="slot-index">#{{ idx + 1 }}</text>
									<text :class="'slot-status ' + ('slot-label-' + s.status)">{{ s.status }}</text>
								</view>
								<view class="slot-body">
									<text v-if="s.surveyId" class="slot-field">surveyId: {{ (s.surveyId || '').slice(0,16) }}{{ s.surveyId && s.surveyId.length > 16 ? '..' : '' }}</text>
									<text v-if="s.pinId" class="slot-field">pinId: {{ (s.pinId || '').slice(0,16) }}{{ s.pinId && s.pinId.length > 16 ? '..' : '' }}</text>
									<text v-if="s.queueId" class="slot-field">queueId: {{ (s.queueId || '').slice(0,16) }}{{ s.queueId && s.queueId.length > 16 ? '..' : '' }}</text>
								</view>
							</view>
							<view class="slot-legend" style="margin-top: 8rpx; display:flex; gap:12rpx; flex-wrap:wrap; padding:8rpx 0;">
								<text class="legend-dot legend-idle">○ idle — 空闲</text>
								<text class="legend-dot legend-active">● active — 池中</text>
								<text class="legend-dot legend-claimable">◐ claimable — 可领奖</text>
								<text class="legend-dot legend-queuing">◌ queuing — 候场</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 8. 一键全测 ====== -->
				<view class="section" style="margin-bottom: 60rpx;">
					<view class="section-title">⚡ 一键全测</view>
					<view class="card">
						<text class="card-desc">按顺序执行全部测试（先填好上面各 surveyId）</text>
						<view class="auto-hd" style="margin-top: 12rpx;">
							<view :class="'card-btn card-btn-auto' + (autoRunning ? ' btn-disabled' : '')" hover-class="press-95" @click="runAllTests">
								<text class="btn-txt">{{ autoRunning ? '测试中...' : '▶ 执行全部测试' }}</text>
							</view>
							<text v-if="autoSummary" :class="'auto-badge ' + (autoSummary.allPass ? 'badge-pass' : 'badge-fail')">
								{{ autoSummary.passed }}/{{ autoSummary.total }} 通过
							</text>
						</view>
						<view v-if="autoProgress !== null" class="progress-track">
							<view class="progress-fill" :style="{ width: autoProgress + '%' }"></view>
						</view>
						<view v-if="autoResultList.length > 0" class="auto-list">
							<view v-for="(item, idx) in autoResultList" :key="idx" :class="'auto-item ' + (item.pass ? 'auto-pass' : 'auto-fail')">
								<text class="auto-icon">{{ item.pass ? '✅' : '❌' }}</text>
								<text class="auto-name">{{ item.name }}</text>
								<text class="auto-detail">{{ item.msg }}</text>
							</view>
						</view>
					</view>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
const ps = () => uniCloud.importObject('pin-system')

export default {
	data() {
		return {
			officialSurveyId: '',
			selfSurveyId: '',
			promoteSurveyId: '',
			myUid: '',
			loading: { official: false, self: false, promote: false, draw: false, pool: false, queue: false, slots: false },
			results: { official: null, self: null, promote: null, draw: null, pool: null, queue: null, slots: null },
			autoRunning: false,
			autoProgress: null,
			autoResultList: [],
			autoSummary: null
		}
	},
	computed: {
		displayUid() {
			return (this.myUid || '').slice(0, 8) + '...'
		}
	},
	onShow() {
		this.loadCurrentUid()
	},
	methods: {
		loadCurrentUid() {
			try {
				const info = uni.getStorageSync('uni-id-pages-userInfo')
				this.myUid = info?._id || ''
			} catch (e) { this.myUid = '' }
		},
		goBack() { uni.navigateBack({ delta: 1 }) },

		// ==================== 单项测试 ====================

		async testOfficialBlock() {
			if (!this.officialSurveyId) { this.results.official = { pass: false, msg: '未填写官方 surveyId' }; return }
			this.loading.official = true
			this.results.official = null
			try {
				const res = await ps().enterPool({ surveyId: this.officialSurveyId })
				const pass = res.errCode === 'OFFICIAL_SURVEY'
				this.results.official = {
					pass,
					msg: pass ? `返回 OFFICIAL_SURVEY（${res.errMsg}）` : `未拦截，返回 ${JSON.stringify(res).slice(0, 100)}`
				}
			} catch (e) {
				const pass = e.message && (e.message.includes('OFFICIAL') || e.message.includes('官方问卷'))
				this.results.official = {
					pass,
					msg: pass ? `异常抛出拦截 ✓（${e.message}）` : `调用异常：${e.message}`
				}
			}
			this.loading.official = false
		},

		async testSelfPin() {
			if (!this.selfSurveyId) { this.results.self = { pass: false, msg: '未填写自己的 surveyId' }; return }
			this.loading.self = true
			this.results.self = null
			try {
				const res = await ps().enterPool({ surveyId: this.selfSurveyId })
				if (res.errCode === 0 && res.pinData) {
					const pd = res.pinData
					const chk = {
						pinType: pd.pinType === 'self',
						pinnerId: !!pd.pinnerId,
						surveyCreatorId: !!pd.surveyCreatorId,
						surveyAuthor: !!pd.surveyAuthor
					}
					const fieldsOk = chk.pinType && chk.pinnerId && chk.surveyCreatorId && chk.surveyAuthor
					this.results.self = {
						pass: fieldsOk,
						chk,
						msg: fieldsOk
							? `入池成功 ✓ pinType=${pd.pinType} pinnerId=${(pd.pinnerId || '').slice(0,6)} surveyAuthor=${pd.surveyAuthor || ''}`
							: `字段不完整：${JSON.stringify(chk)}`
					}
				} else if (res.errCode === 'SLOTS_FULL') {
					this.results.self = {
						pass: false,
						msg: `槽位已满（${res.errMsg}），请先清理槽位或等一条过期后再试`
					}
				} else if (res.errCode === 'DAILY_CAP_SOFT') {
					this.results.self = {
						pass: false,
						msg: `每日上限：${res.errMsg}`
					}
				} else {
					this.results.self = { pass: false, msg: `返回 ${JSON.stringify(res).slice(0, 120)}` }
				}
			} catch (e) {
				this.results.self = { pass: false, msg: `调用异常：${e.message}` }
			}
			this.loading.self = false
		},

		async testPromotePin() {
			if (!this.promoteSurveyId) { this.results.promote = { pass: false, msg: '未填写他人的 surveyId' }; return }
			this.loading.promote = true
			this.results.promote = null
			try {
				const res = await ps().enterPool({ surveyId: this.promoteSurveyId })
				if (res.errCode === 0 && res.pinData) {
					const pd = res.pinData
					const isPromote = pd.pinType === 'promote'
					const userIdIsOperator = pd.pinnerId === this.myUid
					const creatorNotMe = pd.surveyCreatorId && pd.surveyCreatorId !== this.myUid
					const chk = {
						pinType: isPromote,
						pinnerId: pd.pinnerId === this.myUid,
						surveyCreatorId: !!pd.surveyCreatorId && creatorNotMe,
						surveyAuthor: !!pd.surveyAuthor,
						userIdIsOperator
					}
					const fieldsOk = isPromote && chk.pinnerId && chk.surveyCreatorId && chk.surveyAuthor && userIdIsOperator
					this.results.promote = {
						pass: fieldsOk,
						chk,
						msg: fieldsOk
							? `推广入池成功 ✓ pinType=promote surveyAuthor=${pd.surveyAuthor || ''}`
							: `字段不完整：${JSON.stringify(chk)}`
					}
				} else if (res.errCode === 'SLOTS_FULL') {
					this.results.promote = {
						pass: false,
						msg: `槽位已满（${res.errMsg}），请先清理槽位或等一条过期后再试`
					}
				} else if (res.errCode === 'DAILY_CAP_SOFT') {
					this.results.promote = {
						pass: false,
						msg: `每日上限：${res.errMsg}`
					}
				} else {
					this.results.promote = { pass: false, msg: `返回 ${JSON.stringify(res).slice(0, 120)}` }
				}
			} catch (e) {
				this.results.promote = { pass: false, msg: `调用异常：${e.message}` }
			}
			this.loading.promote = false
		},

		async testDrawFields() {
			this.loading.draw = true
			this.results.draw = null
			try {
				const res = await ps().draw({ count: 5 })
				if (res.errCode === 0 && res.data && res.data.items) {
					const items = res.data.items
					const hasNewFields = items.every(it => {
						return it.hasOwnProperty('pinType') &&
							it.hasOwnProperty('pinnerId') &&
							it.hasOwnProperty('surveyCreatorId')
					})
					const detail = items.length > 0
						? `共 ${items.length} 条，字段完整: ${hasNewFields ? '✓' : '✗'}`
						: '池子为空，无法验证字段'
					this.results.draw = {
						pass: hasNewFields || items.length === 0,
						items,
						msg: detail
					}
				} else {
					this.results.draw = { pass: false, items: [], msg: `draw 返回异常：${JSON.stringify(res).slice(0, 100)}` }
				}
			} catch (e) {
				this.results.draw = { pass: false, items: [], msg: `调用异常：${e.message}` }
			}
			this.loading.draw = false
		},

		async testPoolContents() {
			this.loading.pool = true
			this.results.pool = null
			try {
				const res = await ps().getPoolContents()
				if (res.errCode === 0 && res.data && res.data.pins) {
					const pins = res.data.pins
					const hasNewFields = pins.every(p => p.hasOwnProperty('pinType'))
					this.results.pool = {
						pass: hasNewFields,
						msg: hasNewFields
							? `共 ${pins.length} 条记录，均含 pinType ✓`
							: `${pins.length} 条记录中部分缺少 pinType`,
						pins
					}
				} else {
					this.results.pool = {
						pass: false,
						msg: `查询失败：${JSON.stringify(res).slice(0, 80)}`,
						pins: []
					}
				}
			} catch (e) {
				this.results.pool = { pass: false, msg: `异常：${e.message}`, pins: [] }
			}
			this.loading.pool = false
		},

		async testQueueStatus() {
			this.loading.queue = true
			this.results.queue = null
			try {
				const res = await ps().getQueueStatus()
				if (res.errCode === 0 && res.data && res.data.records) {
					const records = res.data.records
					const allHasPinType = records.every(r => r.hasOwnProperty('pinType'))
					this.results.queue = {
						pass: allHasPinType || records.length === 0,
						failOnly: !allHasPinType && records.length > 0,
						records,
						msg: allHasPinType
							? `共 ${records.length} 条记录，均含 pinType ✓`
							: `${records.length} 条中有部分无 pinType 字段`
					}
				} else {
					this.results.queue = {
						pass: false, records: [],
						msg: `返回异常：${JSON.stringify(res).slice(0, 100)}`
					}
				}
			} catch (e) {
				this.results.queue = { pass: false, records: [], msg: `调用异常：${e.message}` }
			}
			this.loading.queue = false
		},

		// ==================== 一键全测 ====================

		async testSlotStatus() {
			this.loading.slots = true
			this.results.slots = null
			try {
				const res = await ps().getSlotStatus()
				if (res.errCode === 0 && res.data) {
					this.results.slots = res.data
				} else {
					this.results.slots = { slots: [], err: JSON.stringify(res).slice(0, 80) }
					uni.showToast({ title: '查询失败', icon: 'none' })
				}
			} catch (e) {
				this.results.slots = { slots: [], err: e.message }
				uni.showToast({ title: e.message, icon: 'none' })
			}
			this.loading.slots = false
		},

		async runAllTests() {
			if (this.autoRunning) return
			this.autoRunning = true
			this.autoResultList = []
			this.autoProgress = 0
			this.autoSummary = null

			const tests = [
				{ name: '① 官方问卷拦截', fn: () => this.externalCall('testOfficialBlock') },
				{ name: '② 自己置顶', fn: () => this.externalCall('testSelfPin') },
				{ name: '③ 助力推广', fn: () => this.externalCall('testPromotePin') },
				{ name: '④ draw 字段', fn: () => this.externalCall('testDrawFields') },
				{ name: '⑤ 池子内容', fn: () => this.externalCall('testPoolContents') },
				{ name: '⑥ 候场状态', fn: () => this.externalCall('testQueueStatus') },
				{ name: '⑦ 槽位状态', fn: () => this.externalCall('testSlotStatus') },
			]

			let passed = 0
			for (let i = 0; i < tests.length; i++) {
				const t = tests[i]
				try {
					await t.fn()
					const r = this.results[this.testKey(t.name)]
					const isPass = r && r.pass
					if (isPass) passed++
					this.autoResultList.push({ name: t.name, pass: !!isPass, msg: r?.msg || '无返回' })
				} catch (e) {
					this.autoResultList.push({ name: t.name, pass: false, msg: e.message })
				}
				this.autoProgress = Math.round(((i + 1) / tests.length) * 100)
			}

			this.autoSummary = { passed, total: tests.length, allPass: passed === tests.length }
			this.autoRunning = false
		},

		testKey(name) {
			const map = { '① 官方问卷拦截': 'official', '② 自己置顶': 'self', '③ 助力推广': 'promote', '④ draw 字段': 'draw', '⑤ 池子内容': 'pool', '⑥ 候场状态': 'queue', '⑦ 槽位状态': 'slots' }
			return map[name] || ''
		},

		async externalCall(methodName) {
			await this[methodName]()
		}
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
.hd-user { font-size: 24rpx; color: #99A1AF; margin-left: auto; }
.hd-subtitle { font-size: 26rpx; color: #99A1AF; font-weight: 500; display: block; margin-top: 8rpx; }

.body { flex: 1; }
.body-inner { padding: 28rpx 32rpx 100rpx; }

.section { margin-bottom: 24rpx; }
.section-title { font-size: 32rpx; font-weight: 800; color: #101828; margin-bottom: 12rpx; padding-left: 8rpx; }

.card { background: white; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,.04); }
.card-intro { background: #F0F9FF; border: 2rpx solid #BAE6FD; }
.intro-title { font-size: 28rpx; font-weight: 700; color: #075985; display: block; margin-bottom: 8rpx; }
.intro-line { font-size: 24rpx; color: #0369A1; display: block; line-height: 1.7; }
.card-desc { font-size: 24rpx; color: #6B7280; line-height: 1.6; display: block; }

.set-custom { display: flex; align-items: center; gap: 12rpx; }
.set-input { flex: 1; height: 72rpx; background: #F9FAFB; border: 2rpx solid #E2E8F0; border-radius: 16rpx; padding: 0 20rpx; font-size: 26rpx; color: #1E2939; }

.card-btn {
	padding: 14rpx 32rpx; background: #1E2939; border-radius: 16rpx; display: flex;
	align-items: center; justify-content: center; white-space: nowrap;
}
.card-btn-auto { padding: 16rpx 36rpx; min-width: 220rpx; }
.btn-disabled { opacity: .5; }
.btn-txt { font-size: 26rpx; font-weight: 700; color: white; }

.test-result { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 16rpx; padding: 16rpx; border-radius: 14rpx; }
.r-pass { background: #F0FDF4; }
.r-fail { background: #FEF2F2; }
.r-icon { font-size: 32rpx; flex-shrink: 0; }
.r-body { flex: 1; min-width: 0; }
.r-title { font-size: 26rpx; font-weight: 700; display: block; }
.r-pass .r-title { color: #15803D; }
.r-fail .r-title { color: #DC2626; }
.r-detail { font-size: 22rpx; color: #6B7280; display: block; margin-top: 4rpx; word-break: break-all; line-height: 1.5; }

.field-check { margin-top: 12rpx; padding: 12rpx 16rpx; background: #FAFFFA; border-radius: 12rpx; }
.field-label { font-size: 24rpx; font-weight: 600; color: #1E2939; display: block; margin-bottom: 8rpx; }
.field-tags { display: flex; gap: 8rpx; flex-wrap: wrap; }
.field-tag { font-size: 22rpx; font-weight: 600; padding: 4rpx 14rpx; border-radius: 20rpx; }
.tag-ok { background: #DCFCE7; color: #166534; }
.tag-bad { background: #FEF2F2; color: #DC2626; }

.draw-list { display: flex; flex-direction: column; gap: 8rpx; margin-top: 12rpx; }
.draw-item { padding: 14rpx 16rpx; background: #F8FAFC; border-radius: 14rpx; border: 2rpx solid #E2E8F0; }
.di-left { display: flex; flex-direction: column; gap: 6rpx; }
.di-title { font-size: 26rpx; font-weight: 600; color: #1E2939; }
.di-tags { display: flex; gap: 8rpx; flex-wrap: wrap; }
.di-tag { font-size: 20rpx; font-weight: 600; padding: 2rpx 12rpx; border-radius: 10rpx; }
.tag-mine { background: #DBEAFE; color: #1E40AF; }
.tag-other { background: #F3F4F6; color: #6B7280; }
.tag-blue { background: #EDE9FE; color: #7C3AED; }
.tag-gray { background: #F3F4F6; color: #6B7280; }

.pool-list { display: flex; flex-direction: column; gap: 8rpx; }
.pool-item { padding: 14rpx 16rpx; border-radius: 14rpx; border: 2rpx solid #E2E8F0; }
.pool-self { background: #F8FAFC; }
.pool-promote { background: #EFF6FF; border-color: #BFDBFE; }
.pi-hd { display: flex; align-items: center; gap: 10rpx; margin-bottom: 6rpx; }
.pi-title { font-size: 26rpx; font-weight: 600; color: #1E2939; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-type { font-size: 20rpx; font-weight: 700; padding: 2rpx 12rpx; border-radius: 10rpx; flex-shrink: 0; }
.type-self { background: #F3F4F6; color: #6B7280; }
.type-promote { background: #DBEAFE; color: #1E40AF; }
.pi-info { display: flex; gap: 10rpx; flex-wrap: wrap; }
.pi-field { font-size: 18rpx; color: #6B7280; font-family: monospace; }
.pi-old { color: #F59E0B; }

.queue-list { display: flex; flex-direction: column; gap: 8rpx; }
.queue-item { display: flex; align-items: center; gap: 10rpx; padding: 12rpx 16rpx; background: #F8FAFC; border-radius: 12rpx; }
.queue-sid { font-size: 22rpx; color: #1E2939; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.queue-phase { font-size: 20rpx; color: #6B7280; padding: 2rpx 10rpx; background: #F3F4F6; border-radius: 8rpx; }
.queue-type { font-size: 20rpx; font-weight: 700; padding: 2rpx 12rpx; border-radius: 10rpx; }

/* Auto run */
.auto-hd { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.auto-badge { padding: 8rpx 20rpx; border-radius: 40rpx; font-size: 24rpx; font-weight: 700; }
.badge-pass { background: #DCFCE7; color: #166534; }
.badge-fail { background: #FEF2F2; color: #DC2626; }
.progress-track { height: 10rpx; background: #F3F4F6; border-radius: 99rpx; overflow: hidden; margin-top: 12rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #22C55E, #16A34A); border-radius: 99rpx; transition: width .3s ease; }
.auto-list { display: flex; flex-direction: column; gap: 6rpx; margin-top: 12rpx; }
.auto-item { display: flex; align-items: center; gap: 10rpx; padding: 12rpx 16rpx; border-radius: 12rpx; }
.auto-pass { background: #F0FDF4; }
.auto-fail { background: #FEF2F2; }
.auto-icon { font-size: 24rpx; flex-shrink: 0; }
.auto-name { font-size: 26rpx; font-weight: 600; color: #1E2939; flex-shrink: 0; }
.auto-detail { font-size: 20rpx; color: #6B7280; text-align: right; word-break: break-all; line-height: 1.5; flex: 1; min-width: 0; }
.auto-fail .auto-detail { color: #DC2626; }

.bottom-spacer { height: 60rpx; }

/* 槽位状态卡片 */
.slot-list { display: flex; flex-direction: column; gap: 8rpx; }
.slot-item { display: flex; flex-direction: column; gap: 6rpx; padding: 14rpx 16rpx; border-radius: 14rpx; border: 2rpx solid #E2E8F0; }
.slot-idle { background: #FAFFFA; border-color: #BBF7D0; }
.slot-active { background: #EFF6FF; border-color: #BFDBFE; }
.slot-claimable { background: #FFF7ED; border-color: #FED7AA; }
.slot-queuing { background: #F5F3FF; border-color: #DDD6FE; }
.slot-hd { display: flex; align-items: center; gap: 10rpx; }
.slot-index { font-size: 24rpx; font-weight: 800; color: #1E2939; flex-shrink: 0; }
.slot-status { font-size: 22rpx; font-weight: 700; padding: 2rpx 14rpx; border-radius: 12rpx; }
.slot-label-idle { background: #DCFCE7; color: #166534; }
.slot-label-active { background: #DBEAFE; color: #1E40AF; }
.slot-label-claimable { background: #FED7AA; color: #9A3412; }
.slot-label-queuing { background: #DDD6FE; color: #6D28D9; }
.slot-body { display: flex; flex-direction: column; gap: 4rpx; }
.slot-field { font-size: 22rpx; color: #6B7280; font-family: monospace; word-break: break-all; }
.legend-dot { font-size: 20rpx; color: #6B7280; }
.legend-idle { color: #16A34A; }
.legend-active { color: #2563EB; }
.legend-claimable { color: #D97706; }
.legend-queuing { color: #7C3AED; }

</style>
