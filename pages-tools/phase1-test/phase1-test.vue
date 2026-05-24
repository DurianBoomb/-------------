<!-- 阶段一验证：查重 + 去重 + 拦截测试 -->
<template>
	<view class="page">
		<view class="header">
			<text class="title">阶段一验证</text>
			<text class="subtitle">标签去重 & TAG_ALREADY_EXISTS 拦截</text>
		</view>

		<!-- 查重 -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">📋 重复标签扫描</text>
			</view>
			<view class="btn btn-orange" @click="scanDup">
				<text>🔍 扫描 surveys 表重复 tagName</text>
			</view>
			<view class="result" v-if="dupDone">
				<text v-if="dups.length === 0" class="clean">✅ 无重复标签</text>
				<view v-else v-for="(d, i) in dups" :key="i" class="dup-item" :class="{ done: d._ok }">
					<text class="dup-tag">{{ d.tagName }} ×{{ d.count }}</text>
					<view class="dup-act" v-if="!d._ok" @click="dedupOne(d.tagName, i)">去重</view>
					<text v-else class="dup-ok">已清理</text>
				</view>
			</view>
		</view>

		<!-- 拦截 -->
		<view class="card">
			<view class="card-header">
				<text class="card-title">🛑 TAG_ALREADY_EXISTS 拦截</text>
			</view>
			<view class="btn btn-red" @click="testIntercept">
				<text>模拟标签已被占用</text>
			</view>
		</view>

		<!-- 日志 -->
		<view class="card log-card">
			<view class="card-header">
				<text class="card-title">运行日志</text>
				<text class="clear" @click="logs = []">清空</text>
			</view>
			<view v-for="(l, i) in logs" :key="i" :class="'log log-' + l.t">{{ l.m }}</view>
			<view v-if="logs.length === 0" class="log-empty">点击按钮开始</view>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return { logs: [], dups: [], dupDone: false }
	},
	methods: {
		add(msg, t) { this.logs.push({ m: msg, t: t || '' }) },
		async scanDup() {
			this.add('扫描中...', '')
			this.dupDone = false
			try {
				const s = uniCloud.importObject('survey')
				const r = await s.checkDuplicates()
				if (r.errCode !== 0) { this.add('❌ ' + r.errMsg, 'err'); return }
				this.dups = (r.data.duplicates || []).map(d => ({ ...d, _ok: false }))
				this.dupDone = true
				this.add(this.dups.length === 0 ? '✅ 无重复' : '发现 ' + this.dups.length + ' 个重复标签', this.dups.length ? 'warn' : 'ok')
			} catch (e) { this.add('❌ ' + e.message, 'err') }
		},
		async dedupOne(tagName, i) {
			this.add('去重: ' + tagName, '')
			try {
				const s = uniCloud.importObject('survey')
				const r = await s.deduplicate({ tagName })
				if (r.errCode !== 0) { this.add('❌ ' + r.errMsg, 'err'); return }
				this.add('✅ ' + tagName + ' 清理 ' + r.data.count + ' 条', 'ok')
				this.$set(this.dups, i, { ...this.dups[i], _ok: true })
			} catch (e) { this.add('❌ ' + e.message, 'err') }
		},
		testIntercept() {
			this.add('弹出 TAG_ALREADY_EXISTS Modal...', '')
			uni.showModal({
				title: '标签已存在',
				content: '该标签已有其他人生成的问卷，请换一个标签名',
				showCancel: false,
				success: () => this.add('✅ Modal 正常弹出', 'ok')
			})
		}
	}
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F7F8FA; padding: 32rpx; }
.header { margin-bottom: 24rpx; }
.title { font-size: 40rpx; font-weight: 700; color: #101828; display: block; }
.subtitle { font-size: 26rpx; color: #98A2B3; margin-top: 8rpx; display: block; }

.card { background: #FFF; border-radius: 24rpx; padding: 28rpx; margin-bottom: 24rpx; box-shadow: 0 1rpx 3rpx rgba(0,0,0,.08); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.card-title { font-size: 28rpx; font-weight: 700; color: #1E2939; }

.btn { border-radius: 16rpx; padding: 24rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 600; }
.btn-orange { background: #FFF7ED; color: #C2410C; border: 2rpx solid #FED7AA; }
.btn-red { background: #FEF2F2; color: #DC2626; border: 2rpx solid #FECACA; }
.btn:active { opacity: .7; }

.result { margin-top: 20rpx; }
.clean { font-size: 28rpx; font-weight: 600; color: #16A34A; }
.dup-item { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 20rpx; background: #FEF2F2; border-radius: 12rpx; margin-bottom: 10rpx; }
.dup-item.done { background: #F0FDF4; }
.dup-tag { font-size: 26rpx; font-weight: 600; color: #991B1B; }
.done .dup-tag { color: #166534; }
.dup-act { background: #EF4444; color: #FFF; font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 10rpx; font-weight: 600; }
.dup-act:active { opacity: .7; }
.dup-ok { font-size: 24rpx; color: #16A34A; font-weight: 600; }

.log-card { background: #1D2939; }
.log-card .card-title { color: #F2F4F7; }
.clear { font-size: 24rpx; color: #667085; }
.log { padding: 6rpx 0; font-size: 24rpx; color: #B0BBD5; }
.log-ok { color: #12B76A; }
.log-err { color: #F04438; }
.log-warn { color: #F79009; }
.log-empty { color: #475467; text-align: center; padding: 40rpx; }
</style>
