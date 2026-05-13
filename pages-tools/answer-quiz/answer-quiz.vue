<!-- ========== 答题页 ========== -->
<template>
	<view class="page">
		<view v-if="loading" class="retry-layer">
			<text class="retry-icon">⏳</text>
			<text class="retry-text">加载问卷中...</text>
		</view>
		<view v-else-if="loadFailed" class="retry-layer">
			<text class="retry-icon">😵</text>
			<text class="retry-text">网络不太给力</text>
			<view class="retry-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="manualRetry">
				<text class="retry-btn-text">点我重试</text>
			</view>
		</view>
		<template v-else>
			<view class="hd" :style="{ paddingTop: capsuleBottom + 'px' }">
				<view class="hd-row1">
					<view class="hd-back" @click="goBack"><text>←</text></view>
					<text class="hd-tag">{{ title }}</text>
				</view>
				<view class="hd-row2">
					<text class="hd-step">第 {{ idx + 1 }}/{{ qs.length }} 题</text>
					<text class="hd-motto">{{ motto }}</text>
				</view>
				<view class="hd-bar"><view class="hd-fill" :style="{ width: pct + '%' }"></view></view>
			</view>
			<view class="qz">
				<view :key="'q-' + idx" class="q-wrap" :class="{ 'q-out': out }">
					<text class="q-txt">{{ curQ.title }}</text>
				</view>
			</view>
			<view class="opts">
				<view :key="'o-' + idx">
					<view v-for="(o, i) in curQ.opts" :key="i"
						class="o-wrap" hover-class="o-press"
						:hover-start-time="0" :hover-stay-time="150"
						@click="pick(i)"
					>
						<view class="o-inner" :class="{ 'o-on': sel === i, 'o-out': out }"
							:style="{ animationDelay: [0.1, 0.15, 0.2][i] + 's' }"
						>
							<text class="o-txt">{{ o.text }}</text>
						</view>
					</view>
				</view>
			</view>
		</template>
	</view>
</template>

<script>
const OPTS_LV1 = [
	'绝非如此 🤨', '根本不是 🚫', '太扯了 🙄', '绝对不是 🤨',
	'你瞎了 🙅', '举报了 🚫', '我裂开 💀', '不是我 🙈',
	'别扯了 😒', '不可能 😤', '你在放屁 💨', '想多了 🥱',
	'完全不对 ❌', '关我啥事 🤷', '少来这套 😏', '笑死 🥴'
]
const OPTS_LV2 = [
	'有点意思 🤔', '也许吧 🤷', '说不准 🫤', '好像有点 🫤',
	'猜对一半 🤷', '再想想 🤔', '有点痛 🩹', '一半一半 🐒',
	'不好说 🫣', '看情况 😶', '也许大概 😬', '好像是的 🤥',
	'说不好 🤫', '有点道理 🤨', '被你说中了 😅', 'emmm... 🤔'
]
const OPTS_LV3 = [
	'被看穿了 😱', '就是我本人 ✅', '太准了 😳', '本人在此 😳',
	'你监视我？ 🎯', '删掉监控 ✅', '精准打击 🔪', '是我本人 🐺',
	'救命太准了 😰', '你在偷看我 👀', '我承认 😮‍💨', '被你发现了 🫢',
	'全中 🎯', '这是监控吧 📹', '有被冒犯到 😠', '我闭嘴 🤐'
]
const MOTTOS = ['离确诊又近了一步 🤡','恭喜你，还在坚持 💪','不要细想，选就完了 🤷','本题没有正确答案 🙃','选错了也没人知道 🤫','你的选择毫无意义 💀']

export default {
	data() {
		return { idx: 0, sel: -1, locked: false, out: false, tag: '', ans: [], curOpts: [], survey: null, loading: true, loadFailed: false, capsuleBottom: 92 }
	},
	computed: {
		qs() { return (this.survey && this.survey.qs) || [] },
		title() { return (this.survey && this.survey.title) || this.tag || '' },
		curQ() {
			const q = this.qs[this.idx] || { title: '' }
			return { ...q, opts: this.curOpts }
		},
		pct() { return this.qs.length ? (this.idx / this.qs.length) * 100 : 0 },
		motto() { return MOTTOS[(this.idx + 1) % MOTTOS.length] }
	},
	onLoad(o) {
		this.tag = decodeURIComponent(o.tag || '确诊为烤肠')
		this.curOpts = this.pickOpts()
		this.loadSurvey()
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.capsuleBottom = menu.bottom } catch (e) {}
	},

	methods: {
		async loadSurvey() {
			this.loading = true
			this.loadFailed = false
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getSurveyByTag({ tagName: this.tag })
				// 走到这里说明云对象返回了 errCode: 0
				if (res && res.data) {
					this.survey = res.data
					this.loading = false
				} else {
					this.loading = false
					this.loadFailed = true
				}
			} catch (e) {
				console.error('[answer-quiz] load error:', e.message)
				this.loading = false
				// 云对象 errCode !== 0 时会 throw Error
				if (e.message && e.message.indexOf('未找到') !== -1) {
					uni.showToast({ title: '该标签暂无问卷数据', icon: 'none' })
					setTimeout(() => uni.navigateBack(), 1000)
				} else {
					this.loadFailed = true
				}
			}
		},
		manualRetry() {
			this.loadSurvey()
		},
		pickOpts() {
			const lv1 = OPTS_LV1[Math.floor(Math.random() * OPTS_LV1.length)]
			const lv2 = OPTS_LV2[Math.floor(Math.random() * OPTS_LV2.length)]
			const lv3 = OPTS_LV3[Math.floor(Math.random() * OPTS_LV3.length)]
			return [
				{ text: lv1, score: 1 },
				{ text: lv2, score: 2 },
				{ text: lv3, score: 3 }
			]
		},
		pick(i) {
			if (this.locked) return
			this.locked = true
			this.sel = i
			this.ans.push({ dim: this.curQ.dim, score: this.curOpts[i].score, questionIndex: this.idx, optionIndex: i })
			setTimeout(() => {
				if (this.idx + 1 >= this.qs.length) { this.goResult(); return }
				this.out = true
				setTimeout(() => {
					this.idx++; this.sel = -1; this.out = false; this.locked = false
					this.curOpts = this.pickOpts()
				}, 200)
			}, 400)
		},
		goBack() { uni.navigateBack() },
		async goResult() {
			if (!this.survey) return
			const dims = this.survey.dims
			const sums = {}, cnts = {}
			dims.forEach(d => { sums[d] = 0; cnts[d] = 0 })
			this.ans.forEach(a => { sums[a.dim] += a.score; cnts[a.dim]++ })
			const raw = dims.map(d => cnts[d] ? ((sums[d] / cnts[d] - 1) / 2) * 100 : 50)

			const topDim = dims.reduce((a, b) => raw[dims.indexOf(a)] >= raw[dims.indexOf(b)] ? a : b)
			const result = this.survey.resultTypes.find(r => r.match === topDim) || this.survey.resultTypes[0]

			const scores = raw.map(s => {
				const n = Math.round((Math.random() - 0.5) * 16)
				return Math.max(0, Math.min(100, Math.round(s + n)))
			})

			const dimensionScores = {}
			dims.forEach((d, i) => { dimensionScores[d] = scores[i] })

			// 异步保存答题记录，不阻塞跳转
			try {
				const survey = uniCloud.importObject('survey')
				const ansData = this.ans.map(a => ({ questionIndex: a.questionIndex, optionIndex: a.optionIndex }))
				await survey.submitAnswer({
					surveyId: this.survey._id,
					answers: ansData,
					dimensionScores,
					matchedType: { name: result.name, desc: result.desc, emoji: result.emoji },
					surveySnapshot: this.survey
				})
			} catch (e) {
				console.error('[answer-quiz] submitAnswer error:', e)
			}

			const colors = this.survey.resultTypes.map(r => r.emojiBg)

			uni.redirectTo({
				url: '/pages-tools/result/result?tag=' + encodeURIComponent(this.tag) +
					'&dims=' + encodeURIComponent(JSON.stringify(dims)) +
					'&scores=' + encodeURIComponent(JSON.stringify(scores)) +
					'&emoji=' + encodeURIComponent(result.emoji) +
					'&rname=' + encodeURIComponent(result.name) +
					'&rdesc=' + encodeURIComponent(result.desc) +
					'&colors=' + encodeURIComponent(JSON.stringify(colors))
			})
		}
	}
}
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }
.hd { padding: 0 48rpx 0; }
.hd-row1 { display: flex; align-items: center; gap: 12rpx; margin-bottom: 44rpx; }
.hd-back { width: 64rpx; height: 64rpx; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #364153; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1); }
.hd-tag { font-size: 28rpx; color: #FF8904; font-weight: 600; }
.hd-row2 { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.hd-step, .hd-motto { font-size: 24rpx; color: #99A1AF; font-weight: 700; }
.hd-bar { height: 12rpx; background: #E5E7EB; border-radius: 60rpx; overflow: hidden; }
.hd-fill { height: 100%; background: #FF8904; border-radius: 60rpx; transition: width .4s ease-out; }
.qz { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 64rpx; }
.q-wrap { width: 100%; }
.q-txt { font-size: 52rpx; font-weight: 900; color: #1E2939; text-align: center; line-height: 1.5; letter-spacing: 1.3rpx; animation: in .45s cubic-bezier(.34, 1.25, .64, 1) both; }
.opts { padding: 0 48rpx 80rpx; }
.o-wrap { transition: transform .2s cubic-bezier(.34, 1.56, .64, 1); }
.o-press { transform: scale(.96); transition: transform .05s ease-in; }
.o-inner { width: 100%; height: 130rpx; border-radius: 48rpx; display: flex; align-items: center; justify-content: center; background: #fff; border: 4rpx solid #F3F4F6; transition: all .2s ease; margin-bottom: 30rpx; animation: in .45s cubic-bezier(.34, 1.25, .64, 1) both; }
.o-txt { color: #1F2937; font-size: 34rpx; font-weight: 400; }
.o-on { background: #FFF7ED !important; border-color: #F97316 !important; }
.o-on .o-txt { color: #111827 !important; font-weight: 600 !important; }
.q-out { animation: out .2s ease-in both !important; }
.o-out { animation: out .2s ease-in both !important; }
@keyframes in { 0% { opacity: 0; transform: translateY(50rpx); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes out { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40rpx); } }

/* ====== 加载/重试层 ====== */
.retry-layer {
	position: fixed; inset: 0;
	display: flex; flex-direction: column;
	align-items: center; justify-content: center;
	background: #F7F8FA; z-index: 100;
}
.retry-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.retry-text { font-size: 28rpx; color: #99A1AF; margin-bottom: 40rpx; }
.retry-btn {
	background: white; border-radius: 48rpx;
	padding: 20rpx 60rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
	transition: transform 0.15s;
}
.press-95 { transform: scale(0.95); }
.retry-btn-text { font-size: 32rpx; font-weight: 600; color: #F97316; }
</style>
