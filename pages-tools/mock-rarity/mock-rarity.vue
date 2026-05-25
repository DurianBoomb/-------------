<!-- ========== 稀有度升级 Mock ========== -->
<template>
	<view class="page">
		<view class="header">
			<view class="back-btn" @click="goBack">
				<image class="back-icon" src="/static/left.svg" mode="aspectFit"></image>
			</view>
			<text class="title">稀有度升级 Mock</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">

				<!-- 当前分布 -->
				<view class="card">
					<text class="card-title">当前稀有度分布</text>
					<view class="grid">
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#D1D5DC"></view>
								<text class="stat-label">普通</text>
							</view>
							<text class="stat-num">{{ dist.common || '...' }}</text>
						</view>
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#4FC3F7"></view>
								<text class="stat-label">稀有</text>
							</view>
							<text class="stat-num">{{ dist.rare || '...' }}</text>
						</view>
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#22C55E"></view>
								<text class="stat-label">神话</text>
							</view>
							<text class="stat-num">{{ dist.mythic || '...' }}</text>
						</view>
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#A855F7"></view>
								<text class="stat-label">史诗</text>
							</view>
							<text class="stat-num">{{ dist.epic || '...' }}</text>
						</view>
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#EF4444"></view>
								<text class="stat-label">传奇</text>
							</view>
							<text class="stat-num">{{ dist.legendary || '...' }}</text>
						</view>
						<view class="stat">
							<view class="stat-row">
								<view class="dot" style="background:#C9A84C"></view>
								<text class="stat-label">暗金</text>
							</view>
							<text class="stat-num">{{ dist.darkgold || '...' }}</text>
						</view>
					</view>
				</view>

				<!-- 查询按钮 -->
				<button
					class="btn btn-query"
					:disabled="queryLoading"
					:loading="queryLoading"
					@click="handleQuery"
				>
					{{ queryLoading ? '查询中...' : '查询各稀有度数量' }}
				</button>

				<!-- 方案 A：一键分配 -->
				<button
					class="btn btn-plan-a"
					:disabled="planALoading"
					:loading="planALoading"
					@click="handlePlanA"
				>
					{{ planALoading ? '分配中...' : '方案 A：一键分配' }}
				</button>
				<text class="btn-desc">稀有→史诗50 + 稀有→神话60 + 普通→稀有74（目标：普通125 稀有87 神话60 史诗50）</text>

				<!-- 史诗→传奇 -->
				<button
					class="btn btn-epic-to-legendary"
					:disabled="epicLoading"
					:loading="epicLoading"
					@click="handleEpicToLegendary"
				>
					{{ epicLoading ? '转换中...' : '史诗全部 → 传奇' }}
				</button>
				<text class="btn-desc">将当前全部的史诗标签改为传奇稀有度</text>

				<!-- 操作按钮 -->
				<button
					class="btn btn-primary"
					:disabled="loading"
					:loading="loading"
					@click="handleUpgrade"
				>
					{{ loading ? '执行中...' : '执行升级' }}
				</button>
				<text class="btn-desc">从 common 中随机选 90 个 → 神话  +  40 个 → 传奇</text>

				<!-- 结果提示 -->
				<view class="result-msg" v-if="resultMsg">
					<text class="msg-text">{{ resultMsg }}</text>
				</view>

				<!-- 预览区 -->
				<view class="preview-card" v-if="showPreview">
					<text class="preview-title">预览效果</text>
					<view class="tag-row">
						<view class="demo-tag tag-mythic"><text>神话标签</text></view>
						<view class="demo-tag tag-legendary"><text>传奇标签</text></view>
					</view>
				</view>

			</view>
		</scroll-view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			queryLoading: false,
			loading: false,
			epicLoading: false,
			planALoading: false,
			resultMsg: '',
			showPreview: false,
			dist: {}
		}
	},
	onLoad() {
		this.loadDistribution()
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		async loadDistribution() {
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getRarityDistribution()
				if (res.errCode === 0) {
					this.dist = res.data.distribution || {}
					return res.data
				}
				return null
			} catch (e) {
				return null
			}
		},
		async handleQuery() {
			this.queryLoading = true
			this.resultMsg = ''
			const data = await this.loadDistribution()
			if (data && data.total !== undefined) {
				this.resultMsg = `总计 ${data.total} 个标签`
			} else {
				this.resultMsg = '查询失败，请检查云函数是否已上传'
			}
			this.queryLoading = false
		},
		async handleEpicToLegendary() {
			this.epicLoading = true
			this.resultMsg = ''
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.mockEpicToLegendary()
				if (res.errCode === 0) {
					this.dist = res.data.distribution || {}
					if (res.data.count === 0) {
						this.resultMsg = '没有史诗标签需要转换'
					} else {
						this.resultMsg = `史诗 → 传奇：共 ${res.data.count} 个\n${res.data.names.join('、')}`
					}
				} else {
					this.resultMsg = res.errMsg || '转换失败'
				}
			} catch (e) {
				this.resultMsg = '请求失败: ' + (e.message || e)
			}
			this.epicLoading = false
		},
		async handlePlanA() {
			this.planALoading = true
			this.resultMsg = ''
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.mockRedistribute()
				if (res.errCode === 0) {
					this.dist = res.data.distribution || {}
					const s = res.data.steps
					this.resultMsg = `稀有→史诗 ${s['稀有→史诗']} | 稀有→神话 ${s['稀有→神话']} | 普通→稀有 ${s['普通→稀有']}`
					this.showPreview = true
				} else {
					this.resultMsg = res.errMsg || '分配失败'
				}
			} catch (e) {
				this.resultMsg = '请求失败: ' + (e.message || e)
			}
			this.planALoading = false
		},
		async handleUpgrade() {
			this.loading = true
			this.resultMsg = ''
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.mockUpgradeRarity()
				if (res.errCode === 0) {
					this.dist = res.data.distribution || {}
					this.resultMsg = `升级完成：神话 +${res.data.mythic} | 传奇 +${res.data.legendary}`
					this.showPreview = true
				} else {
					this.resultMsg = res.errMsg || '失败'
				}
			} catch (e) {
				this.resultMsg = '请求失败: ' + (e.message || e)
			}
			this.loading = false
		}
	}
}
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }
.header {
	display: flex; align-items: center; padding: 24rpx 32rpx;
	background: white; border-bottom: 1rpx solid #F0F0F0;
	padding-top: calc(24rpx + var(--status-bar-height));
}
.back-btn { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; }
.back-icon { width: 32rpx; height: 32rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #1E2939; margin-left: 16rpx; }

.body { flex: 1; }
.body-inner { padding: 32rpx; }

.card {
	background: white; border-radius: 24rpx; padding: 32rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	margin-bottom: 32rpx;
}
.card-title { font-size: 28rpx; font-weight: 600; color: #6B7280; display: block; margin-bottom: 24rpx; }
.grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.stat {
	flex: 0 0 calc(50% - 8rpx); display: flex; justify-content: space-between;
	align-items: center; padding: 16rpx 20rpx; background: #F7F8FA; border-radius: 12rpx;
}
.stat-row { display: flex; align-items: center; gap: 10rpx; }
.dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.stat-label { font-size: 26rpx; color: #374151; }
.stat-num { font-size: 32rpx; font-weight: 700; color: #1E2939; }

.btn { width: 100%; height: 96rpx; border-radius: 48rpx; font-size: 32rpx; font-weight: 700; border: none; line-height: 96rpx; margin: 0; }
.btn::after { border: none; }
.btn-primary { background: linear-gradient(135deg, #22C55E, #16A34A); color: white; }
.btn-query { background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; margin-bottom: 24rpx; }
.btn-plan-a { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; margin-bottom: 24rpx; }
.btn-epic-to-legendary { background: linear-gradient(135deg, #A855F7, #7C3AED); color: white; margin-bottom: 24rpx; }
.btn-desc { display: block; text-align: center; font-size: 24rpx; color: #9CA3AF; margin-top: 16rpx; }

.result-msg {
	margin-top: 24rpx; padding: 24rpx; background: #ECFDF5; border-radius: 16rpx;
	border: 1rpx solid #A7F3D0;
}
.msg-text { font-size: 28rpx; color: #065F46; font-weight: 500; }

.preview-card {
	margin-top: 32rpx; background: white; border-radius: 24rpx; padding: 32rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
}
.preview-title { font-size: 28rpx; font-weight: 600; color: #6B7280; display: block; margin-bottom: 20rpx; }
.tag-row { display: flex; gap: 20rpx; }
.demo-tag {
	display: inline-flex; align-items: center; border-radius: 40rpx;
	padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500;
	border: 1rpx solid; background: white;
}
.tag-mythic { color: #22C55E; border-color: #22C55E; }
.tag-legendary { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; color: #EF4444; border-color: #EF4444; }
</style>
