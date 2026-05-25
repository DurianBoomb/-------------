<!-- ========== 问卷首页（工具卡片入口） ========== -->
<template>
	<view class="page">
		<!-- 顶部品牌区 -->
		<view class="header">
			<view class="header-top">
				<view class="header-left" @click="goBack">
					<view class="brand">
						<image class="brand-emoji" src="/static/给狐狸.png" mode="aspectFit"></image>
						<text class="brand-title">快乐大狐狸</text>
					</view>
				</view>
				<view class="header-right">
					<view class="icon-btn" @click="goMockRarity">
						<text>🔧</text>
					</view>
					<view class="icon-btn" @click="goProfile">
						<text>🥸</text>
					</view>
					<view class="icon-btn" @click="goFav">
						<text>⭐</text>
					</view>
					<view class="icon-btn" @click="goCareer">
						<text>📂</text>
					</view>
					<view class="icon-btn" @click="goGenerated">
						<text>🪄</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 看广告置顶入口 -->
		<pin-terminal-entry
			:surveyId="currentSurveyId"
			@pinned="onPinned">
		</pin-terminal-entry>

		<!-- 置顶栏 -->
		<pin-topbar ref="pinTopbar"></pin-topbar>

		<scroll-view class="body" scroll-y>
			<!-- 内部容器：解决 scroll-view padding 不生效的问题 -->
			<view class="body-inner">

				<!-- 搜索栏 -->
				<view class="search-bar" @click="goSearch">
					<text class="search-icon">🔍</text>
					<text class="search-placeholder">搜点啥，万一有呢...</text>
				</view>

				<!-- 随便测测 -->
				<view class="random-card" @click="goRandom" hover-class="card-press" :hover-start-time="0" :hover-stay-time="0">
					<view class="random-left">
						<view class="random-title-row">
							<text class="dice-icon">🎲</text>
							<text class="random-title">随便测测</text>
						</view>
						<text class="random-desc">瞎选一个，反正测出来也不准</text>
					</view>
				<view class="random-arrow">
					<image class="random-arrow-img" src="/static/right.svg" mode="aspectFit"></image>
				</view>
				</view>

				<!-- 标签池 -->
				<view class="tag-pool">
				<view class="tag-pool-header">
					<text class="tag-pool-title">🏷️ 随便逛逛</text>
					<view class="tag-pool-actions">
						<view class="refresh-btn" @click="handleRefresh">
							<view class="icon-wrapper" :style="{ transform: 'rotate(' + spinDeg + 'deg)' }">🔄</view>
							<text>换一换</text>
						</view>
						<view class="mock-btn" @click="handleMockRefresh">🎲 Mock</view>
					</view>
				</view>

					<view class="tag-grid">
						<view
							v-for="tag in processedTags" :key="tag.key"
							class="tag-wrapper"
							hover-class="tag-press"
							:hover-start-time="0" :hover-stay-time="150"
							@click="goQuiz(tag.name)"
						>
							<view :class="['tag-inner', tag.classStr, animFlip ? 'anim-a' : 'anim-b']" :style="tag.animStyle">
								<text>{{ tag.name }}</text>
								<text v-if="tag.rarity === 'darkgold'" class="sparkle-tail">✨</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 精选发疯 -->
				<view class="recommend">
					<text class="recommend-title">✨ 精选发疯</text>
					<view
						v-for="(item, idx) in recommendList" :key="idx"
						class="recommend-card"
						hover-class="card-press"
						@click="goQuiz(item.tag)"
					>
						<view class="rec-emoji" :style="{ background: item.bgColor }">
							<text>{{ item.emoji }}</text>
						</view>
						<view class="rec-info">
							<text class="rec-name">{{ item.tag }}</text>
							<text class="rec-desc">{{ item.description }}</text>
						</view>
						<view class="rec-star" hover-class="star-press" :hover-start-time="0" :hover-stay-time="100" @click.stop="toggleFav(item.tag)">
							<text>{{ favorites[item.tag] ? '⭐' : '☆' }}</text>
						</view>
					</view>
				</view>

				<view class="bottom-spacer"></view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>

		<!-- 未读档案弹窗 -->
		<view v-if="showCareerPopup" class="career-popup-overlay" @click="dismissCareerPopup">
			<view class="career-popup" @click.stop>
				<view class="career-popup-hd">
					<image class="career-popup-stamp" src="/static/给狐狸.png" mode="aspectFit"></image>
					<text class="career-popup-title">15分钟名气管理局</text>
					<text class="career-popup-sub">临时名人档案 · 新到</text>
				</view>
				<view class="career-popup-body">
					<text class="career-popup-honor">🏆 {{ (currentCareer && currentCareer.honor && currentCareer.honor.name) || '内容创作者' }}</text>
					<text class="career-popup-survey">「{{ (currentCareer && currentCareer.surveyTitle) || '' }}」</text>
					<view class="career-popup-stats">
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ formatNum(currentCareer && currentCareer.stats && currentCareer.stats.views) }}</text>
							<text class="career-popup-label">驻足注视</text>
						</view>
						<text class="career-popup-sep">|</text>
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ formatNum(currentCareer && currentCareer.stats && currentCareer.stats.clicks) }}</text>
							<text class="career-popup-label">好奇打开</text>
						</view>
						<text class="career-popup-sep">|</text>
						<view class="career-popup-stat">
							<text class="career-popup-num">{{ formatNum(currentCareer && currentCareer.stats && currentCareer.stats.favorites) }}</text>
							<text class="career-popup-label">决定存档</text>
						</view>
					</view>
					<view v-if="currentCareer && currentCareer.bonusTriggered" class="career-popup-bonus">
						<text>⚡ 暴击触发 ×{{ currentCareer.bonusMultiplier ? currentCareer.bonusMultiplier.toFixed(1) : '1.5' }}</text>
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
	</view>
</template>

<script>
import PinTerminalEntry from '@/components/pin-terminal-entry/pin-terminal-entry.vue'
import PinTopbar from '@/components/pin-topbar/pin-topbar.vue'

export default {
	components: { PinTerminalEntry, PinTopbar },
		data() {
		return {
			spinDeg: 0,
			currentSurveyId: '',
			// 未读档案
			pendingCareers: [],
			showCareerPopup: false,
			currentCareer: null,
			careerIndex: 0,
			refreshId: 0,
			isRefreshing: false,
			// 分享标志位：广播出去时暂存档案信息，供 onShareAppMessage 读取
			_sharingCareer: null,
			animFlip: false,
			activeTags: [],
			allTags: [],
			recommendList: [],
			favorites: {},
			_favListener: null,
		}
	},

	computed: {
		processedTags() {
			return this.activeTags.map((tag, idx) => {
				const rarity = tag.rarity || 'common'
				const cls = 'tag-' + rarity
				const delay = (0.1 + Math.abs(Math.sin(idx + this.refreshId * 10)) * 0.4).toFixed(2)
				return {
					...tag,
					key: tag.name + idx + this.refreshId,
					classStr: cls,
					animStyle: `animation-delay: ${delay}s`
				}
			})
		}
	},

	onShow() {
		this.loadTags()
		this.loadFavorites()
		// 刷新置顶栏（pinTopbar.refresh() 内部调用 pinSystem.draw()）
		this.$nextTick(() => {
			this.$refs.pinTopbar?.refresh()
		})
		// 检查未读战绩档案
		this.checkUnreadCareer()
	},
	onReady() {
		this.$nextTick(() => {
			this.$refs.pinTopbar?.refresh()
		})
	},
	onUnload() {
		if (this._favListener) {
			uni.$off('uni-id-pages-login-success', this._favListener)
			this._favListener = null
		}
	},

	onShareAppMessage() {
		if (this._sharingCareer) {
			const career = this._sharingCareer
			this._sharingCareer = null
			return {
				title: `我在快乐大狐狸获得了「${career.honor?.name || '内容创作者'}」称号`,
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
		async loadTags() {
			try {
				const survey = uniCloud.importObject('survey')
				let res = null
				for (let i = 0; i < 3; i++) {
					try {
						res = await survey.getTagList({ pageSize: 999, sortBy: 'popularity' })
						if (res) break
					} catch (retryErr) {
						if (i === 2) throw retryErr
						await new Promise(r => setTimeout(r, 500))
					}
				}
				if (!res) return
				if (res.errCode === 0 && res.data) {
					const list = res.data.list || []
					this.allTags = list
					this.recommendList = list.slice(0, 3).map(t => ({
						emoji: t.emoji,
						tag: t.name,
						description: t.description,
						bgColor: this.tagBgColor(t.name)
					}))
					this.shuffleTags()
					this.loadFavorites()
				}
			} catch (e) {
				console.error('[quiz-home] loadTags error:', e)
			}
		},

		tagBgColor(name) {
			const colors = ['#FFF7ED', '#FEFCE8', '#EFF6FF', '#F0FFF0', '#F5F0FF', '#FFF0F5', '#F5F5F4']
			let hash = 0
			for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
			return colors[Math.abs(hash) % colors.length]
		},

		handleRefresh() {
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.spinDeg += 360
			this.animFlip = !this.animFlip
			this.shuffleTags()
			this.refreshId++
			this.$nextTick(() => {
				setTimeout(() => {
					this.isRefreshing = false
				}, 500)
			})
		},

		handleMockRefresh() {
			if (this.isRefreshing) return
			this.isRefreshing = true
			this.spinDeg += 360
			this.animFlip = !this.animFlip
			// 从 allTags 中找暗金标签
			const dg = this.allTags.find(t => t.rarity === 'darkgold')
			const arr = [...this.allTags]
			if (dg) {
				// 把暗金标签移到数组前 3 位，确保 calculateTagsForRows 能选到它
				const dgIdx = arr.indexOf(dg)
				if (dgIdx > 2) {
					arr.splice(dgIdx, 1)
					arr.splice(2, 0, dg)
				}
			}
			this.activeTags = this.calculateTagsForRows(arr, 7)
			this.refreshId++
			this.$nextTick(() => {
				setTimeout(() => {
					this.isRefreshing = false
				}, 500)
			})
		},

		shuffleTags() {
			const arr = [...this.allTags]
			for (let i = arr.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[arr[i], arr[j]] = [arr[j], arr[i]]
			}
			this.activeTags = this.calculateTagsForRows(arr, 7)
		},

		calculateTagsForRows(tags, maxRows) {
			const availableWidth = 750 - 48
			const gap = 20
			const rarityCfg = {
				common: { fontSize: 22, hPad: 18 },
				rare: { fontSize: 26, hPad: 24 },
				mythic: { fontSize: 26, hPad: 24 },
				epic: { fontSize: 36, hPad: 38 },
				legendary: { fontSize: 36, hPad: 38 },
				darkgold: { fontSize: 46, hPad: 44 }
			}
			let rows = 0, rowWidth = 0
			const result = []
			for (const tag of tags) {
				const cfg = rarityCfg[tag.rarity] || rarityCfg.common
				const tagWidth = cfg.hPad * 2 + tag.name.length * cfg.fontSize * 0.85
				if (rowWidth + tagWidth + (result.length > 0 && rowWidth > 0 ? gap : 0) > availableWidth) {
					rows++
					if (rows >= maxRows) break
					rowWidth = tagWidth
				} else {
					rowWidth += tagWidth + (rowWidth > 0 ? gap : 0)
				}
				result.push(tag)
			}
			return result
		},

		goBack() {
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
			} else {
				uni.navigateTo({ url: '/pages/index/index' })
			}
		},
		goSearch() { uni.navigateTo({ url: '/pages-tools/search/search-page' }) },
		goProfile() { uni.navigateTo({ url: '/pages-tools/profile/profile' }) },
		goCareer() { uni.navigateTo({ url: '/pages-tools/career/career-history' }) },
		goFav() { uni.navigateTo({ url: '/pages-tools/favorites/favorites' }) },
		goMockRarity() { uni.navigateTo({ url: '/pages-tools/mock-rarity/mock-rarity' }) },
		goGenerated() { uni.navigateTo({ url: '/pages-tools/my-surveys/my-surveys' }) },
		goRandom() {
			if (this.allTags.length === 0) return
			const tag = this.allTags[Math.floor(Math.random() * this.allTags.length)].name
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag) })
		},
		goQuiz(tag) {
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag) })
		},
		async loadFavorites() {
			if (!uni.getStorageSync('uni_id_token')) return
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getFavorites()
				if (res.errCode === 0 && res.data) {
					res.data.forEach(f => { this.favorites[f.tagName] = true })
				}
			} catch (e) {
				uni.removeStorageSync('uni_id_token')
				uni.removeStorageSync('uni-id-pages-userInfo')
			}
		},
		async toggleFav(tagName) {
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.toggleFavorite({ tagName })
				if (res.errCode === 0) {
					this.favorites[tagName] = res.data.favorited
				}
			} catch (e) { console.error('[quiz-home] toggleFav:', e) }
		},

		// ====== 置顶系统回调 ======

		// 广告置顶完成回调
		onPinned({ action, pinData, queueData }) {
			if (action === 'direct_entry') {
				this.$nextTick(() => {
					this.$refs.pinTopbar?.refresh()
				})
			}
		},

		// ====== 未读档案检测 ======

		async checkUnreadCareer() {
			if (this.showCareerPopup) return
			const cached = uni.getStorageSync('_hasUnreadCareer')
			if (cached === false) return
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.checkCareerStatus()
				if (res.errCode === 0 && res.data?.hasUnread && res.data?.careers?.length > 0) {
					this.pendingCareers = res.data.careers
					this.careerIndex = 0
					this.showNextCareer()
				} else {
					uni.setStorageSync('_hasUnreadCareer', false)
				}
			} catch (e) {
				console.error('[quiz-home] checkUnreadCareer error:', e)
			}
		},

		showNextCareer() {
			if (this.careerIndex < this.pendingCareers.length) {
				this.currentCareer = this.pendingCareers[this.careerIndex]
				this.showCareerPopup = true
			} else {
				this.showCareerPopup = false
				this.currentCareer = null
				this.pendingCareers = []
				uni.setStorageSync('_hasUnreadCareer', false)
			}
		},

		async dismissCareerPopup() {
			const careerId = this.currentCareer?.careerId
			this.showCareerPopup = false
			if (careerId) {
				try {
					const ps = uniCloud.importObject('pin-system')
					await ps.markCareerAsRead({ careerId })
				} catch (e) {
					console.error('[quiz-home] markAsRead error:', e)
				}
			}
			this.careerIndex++
			this.$nextTick(() => { this.showNextCareer() })
		},

		async broadcastCareer() {
			this._sharingCareer = this.currentCareer
			this.dismissCareerPopup()
		},

		formatNum(val) {
			if (typeof val !== 'number') return '--'
			if (val >= 10000) return (val / 10000).toFixed(1) + '万'
			return val.toLocaleString()
		}
	}
}
</script>

<style>
.page {
	width: 100%; min-height: 100vh;
	background: #F7F8FA;
	display: flex; flex-direction: column;
}

/* ====== 头部 ====== */
.header {
	background: white;
	padding: 96rpx 190rpx 32rpx 40rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
	border-radius: 0 0 48rpx 48rpx;
}
.header-top {
	display: flex; justify-content: space-between; align-items: center;
}
.header-left { display: flex; align-items: center; gap: 10rpx; }
.brand { display: flex; align-items: center; gap: 10rpx; }
.brand-emoji { width: 60rpx; height: 60rpx; }
.brand-title { font-size: 40rpx; font-weight: 700; color: #101828; }
.header-right {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8rpx;
	flex-shrink: 0;
}
.icon-btn {
	width: 64rpx; height: 64rpx; background: #F3F4F6;
	border-radius: 50%; display: flex; align-items: center; justify-content: center;
	font-size: 28rpx;
}


/* ====== scroll-view 容器 ====== */
.body { flex: 1; }
/* body-inner 承担实际 padding，避免 scroll-view padding 失效 */
.body-inner { padding: 40rpx 40rpx 0; }

/* ====== 搜索栏 ====== */
.search-bar {
	display: flex; align-items: center;
	background: white; border-radius: 60rpx;
	padding: 23rpx 30rpx; gap: 10rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
	outline: 1rpx solid #F3F4F6; outline-offset: -1rpx;
	margin-bottom: 28rpx;
}
.search-icon { font-size: 28rpx; }
.search-placeholder { font-size: 28rpx; color: #99A1AF; }

/* ====== 随便测测 ====== */
.random-card {
	display: flex; align-items: center; justify-content: space-between;
	background: linear-gradient(90deg, #FFD230 0%, #FF8904 100%);
	border-radius: 56rpx; padding: 34rpx 24rpx;
	box-shadow: 0 4rpx 8rpx -4rpx rgba(0,0,0,0.1), 0 8rpx 12rpx -2rpx rgba(0,0,0,0.1);
	margin-bottom: 28rpx;
}
.card-press { transform: scale(0.96); }
.random-title-row { display: flex; align-items: center; gap: 10rpx; }
.dice-icon { font-size: 28rpx; }
.random-title { font-size: 40rpx; font-weight: 900; color: #441306; }
.random-desc {
	font-size: 28rpx; color: rgba(126,42,12,0.8); font-weight: 500;
	margin-top: 8rpx; display: block;
}
.random-arrow {
	width: 80rpx; height: 80rpx; background: rgba(255,255,255,0.3);
	border-radius: 50%; display: flex; align-items: center; justify-content: center;
	flex-shrink: 0;
}
.random-arrow-img { width: 32rpx; height: 32rpx; }

/* ====== 标签池 ====== */
.tag-pool { margin-bottom: 28rpx; }
.tag-pool-header {
	display: flex; justify-content: space-between; align-items: center;
	margin-bottom: 24rpx;
}
.tag-pool-title { font-size: 36rpx; font-weight: 700; color: #1E2939; }
.refresh-btn {
	display: flex; align-items: center;
	background: white; padding: 8rpx 20rpx; border-radius: 40rpx;
	gap: 6rpx; font-size: 28rpx; color: #6A7282;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
}
.tag-pool-actions {
	display: flex; align-items: center; gap: 12rpx;
}
.mock-btn {
	padding: 8rpx 18rpx; border-radius: 40rpx;
	background: #1A1A1A; color: #C9A84C;
	font-size: 24rpx; font-weight: 700;
	box-shadow: 0 0 6rpx rgba(201,168,76,0.4);
}
.icon-wrapper {
	display: inline-flex;
	transform-origin: center center;
	transition: transform 0.5s cubic-bezier(0.34, 1.25, 0.64, 1);
}

.tag-grid {
	display: flex; flex-wrap: wrap; gap: 20rpx;
}

/* 标签外层按压缩放 */
.tag-wrapper { transition: transform 0.1s ease-out; }
.tag-press { transform: scale(0.9); }

/* 标签内层掉落动画 */
.tag-inner {
	border-radius: 40rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	animation-duration: 0.6s;
	animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); animation-fill-mode: both;
	max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tag-inner.anim-a { animation-name: dropElasticA; }
.tag-inner.anim-b { animation-name: dropElasticB; }

.tag-common { padding: 10rpx 18rpx; font-size: 22rpx; font-weight: 400; background: #F7F8FA; color: #101828; border: 1rpx solid #D1D5DC; box-shadow: none; }
.tag-rare { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: white; color: #4FC3F7; border: 1rpx solid #4FC3F7; }
.tag-mythic { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: white; color: #22C55E; border: 1rpx solid #22C55E; }
.tag-epic { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: white; color: #A855F7; border: 1rpx solid #A855F7; }
.tag-legendary { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: white; color: #EF4444; border: 1rpx solid #EF4444; }
.tag-darkgold {
	padding: 26rpx 44rpx;
	font-size: 46rpx;
	font-weight: 900;
	background: #1A1A1A;
	color: #C9A84C;
	border: 2rpx solid #C9A84C;
	text-shadow: 0 0 8rpx rgba(201, 168, 76, 0.5), 0 0 16rpx rgba(201, 168, 76, 0.3);
}
.tag-darkgold.anim-a {
	animation: dropElasticA 0.6s cubic-bezier(0.34,1.56,0.64,1) both,
	           glowBreath 3s ease-in-out 0.6s infinite;
}
.tag-darkgold.anim-b {
	animation: dropElasticB 0.6s cubic-bezier(0.34,1.56,0.64,1) both,
	           glowBreath 3s ease-in-out 0.6s infinite;
}
.sparkle-tail {
	font-size: 32rpx;
	animation: sparkle 2s ease-in-out infinite;
}

/* ====== 精选发疯 ====== */
.recommend { margin-bottom: 40rpx; }
.recommend-title {
	font-size: 32rpx; font-weight: 700; color: #1E2939; display: block;
	margin-bottom: 24rpx;
}
.recommend-card {
	display: flex; align-items: center;
	background: white; border-radius: 48rpx; padding: 20rpx; gap: 16rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
	margin-bottom: 12rpx; transition: transform 0.15s;
}
.star-press { transform: scale(.85); }
.rec-star { font-size: 36rpx; padding: 10rpx; flex-shrink: 0; }
.rec-emoji {
	width: 96rpx; height: 96rpx; border-radius: 32rpx;
	display: flex; align-items: center; justify-content: center;
	font-size: 48rpx; flex-shrink: 0;
}
.rec-info { flex: 1; min-width: 0; }
.rec-name { font-size: 30rpx; font-weight: 700; color: #1E2939; display: block; }
.rec-desc { font-size: 24rpx; color: #6A7282; display: block; margin-top: 4rpx; }

/* ====== 底部 spacer ====== */
.bottom-spacer { height: 60rpx; width: 100%; }

.press-95 { transform: scale(0.95); transition: transform 0.1s; }

/* ====== 未读档案弹窗 ====== */
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

/* ====== 动画 ====== */
@keyframes dropElasticA {
	0% { opacity: 0; transform: translateY(-80rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
@keyframes dropElasticB {
	0% { opacity: 0; transform: translateY(-80rpx); }
	100% { opacity: 1; transform: translateY(0); }
}

@keyframes glowBreath {
	0%, 100% {
		box-shadow: 0 0 12rpx rgba(201, 168, 76, 0.3), 0 0 24rpx rgba(201, 168, 76, 0.1);
		border-color: #C9A84C;
	}
	50% {
		box-shadow: 0 0 28rpx rgba(201, 168, 76, 0.6), 0 0 56rpx rgba(201, 168, 76, 0.25);
		border-color: #E6C85C;
	}
}

@keyframes sparkle {
	0%, 100% { opacity: 0.4; transform: scale(0.8); }
	50% { opacity: 1; transform: scale(1.1); }
}

</style>
