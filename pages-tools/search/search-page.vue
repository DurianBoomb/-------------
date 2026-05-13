<!-- ========== 搜索页 ========== -->
<template>
	<view class="page">
		<!-- 顶部：返回按钮行 + 搜索栏行 -->
		<view class="top-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<!-- 返回按钮行（与胶囊平齐） -->
			<view class="nav-row" :style="{ height: capsuleH + 'px', marginTop: capsuleGap + 'px' }">
				<view class="back-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<text class="back-icon">←</text>
				</view>
			</view>
			<!-- 搜索栏行（胶囊下方） -->
			<view class="search-row">
				<view class="search-input">
					<text class="search-icon">🔍</text>
					<input
						class="input-field"
						v-model="keyword"
						placeholder="搜点啥，万一有呢..."
						:focus="true"
						@input="onSearch"
					/>
				</view>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">

			<!-- 搜索结果区域 -->
			<view class="result-area" v-if="!keyword">
				<text class="default-text">输入点什么吧，你不打字我怎么知道你想测啥 🥱</text>
			</view>
			<view class="result-area has-results" v-else>
			<view
				v-for="(item, idx) in searchResults"
				:key="idx"
				class="result-item"
				hover-class="press-98"
				:hover-start-time="0"
				:hover-stay-time="150"
				@click="goQuiz(item.tag)"
			>
					<view class="result-emoji" :style="{ background: item.bg }">
						<text>{{ item.emoji }}</text>
					</view>
					<view class="result-info">
						<text class="result-title">{{ item.tag }}</text>
					</view>
					<view class="result-star" hover-class="press-9" :hover-start-time="0" :hover-stay-time="100" @click.stop="toggleFav(item.tag)">
						<text>{{ favorites[item.tag] ? '⭐' : '☆' }}</text>
					</view>
				</view>
			</view>

			<!-- 翻翻看 -->
			<view class="section-title">✨ 翻翻看有没有感兴趣的</view>

			<!-- 分类手风琴 -->
			<view class="accordion">
				<view
					v-for="(cat, ci) in categories"
					:key="ci"
					class="accordion-item"
					:class="{ 'item-expanded': cat.expanded }"
				>
					<view class="accordion-header" hover-class="press-bg" :hover-start-time="0" :hover-stay-time="150" @click="toggleCategory(ci)">
						<view class="accordion-left">
							<view class="accordion-emoji-wrap">
								<text class="accordion-emoji">{{ cat.emoji }}</text>
							</view>
							<text class="accordion-name" :class="{ 'name-active': cat.expanded }">{{ cat.name }}</text>
						</view>
						<view class="accordion-arrow-wrap" :class="{ 'arrow-expanded': cat.expanded }">
							<text class="accordion-arrow" :class="{ open: cat.expanded }">▾</text>
						</view>
					</view>
					<view class="accordion-body" :class="{ 'body-open': cat.expanded }">
						<view v-if="cat.expanded" class="body-inner">
							<view class="tag-pool-header">
								<text class="tag-pool-subtitle">{{ cat.subtitle }}</text>
								<view class="refresh-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="refreshCategory(ci)">
									<view :class="{ 'spinning': cat.refreshing }" class="spin-icon">🔄</view>
									<text> 换一换</text>
								</view>
							</view>
							<!-- 用 v-if 控制标签网格重建（小程序不支持 :key 表达式） -->
							<view :key="'grid-' + cat.refreshId" class="tag-grid">
								<view
									v-for="(t, ti) in cat.tags"
									:key="ti"
									class="tag-wrapper"
									hover-class="press-9"
									:hover-start-time="0"
									:hover-stay-time="150"
									@click="goQuiz(t.name)"
								>
									<view :class="'tag-inner ' + t.cls" :style="t.animStyle">
										<text>{{ t.name }}</text>
									</view>
								</view>
							</view>
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
console.log('[DEBUG] search-page.vue module loaded')
export default {
		data() {
			return {
				keyword: '',
				searchResults: [],
				allTags: [],
				categories: [],
				_categoryMap: {},
				favorites: {},
				animReset: false,
				// 导航定位
				statusBarHeight: 44,
				capsuleH: 32,
				capsuleGap: 0
			}
		},

	onLoad() {
		try {
			const sys = uni.getSystemInfoSync()
			const menu = uni.getMenuButtonBoundingClientRect()
			this.statusBarHeight = sys.statusBarHeight
			this.capsuleH = menu.height
			this.capsuleGap = menu.top - sys.statusBarHeight
		} catch (e) {
			// 降级默认值
		}
		this.loadData()
	},

	methods: {
		async loadData() {
			try {
				const survey = uniCloud.importObject('survey')

				let catList = []
				let tags = []
				for (let i = 0; i < 3; i++) {
					try {
						const catRes = await survey.getCategories()
						catList = (catRes.data || [])
						break
					} catch (e) {
						if (i === 2) console.error('[search] getCategories error:', e)
						await new Promise(r => setTimeout(r, 500))
					}
				}
				for (let i = 0; i < 3; i++) {
					try {
						const tagRes = await survey.getTagList({ pageSize: 999 })
						tags = (tagRes.data && tagRes.data.list) || []
						break
					} catch (e) {
						if (i === 2) console.error('[search] getTagList error:', e)
						await new Promise(r => setTimeout(r, 500))
					}
				}

				this.allTags = tags
				this.loadFavorites()

				const catMap = {}
				catList.forEach(c => { catMap[c._id] = c })
				this._categoryMap = catMap

				const catTags = {}
				tags.forEach(t => {
					const catId = t.category
					if (!catTags[catId]) catTags[catId] = []
					catTags[catId].push(t)
				})

				this.categories = catList.map(c => {
					const allTags = (catTags[c._id] || []).map(t => ({
						name: t.name,
						cls: 'tag-' + (t.rarity || 'common')
					}))
					// Fisher-Yates 洗牌后取 16 个
					const arr = [...allTags]
					for (let i = arr.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[arr[i], arr[j]] = [arr[j], arr[i]]
					}
					return {
						name: c.name,
						subtitle: c.subtitle,
						emoji: c.emoji,
						expanded: false,
						showGrid: true,
						refreshId: 0,
						refreshing: false,
						_allTags: allTags,
						tags: arr.slice(0, 16).map((t, i) => ({
							...t,
							animStyle: this.buildAnimStyle(i, 0)
						}))
					}
				})
			} catch (e) {
				console.error('[search] loadData error:', e)
			}
		},

		goBack() {
			uni.navigateBack()
		},

		onSearch() {
			const kw = this.keyword.trim().toLowerCase()
			if (!kw) {
				this.searchResults = []
				return
			}
			if (this._searchTimer) clearTimeout(this._searchTimer)
			this._searchTimer = setTimeout(() => {
				this.searchResults = this.allTags
					.filter(t => t.name.toLowerCase().includes(kw))
					.map(t => ({
						tag: t.name,
						emoji: t.emoji,
						bg: this.tagBgColor(t.name)
					}))
			this.loadFavorites()
			}, 300)
		},

		tagBgColor(name) {
			const colors = ['#FFF7ED', '#FEFCE8', '#EFF6FF', '#F0FFF0', '#F5F0FF', '#FFF0F5', '#F5F5F4']
			let hash = 0
			for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
			return colors[Math.abs(hash) % colors.length]
		},

		toggleCategory(idx) {
			this.categories.forEach((c, i) => {
				c.expanded = i === idx ? !c.expanded : false
			})
		},

		refreshCategory(idx) {
			const cat = this.categories[idx]
			if (cat.refreshing) return
			cat.refreshing = true
			this.animReset = true
			cat.refreshId++
			// 从全部标签中 Fisher-Yates 洗牌取 16 个
			const arr = [...cat._allTags]
			for (let i = arr.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[arr[i], arr[j]] = [arr[j], arr[i]]
			}
			cat.tags = arr.slice(0, 16).map((t, i) => ({
				...t,
				animStyle: this.buildAnimStyle(i, cat.refreshId)
			}))
			this.$nextTick(() => {
				this.animReset = false
				this.$nextTick(() => {
					cat.refreshing = false
				})
			})
		},

		buildAnimStyle(idx, refreshId) {
			const delay = (0.1 + Math.abs(Math.sin(idx + refreshId * 10)) * 0.4).toFixed(2)
			return this.animReset
				? 'animation: none !important'
				: `animation-delay: ${delay}s`
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
				if (res.errCode === 0) this.favorites[tagName] = res.data.favorited
			} catch (e) { console.error('[search] toggleFav:', e) }
		}
	}
}
</script>

<style>
view { box-sizing: border-box; }
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }

/* ====== 顶部白底栏 ====== */
.top-bar {
	background: white;
	padding: 0 16rpx 12rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
}

/* ====== 导航行（返回按钮） ====== */
.nav-row { display: flex; align-items: center; }

.back-btn {
	width: 64rpx; height: 64rpx; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
	border-radius: 50%; background: #F7F8FA;
	transition: transform 0.15s;
}
.back-icon { font-size: 36rpx; color: #1E2939; font-weight: 600; line-height: 1; }

/* ====== 搜索栏行 ====== */
.search-row { margin-top: 12rpx; }
.search-input {
	display: flex; align-items: center;
	background: #F7F8FA; border-radius: 60rpx; padding: 18rpx 24rpx; gap: 10rpx;
	outline: 1rpx solid #F3F4F6; outline-offset: -1rpx;
}
.search-icon { font-size: 24rpx; }
.input-field { flex: 1; font-size: 30rpx; }

/* ====== 滚动区 ====== */
.body { flex: 1; }
.body-inner { padding: 16rpx 40rpx 0; }

/* ====== 搜索结果 ====== */
.result-area { background: rgba(255,255,255,0.5); border-radius: 32rpx; border: 4rpx dashed #E5E7EB; margin-bottom: 24rpx; }
.result-area.has-results { background: white; border-color: transparent; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1); }
.default-text { display: flex; align-items: center; justify-content: center; height: 196rpx; font-size: 26rpx; color: #99A1AF; text-align: center; padding: 0 32rpx; }
.result-item { display: flex; align-items: center; padding: 24rpx; border-bottom: 1rpx solid #F3F4F6; gap: 16rpx; transition: transform 0.15s; }
.result-emoji { width: 80rpx; height: 80rpx; border-radius: 32rpx; display: flex; align-items: center; justify-content: center; font-size: 44rpx; }
.result-info { flex: 1; min-width: 0; }
.result-title { font-size: 28rpx; font-weight: 600; color: #1E2939; display: block; }
.result-star { font-size: 36rpx; padding: 10rpx; flex-shrink: 0; }

/* ====== 分类标题 ====== */
.section-title { font-size: 30rpx; font-weight: 700; color: #1E2939; margin-bottom: 16rpx; }

/* ====== 手风琴 ====== */
.accordion-item {
	background: white; border-radius: 32rpx; margin-bottom: 16rpx; overflow: hidden;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
	outline: 1rpx solid #F3F4F6;
}
.accordion-item.item-expanded {
	outline: 1rpx solid #FFEDD4;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1), 0 0 0 4rpx rgba(255,247,237,0.5);
}
.accordion-header { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 20rpx; }
.accordion-left { display: flex; align-items: center; gap: 12rpx; }
.accordion-emoji-wrap { width: 66rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; }
.accordion-emoji { font-size: 48rpx; box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.15); border-radius: 4rpx; }
.accordion-name { font-size: 30rpx; font-weight: 700; color: #4A5565; }
.accordion-name.name-active { color: #101828; }
.accordion-arrow-wrap {
	width: 48rpx; height: 48rpx; border-radius: 50%;
	background: #F9FAFB; display: flex; align-items: center; justify-content: center;
}
.accordion-arrow-wrap.arrow-expanded { background: #FFF7ED; }
.accordion-arrow { font-size: 20rpx; color: #666; transition: transform 0.3s ease-in-out; }
.accordion-arrow.open { transform: rotate(180deg); }

/* ====== 手风琴主体 ====== */
.accordion-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-in-out, opacity 0.2s; opacity: 0; }
.accordion-body.body-open { max-height: 10000rpx; opacity: 1; }
.accordion-body .body-inner { background: #F7F8FA; padding: 16rpx 20rpx 24rpx; border-top: 1rpx solid rgba(243,244,246,0.5); }

.tag-pool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.tag-pool-subtitle { font-size: 24rpx; color: #99A1AF; font-weight: 500; }
.refresh-btn { font-size: 22rpx; color: #6A7282; background: white; border-radius: 40rpx; padding: 6rpx 16rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1); }
.spin-icon { display: inline-block; animation: spin 1s linear infinite; animation-play-state: paused; }
.spinning { animation-play-state: running; }

.tag-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 20rpx; align-items: center; }

/* ====== 标签（外层按压缩放 / 内层掉落动画） ====== */
.tag-wrapper { transition: transform 0.1s ease-out; }
.press-9 { transform: scale(0.9); }

.tag-inner {
	border-radius: 40rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	animation-name: dropElastic; animation-duration: 0.6s;
	animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); animation-fill-mode: both;
	max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tag-common { padding: 10rpx 18rpx; font-size: 22rpx; font-weight: 400; background: #F7F8FA; color: #101828; border: 1rpx solid #D1D5DC; box-shadow: none; }
.tag-rare { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: white; color: #4FC3F7; border: 1rpx solid #4FC3F7; }
.tag-epic { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: white; color: #A855F7; border: 1rpx solid #A855F7; }
.tag-darkgold { /* 暗金 — 设计中 */ }
/* ====== 交互反馈 ====== */
.press-98 { transform: scale(0.98); }
.press-95 { transform: scale(0.95); }
.press-bg { background: rgba(0,0,0,0.03); }

/* ====== 底部安全（防截断 spacer） ====== */
.bottom-spacer { height: 60rpx; width: 100%; }

/* ====== 动画 ====== */
@keyframes dropElastic {
	0% { opacity: 0; transform: translateY(-80rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}
</style>
