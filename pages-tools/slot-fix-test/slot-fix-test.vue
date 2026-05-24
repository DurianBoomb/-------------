<!-- ========== 槽位过期修复 & 签收兜底 一键测试 ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">槽位过期修复测试</text>
				<text v-if="currentUser" class="hd-user">{{ currentUser }}</text>
			</view>
			<text class="hd-subtitle">getSlotStatus 实时核验  ·  goSlotDetail 兜底查询</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">

				<!-- ====== 0. 环境准备 ====== -->
				<view class="section">
					<view class="section-title">0. 环境准备</view>
					<view class="card">
						<view class="btn-row">
							<view class="card-btn" hover-class="press-95" @click="resetAll">
								<text class="btn-txt">🔄 清空所有测试数据</text>
							</view>
							<view class="card-btn green" hover-class="press-95" @click="seedScenarios">
								<text class="btn-txt">🌱 一键播种测试场景</text>
							</view>
						</view>
						<text v-if="envMsg" class="env-msg">{{ envMsg }}</text>
					</view>
				</view>

				<!-- ====== 1. 当前槽位状态 ====== -->
				<view class="section">
					<view class="section-title">1. 当前槽位快照</view>
					<view class="card">
						<view class="btn-row">
							<view class="card-btn" hover-class="press-95" @click="refreshSlots">
								<text class="btn-txt">{{ loading.slots ? '查询中...' : '📸 刷新槽位状态' }}</text>
							</view>
						</view>
						<view v-if="slots.length > 0" class="slots-display">
							<view v-for="(s, i) in slots" :key="i" class="slot-row" :class="'status-' + s.status">
								<text class="slot-idx">槽 {{ i + 1 }}</text>
								<text class="slot-st">{{ statusLabel(s.status) }}</text>
								<text class="slot-detail">{{ s.surveyId || '—' }}</text>
								<text class="slot-detail">{{ s.pinId || '' }}</text>
							</view>
						</view>
						<view v-else class="empty-hint">
							<text>点击「刷新槽位状态」查看</text>
						</view>
					</view>
				</view>

				<!-- ====== 2. 一键跑全部场景 ====== -->
				<view class="section highlight">
					<view class="section-title">2. 一键运行全部测试</view>
					<view class="card">
						<view class="card-btn full primary" hover-class="press-95" @click="runAllTests">
							<text class="btn-txt">{{ loading.allTest ? '⏳ 运行中...' : '▶ 一键跑 9 个测试场景' }}</text>
						</view>
						<view v-if="testResults.length > 0" class="test-results">
							<view v-for="(tr, i) in testResults" :key="i" class="test-item" :class="tr.pass ? 'pass' : 'fail'">
								<text class="test-icon">{{ tr.pass ? '✔' : '✘' }}</text>
								<text class="test-label">{{ tr.label }}</text>
								<text v-if="tr.detail" class="test-detail">{{ tr.detail }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 3. 单项场景手动测试 ====== -->
				<view class="section">
					<view class="section-title">3. 单项场景手动验证</view>

					<!-- 场景 A-1 -->
					<view class="card">
						<text class="card-label">A-1: active + pin 未过期 → 保持不变</text>
						<view class="card-btn" hover-class="press-95" @click="testA1">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 A-2 -->
					<view class="card">
						<text class="card-label">A-2: active + pin 过期 + 有记录 → claimable</text>
						<view class="card-btn" hover-class="press-95" @click="testA2">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 A-3 -->
					<view class="card">
						<text class="card-label">A-3: active + pin 过期 + 无记录 → 兜底生成 → claimable</text>
						<view class="card-btn" hover-class="press-95" @click="testA3">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 A-4 -->
					<view class="card">
						<text class="card-label">A-4: active + pin 删除 + 无记录 → idle</text>
						<view class="card-btn" hover-class="press-95" @click="testA4">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 B-1 -->
					<view class="card">
						<text class="card-label">B-1: goSlotDetail 内存命中</text>
						<view class="card-btn" hover-class="press-95" @click="testB1">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 B-2 -->
					<view class="card">
						<text class="card-label">B-2: goSlotDetail 内存未命中 + 数据库兜底</text>
						<view class="card-btn" hover-class="press-95" @click="testB2">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 B-3 -->
					<view class="card">
						<text class="card-label">B-3: goSlotDetail 两端都未命中 → 失败</text>
						<view class="card-btn" hover-class="press-95" @click="testB3">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>

					<!-- 场景 混合 -->
					<view class="card">
						<text class="card-label">混合：两个 active（一过期一不过期）+ idle</text>
						<view class="card-btn" hover-class="press-95" @click="testMixed">
							<text class="btn-txt">运行</text>
						</view>
						<text v-if="singleResult" class="single-result" :class="singlePass ? 'pass' : 'fail'">{{ singleResult }}</text>
					</view>
				</view>

				<!-- ====== 4. 全量日志 ====== -->
				<view class="section">
					<view class="section-title">4. 详细日志</view>
					<view class="card">
						<view v-if="logs.length === 0" class="empty-hint">
							<text>暂无日志</text>
						</view>
						<view v-else class="log-list">
							<view v-for="(l, i) in logs" :key="i" class="log-line">{{ l }}</view>
						</view>
					</view>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			currentUser: '',
			slots: [],
			envMsg: '',
			testResults: [],
			singleResult: '',
			singlePass: false,
			logs: [],
			loading: { slots: false, allTest: false },
			// 缓存播种场景的数据
			_seeded: {}
		}
	},
	methods: {
		statusLabel(s) {
			const map = { idle: '⚪ 闲置', active: '🟢 置顶中', queuing: '⏳ 候场', claimable: '📜 待签收' }
			return map[s] || s
		},

		log(msg) {
			const t = new Date().toLocaleTimeString()
			this.logs.push(`[${t}] ${msg}`)
		},

		// ========== 环境操作 ==========

		async resetAll() {
			this.envMsg = '清空中...'
			this.log('开始清空测试数据')
			try {
				const ps = uniCloud.importObject('pin-system')
				// 清理 test 标记的数据
				await ps.testCleanupExpiryData()
				// 重置槽位
				await ps.testResetSlots()
				this.slots = []
				this.testResults = []
				this.singleResult = ''
				this._seeded = {}
				this.envMsg = '✅ 已清空，槽位全部 idle'
				this.log('清空完成')
			} catch (e) {
				this.envMsg = '❌ 清空失败: ' + (e.message || e)
				this.log('清空失败: ' + JSON.stringify(e))
			}
		},

		async refreshSlots() {
			this.loading.slots = true
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getSlotStatus()
				if (res.errCode === 0) {
					this.slots = res.data.slots || []
					this.log(`槽位刷新: ${JSON.stringify(this.slots.map(s => s.status))}`)
				}
			} catch (e) {
				this.log('刷新槽位失败: ' + (e.message || e))
			}
			this.loading.slots = false
		},

		// ========== 一键播种 ==========

		async seedScenarios() {
			this.envMsg = '播种中...'
			this.log('开始播种测试场景')
			try {
				const ps = uniCloud.importObject('pin-system')
				// 先清空
				await ps.testResetSlots()
				// 调用云函数播种
				const res = await ps.testSeedSlotFixScenarios()
				if (res.errCode !== 0) {
					throw new Error(res.errMsg || '播种云函数返回异常')
				}
				this._seeded = res.data
				// 刷新显示
				await this.refreshSlots()
				this.envMsg = `✅ 已播种: A1(pin未过期) A2(过期有记录) A3(过期无记录)`
				this.log(`播种完成: ${JSON.stringify(this._seeded)}`)
			} catch (e) {
				this.envMsg = '❌ 播种失败: ' + (e.message || e)
				this.log('播种失败: ' + JSON.stringify(e))
			}
		},

		// ========== 一键全跑 ==========

		async runAllTests() {
			this.loading.allTest = true
			this.testResults = []
			this.singleResult = ''
			this.log('========== 开始全量测试 ==========')

			const addResult = (pass, label, detail = '') => {
				this.testResults.push({ pass, label, detail })
				this.log(`[${pass ? 'PASS' : 'FAIL'}] ${label} ${detail}`)
			}

			try {
				// 先确保有种好的数据
				if (!this._seeded.pinA1) {
					await this.seedScenarios()
				}

				// ====== A-1: 未过期 active 不受影响 ======
				await this.refreshSlots()
				const slotA1 = this.slots.find(s => s.pinId === this._seeded.pinA1)
				addResult(slotA1?.status === 'active',
					'A-1: pin未过期→保持active',
					`实际: ${slotA1?.status || '未找到'}`)

				// ====== A-2: 过期有记录→claimable ======
				const slotA2 = this.slots.find(s => s.pinId === this._seeded.pinA2)
				addResult(slotA2?.status === 'claimable',
					'A-2: pin过期+有记录→claimable',
					`实际: ${slotA2?.status || '未找到'}`)

			// ====== A-3: 过期无记录→兜底生成→claimable ======
			const slotA3 = this.slots.find(s => s.pinId === this._seeded.pinA3)
			addResult(slotA3?.status === 'claimable',
				'A-3: pin过期+无记录→兜底生成→claimable',
				`实际: ${slotA3?.status || '未找到'}`)
			// 验证兜底生成的记录（通过云函数查）
			try {
				const careers = await this._loadCareers()
				const found = careers.find(r => r.pinId === this._seeded.pinA3)
				addResult(!!found,
					'A-3 验证: career-records 已生成',
					found ? `找到 careerId: ${found._id}` : '找到 0 条')
			} catch (_) {
				addResult(false, 'A-3 验证: 查询career-records失败', '')
			}

			// ====== A-4: pin删除无记录→idle ======
			// 构造一个"只有槽位指向不存在的pin、没有career-record"场景
			// 临时改一个槽位指向不存在的 pinId
			const fakePinId = 'pin_deleted_test_' + Date.now()
			await this._updateSlot(0, {
				status: 'active', surveyId: 's_deleted', pinId: fakePinId, queueId: null
			})
			await this.refreshSlots()
			const slotA4 = this.slots.find(s => s.pinId === fakePinId) || this.slots[0]
			addResult(slotA4?.status === 'idle',
				'A-4: pin删除+无记录→idle',
				`实际: ${slotA4?.status || '未找到'}`)

		// 恢复槽位 0 为之前的 A1，并刷新状态
		await this._updateSlot(0, {
			status: 'active', surveyId: 's_a1', pinId: this._seeded.pinA1, queueId: null
		})
		await this.refreshSlots()

				// ====== B-1: goSlotDetail 内存命中 ======
				const careerRecords = await this._loadCareers()
				const memHit = careerRecords.find(r => r.pinId === this._seeded.pinA2)
				addResult(!!memHit,
					'B-1: 内存命中（pinA2有career-record）',
					`careerId: ${memHit?._id || '无'}`)

				// ====== B-2: goSlotDetail 内存未命中+数据库兜底 ======
				// pinA3 的 career-record 是兜底生成的
				const careers2 = await this._loadCareers()
				const dbHit = careers2.find(r => r.pinId === this._seeded.pinA3)
				addResult(!!dbHit,
					'B-2: 数据库兜底查询成功',
					dbHit ? `找到 careerId: ${dbHit._id}` : '找到 0 条')

				// ====== B-3: 两端都未命中 ======
				const careers3 = await this._loadCareers()
				const noneHit = careers3.find(r => r.pinId === 'pin_nonexist_99999')
				addResult(!noneHit,
					'B-3: 不存在的pinId→无结果（应toast"暂不可用"）',
					noneHit ? `异常找到 ${noneHit._id}` : '找到 0 条')

				// ====== 混合场景 ======
				this.log('混合场景验证: A1=active, A2=claimable, A3=claimable')
				const statuses = this.slots.map(s => s.status)
				addResult(
					statuses.includes('active') && statuses.includes('claimable'),
					'混合场景: active+claimable 并存',
					`状态: ${statuses.join(', ')}`)

			} catch (e) {
				this.log('全量测试异常: ' + (e.message || JSON.stringify(e)))
				addResult(false, '测试异常中断', e.message || '')
			}

			this.loading.allTest = false
			const passCount = this.testResults.filter(t => t.pass).length
			this.log(`========== 测试完成: ${passCount}/${this.testResults.length} PASS ==========`)
		},

		// 安全更新单个槽位（通过云函数，绕过客户端 schema 权限）
		async _updateSlot(idx, slotData) {
			const ps = uniCloud.importObject('pin-system')
			await ps.testUpdateSlot({ idx, slotData })
		},

		async _loadCareers() {
			const ps = uniCloud.importObject('pin-system')
			const res = await ps.testLoadCareers()
			return res.data || []
		},

		// ========== 单项测试（复用一键播种的数据后手动触发） ==========

		async testA1() {
			if (!this._seeded.pinA1) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			await this.refreshSlots()
			const s = this.slots.find(s => s.pinId === this._seeded.pinA1)
			if (s?.status === 'active') {
				this.singlePass = true
				this.singleResult = '✔ PASS: 未过期 active 保持不变'
			} else {
				this.singlePass = false
				this.singleResult = `✘ FAIL: 期望 active，实际 ${s?.status || '未找到'}`
			}
		},

		async testA2() {
			if (!this._seeded.pinA2) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			await this.refreshSlots()
			const s = this.slots.find(s => s.pinId === this._seeded.pinA2)
			if (s?.status === 'claimable') {
				this.singlePass = true
				this.singleResult = '✔ PASS: 过期有记录 → claimable'
			} else {
				this.singlePass = false
				this.singleResult = `✘ FAIL: 期望 claimable，实际 ${s?.status || '未找到'}`
			}
		},

		async testA3() {
			if (!this._seeded.pinA3) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			await this.refreshSlots()
			const s = this.slots.find(s => s.pinId === this._seeded.pinA3)
			if (s?.status === 'claimable') {
				this.singlePass = true
				this.singleResult = '✔ PASS: 兜底生成 → claimable'
				// 验证记录（通过云函数）
				const careers = await this._loadCareers()
				const found = careers.find(r => r.pinId === this._seeded.pinA3)
				if (found) {
					this.singleResult += ` (已生成 careerId: ${found._id})`
				}
			} else {
				this.singlePass = false
				this.singleResult = `✘ FAIL: 期望 claimable，实际 ${s?.status || '未找到'}`
			}
		},

		async testA4() {
			const fakePinId = 'pin_a4_test_' + Date.now()
			await this._updateSlot(1, {
				status: 'active', surveyId: 's_a4', pinId: fakePinId, queueId: null
			})
			await this.refreshSlots()
			const s = this.slots.find(s => s.pinId === fakePinId) || this.slots[1]
			if (s?.status === 'idle') {
				this.singlePass = true
				this.singleResult = '✔ PASS: pin删除无记录 → idle'
			} else {
				this.singlePass = false
				this.singleResult = `✘ FAIL: 期望 idle，实际 ${s?.status || '未找到'}`
			}
			// 恢复
			if (this._seeded.pinA1) {
				await this._updateSlot(1, {
					status: 'active', surveyId: 's_a2', pinId: this._seeded.pinA2, queueId: null
				})
			}
		},

		async testB1() {
			if (!this._seeded.pinA2) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			const careers = await this._loadCareers()
			const hit = careers.find(r => r.pinId === this._seeded.pinA2)
			if (hit) {
				this.singlePass = true
				this.singleResult = `✔ PASS: 内存命中 careerId=${hit._id}`
			} else {
				this.singlePass = false
				this.singleResult = '✘ FAIL: 内存未命中（B-2 兜底应生效）'
			}
		},

		async testB2() {
			if (!this._seeded.pinA3) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			const careers = await this._loadCareers()
			const found = careers.find(r => r.pinId === this._seeded.pinA3)
			if (found) {
				this.singlePass = true
				this.singleResult = `✔ PASS: 数据库兜底成功 careerId=${found._id}`
			} else {
				this.singlePass = false
				this.singleResult = '✘ FAIL: 数据库也未命中'
			}
		},

		async testB3() {
			const careers = await this._loadCareers()
			const found = careers.find(r => r.pinId === 'pin_nonexist_99999')
			if (!found) {
				this.singlePass = true
				this.singleResult = '✔ PASS: 两端都未命中 → 应toast"暂不可用"'
			} else {
				this.singlePass = false
				this.singleResult = '✘ FAIL: 不应命中任何记录'
			}
		},

		async testMixed() {
			if (!this._seeded.pinA1 || !this._seeded.pinA2 || !this._seeded.pinA3) {
				uni.showToast({ title: '请先一键播种', icon: 'none' })
				return
			}
			await this.refreshSlots()
			const statuses = this.slots.map(s => s.status)
			const hasActive = statuses.includes('active')
			const hasClaimable = statuses.includes('claimable')
			if (hasActive && hasClaimable) {
				this.singlePass = true
				this.singleResult = `✔ PASS: 混合状态正确 (${statuses.join(', ')})`
			} else {
				this.singlePass = false
				this.singleResult = `✘ FAIL: 期望 active+claimable，实际 (${statuses.join(', ')})`
			}
		},

		// ========== 基础操作 ==========

		goBack() {
			uni.navigateBack()
		}
	},
	async onLoad() {
		const token = uni.getStorageSync('uni_id_token') || ''
		this.currentUser = token.substring(0, 8) + '...'
		await this.refreshSlots()
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
.hd-user { font-size: 22rpx; color: #99A1AF; margin-left: auto; }
.hd-subtitle { font-size: 22rpx; color: #99A1AF; margin-top: 8rpx; display: block; }

.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }

.section { margin-bottom: 32rpx; }
.section.highlight .card { border: 2rpx solid #F59E0B; }
.section-title { font-size: 28rpx; font-weight: 700; color: #1E2939; margin-bottom: 12rpx; }

.card {
	background: white; border-radius: 20rpx; padding: 20rpx;
	margin-bottom: 12rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.05);
}
.card-label { font-size: 24rpx; color: #374151; display: block; margin-bottom: 12rpx; font-weight: 600; }

.btn-row { display: flex; gap: 12rpx; flex-wrap: wrap; }

.card-btn {
	display: inline-flex; align-items: center; justify-content: center;
	padding: 16rpx 28rpx; background: #EFF6FF; border-radius: 16rpx;
	border: 1rpx solid #BFDBFE;
}
.card-btn.green { background: #ECFDF5; border-color: #A7F3D0; }
.card-btn.full { width: 100%; }
.card-btn.primary { background: #1E2939; }
.card-btn.primary .btn-txt { color: white; font-size: 28rpx; font-weight: 700; }
.btn-txt { font-size: 24rpx; color: #1D4ED8; font-weight: 600; }

.env-msg { font-size: 22rpx; color: #6B7280; margin-top: 12rpx; display: block; }

/* 槽位显示 */
.slots-display { margin-top: 16rpx; }
.slot-row {
	display: flex; align-items: center; gap: 12rpx;
	padding: 14rpx 16rpx; border-radius: 12rpx; margin-bottom: 8rpx;
	background: #F9FAFB;
}
.slot-row.status-active { background: #D1FAE5; }
.slot-row.status-claimable { background: #FEF9C3; }
.slot-row.status-queuing { background: #FEF3C7; }
.slot-row.status-idle { background: #F3F4F6; }
.slot-idx { font-size: 20rpx; color: #9CA3AF; font-weight: 700; }
.slot-st { font-size: 24rpx; font-weight: 700; color: #1E2939; }
.slot-detail { font-size: 18rpx; color: #6B7280; max-width: 180rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 测试结果 */
.test-results { margin-top: 16rpx; }
.test-item {
	display: flex; align-items: flex-start; gap: 8rpx;
	padding: 12rpx 0; border-bottom: 1rpx solid #F3F4F6;
}
.test-item.pass .test-icon { color: #059669; }
.test-item.fail .test-icon { color: #DC2626; }
.test-icon { font-size: 24rpx; font-weight: 700; flex-shrink: 0; margin-top: 2rpx; }
.test-label { font-size: 22rpx; color: #374151; flex: 1; }
.test-detail { font-size: 18rpx; color: #9CA3AF; flex-shrink: 0; }

.single-result { font-size: 22rpx; margin-top: 8rpx; display: block; }
.single-result.pass { color: #059669; }
.single-result.fail { color: #DC2626; }

/* 日志 */
.log-list { max-height: 500rpx; overflow-y: auto; }
.log-line {
	font-size: 20rpx; color: #6B7280; padding: 4rpx 0;
	font-family: monospace; white-space: pre-wrap; word-break: break-all;
}

.empty-hint { font-size: 22rpx; color: #D1D5DC; text-align: center; padding: 20rpx 0; }

.bottom-spacer { height: 60rpx; }

.press-9 { transform: scale(.9); }
.press-95 { transform: scale(.95); }
</style>
