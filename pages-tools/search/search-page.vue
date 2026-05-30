<!-- ========== 搜索页 ========== -->
<template>
	<view class="page">
		<!-- 顶部：返回按钮行 + 搜索栏行 -->
		<view class="top-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<!-- 返回按钮行（与胶囊平齐） -->
			<view class="nav-row" :style="{ height: capsuleH + 'px', marginTop: capsuleGap + 'px' }">
				<view class="back-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-icon" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<view class="icon-btn icon-btn-debug" @click="_debugInjectTestTasks">
					<text>📋</text>
				</view>
			</view>
			<!-- 搜索栏行（胶囊下方） -->
			<view class="search-row">
				<view class="search-input">
					<text class="search-icon">🔍</text>
					<input
						class="input-field"
						v-model="keyword"
						placeholder="想打印什么标签？"
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
				<text class="default-text">输入标签名，标签机就会给你匹配或设计一套模板</text>
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

				<!-- 自定义标签入口 -->
				<view class="custom-tag-card" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="showCustomPopup">
					<view class="custom-tag-left">
						<text class="custom-tag-symbol">🪄</text>
					</view>
					<view class="custom-tag-body">
						<text class="custom-tag-headline">标签机还没学会这个标签</text>
						<text class="custom-tag-sub">看个广告，现场教它打印新模板！</text>
					</view>
					<text class="custom-tag-arrow">›</text>
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
							<image class="accordion-arrow" :class="{ open: cat.expanded }" src="/static/down.svg" mode="aspectFit"></image>
						</view>
					</view>
					<view class="accordion-body">
						<view v-if="cat.expanded" class="body-inner">
							<view class="tag-pool-header">
								<text class="tag-pool-subtitle">{{ cat.subtitle }}</text>
								<view class="refresh-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="refreshCategory(ci)">
									<view class="icon-wrapper" :style="{ transform: 'rotate(' + cat.spinDeg + 'deg)' }">🔄</view>
									<text> 换一换</text>
								</view>
							</view>
							<view class="tag-grid">
								<view
									v-for="(t, ti) in cat.tags"
									:key="cat.refreshId + '-' + ti"
									class="tag-wrapper"
									hover-class="press-9"
									:hover-start-time="0"
									:hover-stay-time="150"
									:data-tag="t.name"
									@click="handleTagClick"
								>
									<view :class="['tag-inner', t.cls, cat.animFlip ? 'anim-a' : 'anim-b']" :style="t.animStyle">
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

		<!-- ====== 自定义标签弹窗 ====== -->
		<view class="sheet-overlay" v-if="showCustomSheet" @click="hideCustomPopup">
			<view class="sheet-panel" @click.stop>
				<view class="sheet-handle"></view>
				<view class="sheet-header">
					<text class="sheet-title">🖨️ 教标签机打印新模板</text>
					<text class="sheet-close" @click="hideCustomPopup">✕</text>
				</view>
				<view class="sheet-body">
					<text class="sheet-label">标签名称 <text class="required">*</text></text>
					<input
						class="sheet-input"
						v-model="customTagName"
						placeholder="例如：确诊为芋泥波波奶茶"
						maxlength="20"
					/>
					<text class="sheet-label">标签描述 <text class="optional">（选填）</text></text>
					<textarea
						class="sheet-textarea"
						v-model="customTagDesc"
						placeholder="简单说说你想要什么样的标签…"
						maxlength="100"
					/>
				</view>
				<view class="sheet-footer">
					<view class="sheet-btn"
						:class="{ 'sheet-btn-cooldown': generateCooldown }"
						:hover-class="generateCooldown ? '' : 'press-95'"
						:hover-start-time="0"
						:hover-stay-time="150"
						@click="submitCustomTag">
						<text class="sheet-btn-text">
							{{ generateCooldown ? '冷却中 ' + cooldownRemaining + 's' : '看广告，教标签机学习' }}
						</text>
					</view>
				</view>
			</view>
		</view>
		<!-- 底部浮层：正在生成中（章节10） -->
		<view class="queue-float" v-if="queueFloatVisible" @click="toggleQueueFloat">
			<view class="queue-float-bar">
				<text class="queue-float-icon">⏳</text>
				<text class="queue-float-text">正在生成 {{ queueActiveCount }} 个…</text>
				<text class="queue-float-arrow">{{ queueFloatExpanded ? '▲' : '▼' }}</text>
			</view>
			<view class="queue-float-detail" v-if="queueFloatExpanded">
				<view
					class="queue-float-item"
					v-for="t in queueActiveList"
					:key="t.id"
				>
					<text class="queue-item-status">{{ t.status === 'queued' ? '🕐' : '🔄' }}</text>
					<text class="queue-item-name">{{ t.tagName }}</text>
					<text class="queue-item-state">{{ t.status === 'queued' ? '排队中' : '生成中' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
console.log('[DEBUG] search-page.vue module loaded')
import { showLoading, hideLoading } from '@/common/loading.js'
export default {
		data() {
			return {
				keyword: '',
				searchResults: [],
				allTags: [],
				categories: [],
				_categoryMap: {},
				favorites: {},
				// 导航定位
				statusBarHeight: 44,
				capsuleH: 32,
				capsuleGap: 0,
				// 自定义标签弹窗
				showCustomSheet: false,
				customTagName: '',
				customTagDesc: '',
				// 后台生成 + 队列（章节10）
				generateCooldown: false,
				cooldownRemaining: 0,
				queueFloatVisible: false,
				queueFloatExpanded: false,
			queueActiveCount: 0,
			queueActiveList: [],
			_taskPollTimer: null,
			_popChainStopped: false,
			_popChainActive: false,
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
	onShow() {
		this._checkTaskQueue()
		// 轮询：后台生成完成后自动感知
		this._taskPollTimer = setInterval(() => {
			this._checkTaskQueue()
		}, 2000)
	},
	onHide() {
		if (this._taskPollTimer) {
			clearInterval(this._taskPollTimer)
			this._taskPollTimer = null
		}
	},
	beforeDestroy() {
		if (this._cooldownTimer) {
			clearInterval(this._cooldownTimer)
			this._cooldownTimer = null
		}
		if (this._taskPollTimer) {
			clearInterval(this._taskPollTimer)
			this._taskPollTimer = null
		}
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
						refreshId: 0,
						refreshing: false,
						animFlip: false,
						spinDeg: 0,
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
			cat.spinDeg += 360
			cat.animFlip = !cat.animFlip
			cat.refreshId++
			const arr = [...cat._allTags]
			for (let i = arr.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[arr[i], arr[j]] = [arr[j], arr[i]]
			}
			cat.tags = arr.slice(0, 16).map((t, i) => ({
				...t,
				animStyle: this.buildAnimStyle(i, cat.refreshId)
			}))
			setTimeout(() => { cat.refreshing = false }, 500)
		},

		buildAnimStyle(i, refreshId) {
			const row = Math.floor(i / 4)
			const col = i % 4
			const seed = Math.sin(i * 7.13 + refreshId * 3.7) * 0.5 + 0.5
			const delay = (row + col) * 0.04 + seed * 0.08
			return `animation-delay: ${delay.toFixed(3)}s`
		},

		goQuiz(tag) {
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag) })
		},

		handleTagClick(e) {
			const tag = e.currentTarget.dataset.tag
			if (tag) this.goQuiz(tag)
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
		},
		showCustomPopup() {
			this.customTagName = this.keyword
			this.customTagDesc = ''
			this.showCustomSheet = true
		},
		hideCustomPopup() {
			this.showCustomSheet = false
		},
		async submitCustomTag() {
			console.log('[CH10] submitCustomTag 被调用 | customTagName:', JSON.stringify(this.customTagName), '| generateCooldown:', this.generateCooldown)
			if (this.generateCooldown) {
				console.log('[CH10] submitCustomTag → 冷却中，忽略点击')
				return
			}
			const name = this.customTagName.trim()
			if (!name) {
				uni.showToast({ title: '请输入标签名称', icon: 'none' })
				return
			}
			if (name.length > 10) {
				uni.showToast({ title: '标签名称不能超过 10 个字', icon: 'none' })
				return
			}

			const desc = this.customTagDesc.trim()

			// 内容安全审核
			showLoading('内容审核中...')
			try {
				const survey = uniCloud.importObject('survey')
				const content = name + (desc ? '，' + desc : '')
				const checkRes = await survey.checkTextContent({ content })
				hideLoading()
				if (checkRes.errCode === 0 && checkRes.data && !checkRes.data.pass) {
					uni.showModal({
						title: '内容违规',
						content: '你输入的标签名称或描述包含违规内容，请修改后重试',
						showCancel: false
					})
					return
				}
			} catch (e) {
				console.error('[search] checkTextContent error:', e)
				// 审核异常时放行，不阻塞用户
			}

			// 先关弹窗
			this.hideCustomPopup()

			// 后台生成（不阻塞页面）
			this.backgroundGenerate(name, desc)

			// 广告 → Toast 流程
			this._afterGenerateFlow()
		},

		async doGenerate(tagName, tagDesc) {
			const _t = Date.now()
			showLoading('AI 正在为你生成...')

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.generateFromCoze({
					tagName,
					tagDesc
				})

				hideLoading()

				if (res.errCode === 0) {
					console.log('[generate] 生成耗时: ' + (Date.now() - _t) + 'ms')
					// 生成成功 → 跳预览页
					const q = res.data.questionnaire
					uni.navigateTo({
						url: '/pages-tools/survey-preview/survey-preview?' +
							'tag=' + encodeURIComponent(tagName) +
							'&surveyId=' + encodeURIComponent(res.data.surveyId) +
							'&title=' + encodeURIComponent(q.title || '') +
							'&tagDesc=' + encodeURIComponent(q.tagDesc || '') +
							'&dims=' + encodeURIComponent(JSON.stringify(q.dims || [])) +
							'&qs=' + encodeURIComponent(JSON.stringify(q.qs || [])) +
							'&rts=' + encodeURIComponent(JSON.stringify(q.resultTypes || [])) +
							'&clickCount=' + (res.data.clickCount || 0) +
							'&isPublic=' + (res.data.isPublic ? '1' : '0')
					})
				} else if (res.errCode === 'AUTH_ERROR') {
					uni.showModal({
						title: '请先登录',
						content: '生成模板需要登录账号',
						success: (r) => {
							if (r.confirm) {
								uni.navigateTo({ url: '/pages/ucenter/login/login' })
							}
						}
					})
			} else if (res.errCode === 'VALIDATE_ERROR') {
				uni.showModal({
					title: '生成格式异常',
					content: 'AI 生成的内容格式有误，请修改标签名后重试',
					showCancel: false
				})
				console.error('[generate] validate errors:', res.data && res.data.errors)
			} else if (res.errCode === 'COZE_QUOTA_EXHAUSTED') {
				uni.showModal({
					title: 'AI 额度已用完',
					content: '当前 AI 生成额度已耗尽，您可以：\n1. 等待每日额度重置\n2. 联系开发者获取更多额度',
					showCancel: false,
					confirmText: '知道了'
				})
			} else if (res.errCode === 'TAG_ALREADY_EXISTS') {
				uni.showModal({
					title: '标签已存在',
					content: '该标签已有其他人生成的模板，请换一个标签名',
					showCancel: false
				})
			} else {
				uni.showToast({ title: res.errMsg || '生成失败，请稍后重试', icon: 'none' })
			}
			} catch (e) {
				hideLoading()
				console.log('[generate] 生成失败耗时: ' + (Date.now() - _t) + 'ms')
				console.error('[generate] error:', e)
				uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
			}
		},
		
		// ====== 章节10：后台生成 + 队列系统 ======
		
		// 更新队列中某个任务的状态，同步刷新底部浮层
		_updateTaskStatus(taskId, status, extra = {}) {
			const queue = uni.getStorageSync('_taskQueue') || []
			const idx = queue.findIndex(t => t.id === taskId)
			if (idx === -1) return
			queue[idx].status = status
			if (extra.data !== undefined) queue[idx].data = extra.data
			if (extra.errCode !== undefined) queue[idx].errCode = extra.errCode
			if (extra.errMsg !== undefined) queue[idx].errMsg = extra.errMsg
			uni.setStorageSync('_taskQueue', queue)
			this._updateQueueFloat()
		},

		// 从队列中移除某个任务
		_removeTask(taskId) {
			let queue = uni.getStorageSync('_taskQueue') || []
			queue = queue.filter(t => t.id !== taskId)
			uni.setStorageSync('_taskQueue', queue)
			this._updateQueueFloat()
		},

		// 刷新底部浮层数据
		_updateQueueFloat() {
			const queue = uni.getStorageSync('_taskQueue') || []
			const active = queue.filter(
				t => t.status === 'queued' || t.status === 'generating'
			)
			console.log(`[CH10] _updateQueueFloat → 进行中:${active.length} (queued:${active.filter(t => t.status === 'queued').length} generating:${active.filter(t => t.status === 'generating').length}) visible:${active.length > 0}`)
			this.queueActiveCount = active.length
			this.queueActiveList = active
			this.queueFloatVisible = active.length > 0
		},

		// 展开/收起底部浮层
		toggleQueueFloat() {
			this.queueFloatExpanded = !this.queueFloatExpanded
		},

		// 错误码 → 叙事层文案映射
		_getErrMsg(errCode) {
			const map = {
				'AUTH_ERROR': '需要先登录才能指挥标签机干活',
				'VALIDATE_ERROR': '标签机吐出来的模板格式不对，换个标签名试试',
				'COZE_QUOTA_EXHAUSTED': '标签机今天累了，明天再来教它吧',
				'TAG_ALREADY_EXISTS': '这个标签已经有人印过了，换个名字吧',
				'TIMEOUT': '标签机印太久卡住了，重新试试',
				'NETWORK_ERROR': '信号不太好，标签机没收到指令'
			}
			return map[errCode] || '标签机出了点小问题，稍后再试'
		},

		// 队列检测主入口（含过期清理 + 超时兜底 + done/failed 弹窗分发）
		_checkTaskQueue() {
			let queue = uni.getStorageSync('_taskQueue') || []
			console.log('[CH10] _checkTaskQueue 开始，_popChainActive=', this._popChainActive, '_popChainStopped=', this._popChainStopped, '队列长度:', queue.length)
			if (queue.length === 0) {
				console.log('[CH10] _checkTaskQueue → 队列为空，强制刷新浮层')
				this._updateQueueFloat()
				return
			}

			const now = Date.now()
			const ONE_DAY = 24 * 60 * 60 * 1000
			const ONE_HOUR = 60 * 60 * 1000

			// 0. 清理过期任务
			const before = queue.length
			queue = queue.filter(t => {
				const age = now - t.createdAt
				if (t.status === 'done' && age > ONE_DAY) return false
				if (t.status === 'failed' && age > ONE_HOUR) return false
				return true
			})
			if (queue.length < before) {
				console.log(`[CH10] 过期清理：${before} → ${queue.length}（移除 ${before - queue.length} 条）`)
				uni.setStorageSync('_taskQueue', queue)
			}

			// 1. 超时兜底：超过 60s 仍 generating 的标 failed
			const staleGenerating = queue.filter(
				t => t.status === 'generating' && (now - t.createdAt) > 60000
			)
			if (staleGenerating.length > 0) {
				console.log(`[CH10] 超时检测：${staleGenerating.length} 个任务标为 failed`)
			}
			staleGenerating.forEach(t => {
				this._updateTaskStatus(t.id, 'failed', {
					errCode: 'TIMEOUT',
					errMsg: this._getErrMsg('TIMEOUT')
				})
			})

			// 重新读队列
			queue = uni.getStorageSync('_taskQueue') || []

			// 2. 处理已完成的任务（优先级最高）
			const doneTasks = queue.filter(t => t.status === 'done')
			console.log(`[CH10] 状态分布 → done:${doneTasks.length} failed:${queue.filter(t => t.status === 'failed').length} generating:${queue.filter(t => t.status === 'generating').length} queued:${queue.filter(t => t.status === 'queued').length}`)

			if (doneTasks.length > 0) {
				if (this._popChainActive) {
					console.log(`[CH10] → done 弹窗被拦截！已有弹窗链正在执行，跳过本次调用（调用来源可能是轮询 timer 竞态）`)
					this._updateQueueFloat()
					return
				}
				this._popChainActive = true
				console.log(`[CH10] → 启动弹窗链，_popChainActive=true，${doneTasks.length} 个 done`)
				this._popNextDone(doneTasks)
			}

			// 3. 处理失败的任务
			const failedTasks = queue.filter(t => t.status === 'failed')
			if (failedTasks.length > 0 && doneTasks.length === 0) {
				console.log(`[CH10] → 开始弹出 ${failedTasks.length} 个 failed 弹窗`)
				this._popNextFailed(failedTasks)
			}

			// 4. 更新底部浮层
			this._updateQueueFloat()
		},

		// done 弹窗链：逐个弹出，二次检查防重复弹窗
		_popNextDone(tasks) {
			console.log(`[CH10] _popNextDone 剩余 ${tasks.length} 个 done 待弹出，_popChainActive=${this._popChainActive}`)
			if (tasks.length === 0) {
				const queue = uni.getStorageSync('_taskQueue') || []
				const failed = queue.filter(t => t.status === 'failed')
				console.log(`[CH10] _popNextDone → done 弹完，failed 剩余 ${failed.length} 个，释放 _popChainActive`)
				this._popChainActive = false
				if (failed.length > 0) this._popNextFailed(failed)
				return
			}
			const task = tasks[0]
			console.log(`[CH10] _popNextDone → 弹出: "${task.tagName}" (id=${task.id.slice(-6)})`)

			// 二次检查：任务是否还在队列中且状态仍为 done
			const currentQueue = uni.getStorageSync('_taskQueue') || []
			const stillThere = currentQueue.find(t => t.id === task.id && t.status === 'done')
			if (!stillThere) {
				console.log(`[CH10] _popNextDone → 二次检查失败（已被消费），跳过`)
				const remaining = tasks.slice(1)
				this.$nextTick(() => { this._popNextDone(remaining) })
				return
			}

			uni.showModal({
				title: '生成完成',
				content: `「${task.tagName}」已生成！`,
				confirmText: '查看',
				cancelText: '稍后',
				success: (res) => {
					console.log(`[CH10] _popNextDone → 用户操作: ${res.confirm ? '查看' : '稍后'}`)
					if (res.confirm) {
						this._popChainStopped = true
						this._removeTask(task.id)
						console.log(`[CH10] _popNextDone → 任务已移除，跳转预览，停止弹窗链`)
						// 展平数据存入 Storage（task.data 有 questionnaire 嵌套，onLoad 需要扁平结构）
						uni.setStorageSync('_previewData', {
							tag: task.tagName,
							surveyId: task.data?.surveyId || '',
							title: task.data?.questionnaire?.title || '',
							tagDesc: task.data?.questionnaire?.tagDesc || '',
							dims: task.data?.questionnaire?.dims || [],
							qs: task.data?.questionnaire?.qs || [],
							rts: task.data?.questionnaire?.resultTypes || [],
							clickCount: task.data?.clickCount || 0,
							isPublic: task.data?.isPublic || false,
						})
						uni.navigateTo({
							url: '/pages-tools/survey-preview/survey-preview?' +
								'tag=' + encodeURIComponent(task.tagName) +
								'&surveyId=' + encodeURIComponent(task.data?.surveyId || '') +
								'&from=queue'
						})
					} else {
						console.log(`[CH10] _popNextDone → 任务保留在队列`)
					}
				},
				complete: () => {
					if (this._popChainStopped) {
						console.log(`[CH10] _popNextDone → 弹窗链已停止（用户跳转预览），释放 _popChainStopped + _popChainActive`)
						this._popChainStopped = false
						this._popChainActive = false
						return
					}
					const remaining = tasks.slice(1)
					this._popNextDone(remaining)
				}
			})
		},

		// failed 弹窗链
		_popNextFailed(tasks) {
			console.log(`[CH10] _popNextFailed 剩余 ${tasks.length} 个 failed 待弹出`)
			if (tasks.length === 0) {
				console.log(`[CH10] _popNextFailed → 全部弹完`)
				return
			}
			const task = tasks[0]
			console.log(`[CH10] _popNextFailed → 弹出: "${task.tagName}" errCode=${task.errCode}`)

			uni.showModal({
				title: '生成失败',
				content: `「${task.tagName}」${this._getErrMsg(task.errCode)}`,
				confirmText: '知道了',
				showCancel: false,
				success: () => {
					console.log(`[CH10] _popNextFailed → 用户点「知道了」，移除任务`)
					this._removeTask(task.id)
					const remaining = tasks.slice(1)
					this.$nextTick(() => {
						this._popNextFailed(remaining)
					})
				}
			})
		},

		// 30s 冷却计时器
		_startCooldown() {
			this.generateCooldown = true
			this.cooldownRemaining = 30
			this._cooldownTimer = setInterval(() => {
				this.cooldownRemaining--
				if (this.cooldownRemaining <= 0) {
					clearInterval(this._cooldownTimer)
					this._cooldownTimer = null
					this.generateCooldown = false
				}
			}, 1000)
		},

		// 广告播放（预留）
		_playAdIfNeeded() {
			return new Promise((resolve) => {
				if (!this._shouldShowAd()) {
					resolve()
					return
				}
				// TODO: 替换为实际广告 SDK
				resolve()
			})
		},

		// 广告开关（正式版返回 true）
		_shouldShowAd() {
			return false
		},

		// ========== 后台生成（不阻塞页面） ==========
		backgroundGenerate(tagName, tagDesc) {
			// 队列容量上限检查
			const currentQueue = uni.getStorageSync('_taskQueue') || []
			if (currentQueue.length >= 10) {
				uni.showToast({
					title: '标签机手头的活太多了，先清一批再来',
					icon: 'none',
					duration: 2000
				})
				return
			}

			const taskId = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8)
			const task = {
				id: taskId,
				status: 'queued',
				tagName,
				tagDesc: tagDesc || '',
				data: null,
				errCode: null,
				errMsg: null,
				createdAt: Date.now()
			}

			// 追加到队列尾部
			currentQueue.push(task)
			uni.setStorageSync('_taskQueue', currentQueue)
			console.log(`[CH10] backgroundGenerate → 任务入队: "${tagName}" (id=${taskId.slice(-6)})`)

			// 异步 IIFE，不 await
			;(async () => {
				try {
					this._updateTaskStatus(taskId, 'generating')
					console.log(`[CH10] backgroundGenerate → 状态: generating，开始请求 Coze`)

					const survey = uniCloud.importObject('survey')
					const res = await survey.generateFromCoze({ tagName, tagDesc })

					if (res.errCode === 0) {
						console.log(`[CH10] backgroundGenerate → Coze 成功 surveyId=${res.data.surveyId}`)
						this._updateTaskStatus(taskId, 'done', { data: res.data })
					} else {
						console.log(`[CH10] backgroundGenerate → Coze 失败 errCode=${res.errCode}`)
						this._updateTaskStatus(taskId, 'failed', {
							errCode: res.errCode,
							errMsg: res.errMsg || '生成失败'
						})
					}
				} catch (e) {
				console.error('[CH10] backgroundGenerate error:', e)
				this._updateTaskStatus(taskId, 'failed', {
					errCode: 'NETWORK_ERROR',
					errMsg: '网络异常，请稍后重试'
				})
			}
			// Coze 返回后立即触发队列检测 → 弹窗
			this._checkTaskQueue()
		})()
		},

		// 广告 → Toast → 冷却
		async _afterGenerateFlow() {
			try {
				await this._playAdIfNeeded()
			} catch (e) {
				console.warn('[CH10] _afterGenerateFlow ad skipped:', e)
			}

			console.log('[CH10] _afterGenerateFlow → Toast + 启动冷却')
			uni.showToast({
				title: '标签机已接单，印好了会通知你',
				icon: 'none',
				duration: 2000
			})

			this._startCooldown()
		},

		// ====== 调试方法（阶段1-3测试用，阶段5验收后移除） ======
		_debugInjectTestTasks() {
			// 清空旧队列
			uni.setStorageSync('_taskQueue', [])

			// 触发完整 UI 流程（冷却 + Toast）
			console.log('[CH10] ====== Mock：模拟完整生成流程 ======')
			this._startCooldown()
			uni.showToast({
				title: '标签机已接单，印好了会通知你',
				icon: 'none',
				duration: 2000
			})

			// 模拟后台生成：注入 2 个生成中任务，3s 后一个 done 一个 failed
			const now = Date.now()
			const taskDone = {
				id: String(now) + '_mock1',
				status: 'queued',
				tagName: '确诊为芋泥波波奶茶',
				tagDesc: '芋泥波波奶茶成分鉴定',
				data: null,
				errCode: null,
				errMsg: null,
				createdAt: now
			}
			const taskFailed = {
				id: String(now + 1) + '_mock2',
				status: 'queued',
				tagName: '代码写得像屎山',
				tagDesc: '',
				data: null,
				errCode: null,
				errMsg: null,
				createdAt: now
			}

			const queue = [taskDone, taskFailed]
			uni.setStorageSync('_taskQueue', queue)

			// 立即标记为 generating
			this._updateTaskStatus(taskDone.id, 'generating')
			this._updateTaskStatus(taskFailed.id, 'generating')

			console.log('[CH10] 2 个任务已注入（生成中），3s 后模拟完成...')
			console.log(`[CH10] 浮层应显示「正在生成 2 个…」`)

			// 3s 后：done 成功返回 mock 问卷数据
			setTimeout(() => {
				console.log('[CH10] ====== Mock Coze 返回 ======')
				this._updateTaskStatus(taskDone.id, 'done', {
					data: {
						surveyId: 'mock_survey_done',
						tagName: '确诊为芋泥波波奶茶',
						questionnaire: {
							title: '确诊为芋泥波波奶茶',
							dims: [{ name: '芋泥浓度', low: '寡淡', high: '浓郁' }],
							qs: [{ text: '喝奶茶必加芋泥？', options: ['是', '否'] }],
							resultTypes: [{ name: '纯正芋泥党', desc: '无芋泥不欢' }]
						}
					}
				})
				console.log('[CH10] → 芋泥波波奶茶 → done')

				this._updateTaskStatus(taskFailed.id, 'failed', {
					errCode: 'COZE_QUOTA_EXHAUSTED',
					errMsg: '额度耗尽'
				})
				console.log('[CH10] → 代码写得像屎山 → failed (COZE_QUOTA_EXHAUSTED)')

				console.log('[CH10] 弹出弹窗链：done → failed')

				// 触发弹窗
				this._checkTaskQueue()
			}, 3000)
		},
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
.back-icon { width: 28rpx; height: 28rpx; }

/* debug 按钮（与 quiz-home 统一） */
.nav-row .icon-btn {
	width: 64rpx; height: 64rpx; flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
	border-radius: 50%; background: #F3F4F6;
	font-size: 28rpx; margin-left: 12rpx;
}
.nav-row .icon-btn-debug {
	background: #FFF7ED; border: 1rpx solid #FED7AA;
}

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

/* ====== 自定义标签入口 ====== */
.custom-tag-card {
	display: flex; align-items: center; padding: 28rpx 24rpx; gap: 16rpx;
	background: linear-gradient(135deg, #FFF7ED 0%, #FEF2F2 100%);
	border-top: 1rpx solid #FEE2E2;
	transition: transform 0.15s;
}
.custom-tag-left {
	width: 80rpx; height: 80rpx; border-radius: 32rpx;
	background: linear-gradient(135deg, #FFFBEB, #FFF1F0);
	display: flex; align-items: center; justify-content: center;
	font-size: 44rpx;
}
.custom-tag-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.custom-tag-headline { font-size: 28rpx; font-weight: 600; color: #1E2939; }
.custom-tag-sub { font-size: 24rpx; color: #FB7185; font-weight: 500; }
.custom-tag-arrow { font-size: 36rpx; color: #99A1AF; font-weight: 300; flex-shrink: 0; }

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
.accordion-arrow { width: 20rpx; height: 20rpx; transition: transform 0.3s ease-in-out; }
.accordion-arrow.open { transform: rotate(180deg); }

/* ====== 手风琴主体 ====== */
.accordion-body { overflow: hidden; }
.accordion-body .body-inner {
	background: #F7F8FA; padding: 16rpx 20rpx 24rpx;
	border-top: 1rpx solid rgba(243,244,246,0.5);
	animation: bodySlideIn 0.25s ease-out both;
}

.tag-pool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.tag-pool-subtitle { font-size: 24rpx; color: #99A1AF; font-weight: 500; }
.refresh-btn { font-size: 22rpx; color: #6A7282; background: white; border-radius: 40rpx; padding: 6rpx 16rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1); }
.icon-wrapper {
	display: inline-flex;
	transform-origin: center center;
	transition: transform 0.5s cubic-bezier(0.34, 1.25, 0.64, 1);
}

.tag-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 20rpx; align-items: center; }

/* ====== 标签（外层按压缩放 / 内层掉落动画） ====== */
.tag-wrapper { transition: transform 0.1s ease-out; }
.press-9 { transform: scale(0.9); }

.tag-inner {
	border-radius: 40rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	animation-duration: 0.5s;
	animation-timing-function: cubic-bezier(0.34, 1.25, 0.64, 1);
	animation-fill-mode: both;
	max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tag-inner.anim-a { animation-name: dropElasticA; }
.tag-inner.anim-b { animation-name: dropElasticB; }
.tag-common { padding: 10rpx 18rpx; font-size: 22rpx; font-weight: 400; background: #F7F8FA; color: #101828; border: 1rpx solid #D1D5DC; box-shadow: none; }
.tag-rare { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: white; color: #4FC3F7; border: 1rpx solid #4FC3F7; }
.tag-mythic { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: white; color: #22C55E; border: 1rpx solid #22C55E; }
.tag-epic { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: white; color: #A855F7; border: 1rpx solid #A855F7; }
.tag-legendary { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: white; color: #EF4444; border: 1rpx solid #EF4444; }
.tag-handmade1 { padding: 10rpx 18rpx; font-size: 22rpx; font-weight: 400; background: #FFF7ED; color: #F97316; border: 1rpx solid #FED7AA; box-shadow: none; }
.tag-handmade2 { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 500; background: #FFF7ED; color: #F97316; border: 1rpx solid #F97316; }
.tag-handmade3 { padding: 22rpx 38rpx; font-size: 36rpx; font-weight: 600; background: #FFF7ED; color: #F97316; border: 1rpx solid #F97316; }
.tag-darkgold { padding: 26rpx 44rpx; font-size: 46rpx; font-weight: 900; background: #1A1A1A; color: #C9A84C; border: 2rpx solid #C9A84C; text-shadow: 0 0 8rpx rgba(201, 168, 76, 0.5), 0 0 16rpx rgba(201, 168, 76, 0.3); }
/* ====== 交互反馈 ====== */
.press-98 { transform: scale(0.98); }
.press-95 { transform: scale(0.95); }
.press-bg { background: rgba(0,0,0,0.03); }

/* ====== 底部安全（防截断 spacer） ====== */
.bottom-spacer { height: 60rpx; width: 100%; }

/* ====== 自定义标签弹窗 ====== */
.sheet-overlay {
	position: fixed; inset: 0; z-index: 999;
	background: rgba(0,0,0,0.4);
	display: flex; align-items: flex-end;
	animation: fadeIn 0.2s ease-out;
}
.sheet-panel {
	width: 100%; background: white;
	border-radius: 32rpx 32rpx 0 0;
	padding: 0 40rpx 60rpx;
	animation: slideUp 0.3s cubic-bezier(0.34, 1.25, 0.64, 1);
}
.sheet-handle {
	width: 48rpx; height: 6rpx; border-radius: 4rpx;
	background: #D1D5DC; margin: 16rpx auto 0;
}
.sheet-header {
	display: flex; justify-content: space-between; align-items: center;
	margin-top: 24rpx; margin-bottom: 32rpx;
}
.sheet-title { font-size: 34rpx; font-weight: 700; color: #1E2939; }
.sheet-close {
	font-size: 32rpx; color: #99A1AF; padding: 8rpx;
	width: 48rpx; height: 48rpx; display: flex;
	align-items: center; justify-content: center;
}
.sheet-body { margin-bottom: 40rpx; }
.sheet-label { font-size: 28rpx; font-weight: 600; color: #374151; display: block; margin-bottom: 12rpx; }
.sheet-label .required { color: #EF4444; }
.sheet-label .optional { font-weight: 400; color: #99A1AF; font-size: 24rpx; }
.sheet-input {
	width: 100%; height: 88rpx; border-radius: 20rpx;
	background: #F7F8FA; padding: 0 24rpx; font-size: 30rpx;
	border: 1rpx solid #E5E7EB; margin-bottom: 32rpx;
}
.sheet-textarea {
	width: 100%; height: 160rpx; border-radius: 20rpx;
	background: #F7F8FA; padding: 20rpx 24rpx; font-size: 28rpx;
	border: 1rpx solid #E5E7EB; resize: none; line-height: 1.5;
}
.sheet-footer { padding: 0; }
.sheet-btn {
	width: 100%; height: 96rpx; border-radius: 48rpx;
	background: linear-gradient(135deg, #FF8C42, #FF6B6B);
	display: flex; align-items: center; justify-content: center;
	transition: transform 0.15s;
}
.sheet-btn-text { font-size: 32rpx; font-weight: 700; color: white; }
.sheet-btn-cooldown {
	background: #E5E7EB !important;
	opacity: 0.6;
	pointer-events: none;
}

/* ====== 动画 ====== */
@keyframes dropElasticA {
	0% { opacity: 0; transform: translateY(-80rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
@keyframes dropElasticB {
	0% { opacity: 0; transform: translateY(-80rpx); }
	100% { opacity: 1; transform: translateY(0); }
}

@keyframes bodySlideIn {
	0% { opacity: 0; transform: translateY(-12rpx); }
	100% { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
	0% { opacity: 0; }
	100% { opacity: 1; }
}

@keyframes slideUp {
	0% { transform: translateY(100%); }
	100% { transform: translateY(0); }
}

/* ====== 章节10：底部浮层 ====== */
.queue-float {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	background: rgba(30, 30, 30, 0.92);
	backdrop-filter: blur(10rpx);
	z-index: 999;
	padding: 16rpx 32rpx;
	border-radius: 24rpx 24rpx 0 0;
}
.queue-float-bar {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.queue-float-icon {
	font-size: 28rpx;
}
.queue-float-text {
	flex: 1;
	font-size: 26rpx;
	color: #fff;
}
.queue-float-arrow {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.5);
}
.queue-float-detail {
	margin-top: 16rpx;
	border-top: 1rpx solid rgba(255, 255, 255, 0.1);
	padding-top: 12rpx;
}
.queue-float-item {
	display: flex;
	align-items: center;
	gap: 12rpx;
	padding: 10rpx 0;
}
.queue-item-status {
	font-size: 24rpx;
}
.queue-item-name {
	flex: 1;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
}
.queue-item-state {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.45);
}

</style>
