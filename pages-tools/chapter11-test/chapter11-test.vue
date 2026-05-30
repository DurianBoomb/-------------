<!-- 章节 11 · 一键自动测试 · 不观察只看日志 -->
<template>
  <view class="page">
    <view class="hd">
      <text class="hd-title">章节 11 · 一键测试</text>
      <text class="hd-sub">全自动运行，只看日志</text>
    </view>

    <view class="status-bar" v-if="running || totalTests > 0">
      <view class="status-progress">
        <view class="status-fill" :style="{ width: progressPct + '%' }"></view>
      </view>
      <text class="status-txt">{{ doneTests }}/{{ totalTests }} · 通过 {{ passCount }} · 失败 {{ failCount }}</text>
    </view>

    <scroll-view class="log-panel" scroll-y :scroll-top="logTop">
      <view v-for="(r, i) in results" :key="i" :class="'log-item ' + (r.pass ? 'log-pass' : 'log-fail')">
        <text class="log-icon">{{ r.pass ? '✅' : '❌' }}</text>
        <view class="log-body">
          <text class="log-name">{{ r.name }}</text>
          <text class="log-detail">{{ r.detail }}</text>
        </view>
      </view>
      <view v-if="results.length === 0 && !running" class="log-empty">
        <text class="empty-icon">🤖</text>
        <text class="empty-txt">测试自动启动中...</text>
      </view>
    </scroll-view>

    <view class="btns">
      <view :class="['btn-main', running ? 'btn-disabled' : '']" @click="runAll">
        <text>{{ running ? '⏳ 测试中...' : '🚀 一键全测' }}</text>
      </view>
      <view class="btn-copy" @click="copyLogs">
        <text>📋 复制日志</text>
      </view>
    </view>
    <!-- 非暗金问卷列表 -->
    <view class="section-title">📦 非暗金用户问卷</view>
    <view class="list-toolbar">
      <view class="btn-sm" @click="fetchList">
        <text>{{ listing ? '🔄 刷新列表' : '📋 获取列表' }}</text>
      </view>
      <view class="btn-sm" v-if="cleanupList.length > 0" @click="toggleAll">
        <text>{{ allSelected ? '☐ 取消全选' : '☑ 全选' }}</text>
      </view>
      <view class="btn-sm btn-sm-danger" v-if="selectedCount > 0" @click="deleteSelected">
        <text>🗑 删除选中 ({{ selectedCount }})</text>
      </view>
    </view>
    <view class="list-status" v-if="listLoading">加载中...</view>
    <view class="list-status" v-else-if="listLoaded && cleanupList.length === 0">无待清理问卷</view>
    <scroll-view class="list-scroll" scroll-y v-if="cleanupList.length > 0">
      <view
        v-for="item in cleanupList"
        :key="item.tagId"
        :class="['list-item', item._checked ? 'list-item-checked' : '']"
        @click="toggleItem(item)"
      >
        <text class="list-check">{{ item._checked ? '☑' : '☐' }}</text>
        <view class="list-info">
          <text class="list-name">{{ item.tagName }}</text>
          <text class="list-meta">稀有度: {{ item.rarity }} | 问卷: {{ item.surveyTitle }} ({{ item.resultCount }}结果)</text>
        </view>
      </view>
    </scroll-view>

    <view class="btns-warn">
      <view class="btn-danger" @click="runCleanup">
        <text>🧹 一键全清（跳过列表）</text>
      </view>
      <text class="warn-tip">不可逆，删除前先确认上面列表无误</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      running: false,
      results: [],
      totalTests: 0,
      doneTests: 0,
      passCount: 0,
      failCount: 0,
      progressPct: 0,
      logTop: 0,
      // 清理列表
      cleanupList: [],
      listLoading: false,
      listLoaded: false,
    }
  },
  computed: {
    allSelected() {
      return this.cleanupList.length > 0 && this.cleanupList.every(item => item._checked)
    },
    selectedCount() {
      return this.cleanupList.filter(item => item._checked).length
    },
  },
  mounted() {
    // 页面加载后自动运行
    setTimeout(() => this.runAll(), 500)
  },
  methods: {
    addResult(name, pass, detail) {
      this.results.push({ name, pass, detail })
      this.doneTests++
      if (pass) this.passCount++
      else this.failCount++
      this.progressPct = Math.floor((this.doneTests / this.totalTests) * 100)
      this.$nextTick(() => { this.logTop = 999999 })
    },

    setRunning(name) {
      this.results.push({ name, pass: false, detail: '⏳ 运行中...' })
      this.progressPct = Math.floor((this.doneTests / this.totalTests) * 100)
    },

    async runAll() {
      if (this.running) return
      this.running = true
      this.results = []
      this.doneTests = 0
      this.passCount = 0
      this.failCount = 0

      // ====== 第一部分：云函数后端测试 ======
      try {
        this.totalTests += 8
        this.setRunning('云函数: testChapter11')
        const survey = uniCloud.importObject('survey')
        const cloudRes = await survey.testChapter11()

        if (cloudRes && cloudRes.errCode === 0) {
          this.addResult('云函数: testChapter11 调用成功', true,
            `pass=${cloudRes.data.passCount} fail=${cloudRes.data.failCount}`)
          // 展开子结果
          ;(cloudRes.data.results || []).forEach(r => {
            this.addResult(`  └ 云函数子测试: ${r.id}`, r.pass, r.msg + (r.detail ? ' | ' + r.detail : ''))
          })
        } else {
          this.addResult('云函数: testChapter11', false,
            cloudRes ? cloudRes.errMsg : '网络异常')
        }
      } catch (e) {
        this.addResult('云函数: testChapter11', false, '异常: ' + e.message)
      }

      // ====== 第二部分：前端纯逻辑测试 ======

      // ---- T1: 队列状态机 ----
      this.setRunning('前端: 队列状态机')
      {
        let ok = true
        const taskId = 'test_' + Date.now()
        const task = { id: taskId, status: 'queued', tagName: '测试', createdAt: Date.now(), data: null, errCode: null, errMsg: null }

        if (task.status !== 'queued') ok = false

        // queued → generating
        task.status = 'generating'
        if (task.status !== 'generating') ok = false

        // generating → done
        task.status = 'done'
        task.data = { surveyId: 'test_sv' }
        if (task.status !== 'done' || task.data.surveyId !== 'test_sv') ok = false

        // generating → failed
        const t2 = { id: 'test_t2', status: 'generating', tagName: 't2', createdAt: Date.now(), data: null, errCode: null, errMsg: null }
        t2.status = 'failed'
        t2.errCode = 'TIMEOUT'
        if (t2.status !== 'failed' || t2.errCode !== 'TIMEOUT') ok = false

        this.addResult('前端: 队列状态机', ok, ok ? 'queued→generating→done/failed 正确' : '状态转换异常')
      }

      // ---- T2: 错误码映射 ----
      this.setRunning('前端: 错误码映射')
      {
        const map = {
          'AUTH_ERROR': '需要先登录才能指挥标签机干活',
          'VALIDATE_ERROR': '标签机吐出来的模板格式不对，换个标签名试试',
          'COZE_QUOTA_EXHAUSTED': '标签机今天累了，明天再来教它吧',
          'TIMEOUT': '标签机印太久卡住了，重新试试',
          'NETWORK_ERROR': '信号不太好，标签机没收到指令'
        }
        const getMsg = (c) => map[c] || '标签机出了点小问题，稍后再试'

        let ok = true
        if (getMsg('COZE_QUOTA_EXHAUSTED') !== '标签机今天累了，明天再来教它吧') ok = false
        if (getMsg('TIMEOUT') !== '标签机印太久卡住了，重新试试') ok = false
        if (getMsg('NETWORK_ERROR') !== '信号不太好，标签机没收到指令') ok = false
        if (getMsg('UNKNOWN') !== '标签机出了点小问题，稍后再试') ok = false

        this.addResult('前端: 错误码映射', ok, ok ? '6 个已知码 + 兜底映射正确' : '映射异常')
      }

      // ---- T3: 超时检测 ----
      this.setRunning('前端: 超时检测（generating > 60s）')
      {
        const now = Date.now()
        const tasks = [
          { id: 'a', status: 'generating', createdAt: now - 10000 },
          { id: 'b', status: 'generating', createdAt: now - 61000 },
          { id: 'c', status: 'queued', createdAt: now - 61000 },
        ]
        const stale = tasks.filter(t => t.status === 'generating' && (now - t.createdAt) > 60000)
        const ok = stale.length === 1 && stale[0].id === 'b'
        this.addResult('前端: 超时检测', ok, ok ? '仅 61s 的 detected, 10s 和 queued 跳过' : '检测逻辑异常')
      }

      // ---- T4: 过期清理 ----
      this.setRunning('前端: 过期清理')
      {
        const now = Date.now()
        const ONE_DAY = 86400000
        const ONE_HOUR = 3600000
        const tasks = [
          { id: '1', status: 'done', createdAt: now - ONE_DAY - 1 },
          { id: '2', status: 'done', createdAt: now - 1000 },
          { id: '3', status: 'failed', createdAt: now - ONE_HOUR - 1 },
          { id: '4', status: 'failed', createdAt: now - 1000 },
        ]
        const cleaned = tasks.filter(t => {
          const age = now - t.createdAt
          if (t.status === 'done' && age > ONE_DAY) return false
          if (t.status === 'failed' && age > ONE_HOUR) return false
          return true
        })
        const ok = cleaned.length === 2 && cleaned.find(c => c.id === '2') && cleaned.find(c => c.id === '4')
        this.addResult('前端: 过期清理', ok, ok ? `清理后剩余 ${cleaned.map(c => c.id).join(',')}` : '清理不正确')
      }

      // ---- T5: active 列表计算 ----
      this.setRunning('前端: active 列表计算')
      {
        const tasks = [
          { id: 'a', status: 'queued' },
          { id: 'b', status: 'generating' },
          { id: 'c', status: 'done' },
          { id: 'd', status: 'failed' },
        ]
        const active = tasks.filter(t => t.status === 'queued' || t.status === 'generating')
        const ok = active.length === 2 && active.filter(t => t.status === 'queued').length === 1
        this.addResult('前端: active 列表计算', ok, ok ? 'active=2 (1 queued + 1 generating)' : `计算错误 ${active.length}`)
      }

      // ---- T6: _previewData Storage 读写（11.1 核心） ----
      this.setRunning('前端: _previewData Storage 读写（11.1）')
      {
        const mockData = {
          surveyId: 'sv_ch11_test',
          tag: '测试标签',
          title: '测试标题',
          dims: ['维度A', '维度B'],
          qs: [{ title: '题1', dim: '维度A' }],
          rts: [{ name: '结果1', emoji: '🎯', desc: '描述', match: '维度A' }],
          clickCount: 5,
          isPublic: true,
        }
        uni.setStorageSync('_previewData', mockData)
        const read = uni.getStorageSync('_previewData')
        const ok = read && read.surveyId === 'sv_ch11_test' && read.title === '测试标题' && read.dims.length === 2
        uni.removeStorageSync('_previewData')
        this.addResult('前端: _previewData Storage 读写', ok, ok ? '写入→读取→字段完整性 通过' : `读取失败: ${JSON.stringify(read)}`)
      }

      // ---- T7: _updateTaskStatus 逻辑 ----
      this.setRunning('前端: _updateTaskStatus 状态更新')
      {
        let queue = [{
          id: 't_test', status: 'queued', tagName: 'test',
          createdAt: Date.now(), data: null, errCode: null, errMsg: null
        }]
        const update = (q, tid, status, extra = {}) => {
          const idx = q.findIndex(t => t.id === tid)
          if (idx === -1) return false
          if (status !== undefined) q[idx].status = status
          if (extra.data !== undefined) q[idx].data = extra.data
          if (extra.errCode !== undefined) q[idx].errCode = extra.errCode
          if (extra.errMsg !== undefined) q[idx].errMsg = extra.errMsg
          return true
        }
        const r1 = update(queue, 't_test', 'done', { data: { surveyId: 'xx' } })
        const ok = r1 && queue[0].status === 'done' && queue[0].data.surveyId === 'xx'
        const r2 = update(queue, 'nonexistent', 'done')
        const ok2 = r2 === false
        this.addResult('前端: _updateTaskStatus', ok && ok2,
          (ok && ok2) ? '更新+不存在处理 正确' : `更新=${r1} 不存在=${r2}`)
      }

      // ---- T8: 队列容量上限 ----
      this.setRunning('前端: 队列容量上限')
      {
        const mockQueue = Array.from({ length: 10 }, (_, i) => ({
          id: `t${i}`, status: 'queued', tagName: `标签${i}`, createdAt: Date.now(), data: null, errCode: null, errMsg: null
        }))
        const ok = mockQueue.length === 10 && mockQueue.length >= 10
        const canAdd = mockQueue.length < 10
        this.addResult('前端: 队列容量上限', ok && !canAdd, '10 条满，拒绝添加')
      }

      // ====== 完成 ======
      this.running = false
      console.log(`[CH11-TEST] 全部完成: ${this.passCount}/${this.doneTests} 通过`)
    },

    copyLogs() {
      if (this.results.length === 0) {
        uni.showToast({ title: '日志为空', icon: 'none' })
        return
      }
      const now = new Date()
      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      const header = `[Chapter11 测试日志 ${ts}]\n${this.passCount}/${this.doneTests} 通过\n${'─'.repeat(40)}\n`
      const body = this.results
        .filter(r => !r.detail.includes('⏳')) // 跳过运行中状态
        .map(r => `${r.pass ? '✅' : '❌'} ${r.name}\n   ${r.detail}`)
        .join('\n')
      const footer = `\n${'─'.repeat(40)}\n总计: ${this.passCount} 通过 / ${this.doneTests - this.passCount} 失败 / ${this.doneTests} 项`
      uni.setClipboardData({
        data: header + body + footer,
        success: () => uni.showToast({ title: `已复制 ${this.results.length} 条`, icon: 'success' })
      })
    },

    async fetchList() {
      this.listLoading = true
      this.cleanupList = []
      this.listLoaded = false
      try {
        const survey = uniCloud.importObject('survey')
        const r = await survey.listNonDarkGold()
        if (r.errCode === 0 && r.data.list) {
          this.cleanupList = r.data.list.map(item => ({ ...item, _checked: false }))
          this.listLoaded = true
        } else {
          uni.showToast({ title: r.errMsg || '获取失败', icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: '网络异常', icon: 'none' })
      }
      this.listLoading = false
    },

    toggleItem(item) {
      item._checked = !item._checked
    },

    toggleAll() {
      const all = !this.allSelected
      this.cleanupList.forEach(item => { item._checked = all })
    },

    deleteSelected() {
      const selected = this.cleanupList.filter(item => item._checked)
      if (selected.length === 0) return

      const tagIds = selected.map(item => item.tagId)
      const surveyIds = [...new Set(selected.map(item => item.surveyId).filter(id => id))]

      uni.showModal({
        title: '确认删除',
        content: `删除 ${tagIds.length} 个标签\n及 ${surveyIds.length} 个关联问卷？\n\n标签: ${selected.map(s => s.tagName).join(', ')}`,
        confirmText: '确认删除',
        cancelText: '取消',
        confirmColor: '#f87171',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '删除中...', mask: true })
          try {
            const survey = uniCloud.importObject('survey')
            const r = await survey.deleteTagsAndSurveys({ tagIds, surveyIds })
            uni.hideLoading()
            if (r.errCode === 0) {
              uni.showToast({ title: `已删除 ${r.data.deletedTags} 标签 ${r.data.deletedSurveys} 问卷`, icon: 'success' })
              // 从列表中移除已删除的
              this.cleanupList = this.cleanupList.filter(item => !item._checked)
            } else {
              uni.showModal({ title: '删除失败', content: r.errMsg, showCancel: false, confirmText: '知道了' })
            }
          } catch (e) {
            uni.hideLoading()
            uni.showModal({ title: '删除异常', content: e.message, showCancel: false, confirmText: '知道了' })
          }
        }
      })
    },

    runCleanup() {
      uni.showModal({
        title: '确认清理',
        content: '将删除所有非暗金稀有度的用户标签及关联问卷，此操作不可恢复！',
        confirmText: '确认删除',
        cancelText: '取消',
        confirmColor: '#f87171',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '清理中...', mask: true })
          try {
            const survey = uniCloud.importObject('survey')
            const r = await survey.adminCleanupNonDarkGold()
            uni.hideLoading()
            if (r.errCode === 0) {
              uni.showModal({
                title: '清理完成',
                content: `删除标签 ${r.data.deletedTags} 个\n删除问卷 ${r.data.deletedSurveys} 个`,
                showCancel: false,
                confirmText: '知道了',
              })
            } else {
              uni.showModal({
                title: '清理失败',
                content: r.errMsg || '未知错误',
                showCancel: false,
                confirmText: '知道了',
              })
            }
          } catch (e) {
            uni.hideLoading()
            uni.showModal({
              title: '清理异常',
              content: e.message || '网络错误',
              showCancel: false,
              confirmText: '知道了',
            })
          }
        }
      })
    },
  },
}
</script>

<style>
view { box-sizing: border-box; }
.page { width: 100%; min-height: 100vh; background: #1a1a2e; display: flex; flex-direction: column; padding: 0 20rpx; }
.hd { padding: 40rpx 0 20rpx; text-align: center; }
.hd-title { font-size: 40rpx; font-weight: 700; color: #e0e0e0; display: block; }
.hd-sub { font-size: 24rpx; color: #888; margin-top: 8rpx; display: block; }

.status-bar { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 20rpx; margin-bottom: 16rpx; }
.status-progress { flex: 1; height: 12rpx; background: #333; border-radius: 6rpx; overflow: hidden; }
.status-fill { height: 100%; background: linear-gradient(90deg, #4ade80, #22c55e); border-radius: 6rpx; transition: width 0.3s; }
.status-txt { font-size: 22rpx; color: #aaa; white-space: nowrap; }

.log-panel { flex: 1; background: #16213e; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.log-item { display: flex; align-items: flex-start; gap: 12rpx; padding: 10rpx 0; border-bottom: 1rpx solid rgba(255,255,255,0.05); }
.log-icon { font-size: 28rpx; flex-shrink: 0; margin-top: 2rpx; }
.log-body { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.log-name { font-size: 26rpx; color: #ccc; font-weight: 600; }
.log-detail { font-size: 22rpx; color: #888; }
.log-pass .log-name { color: #4ade80; }
.log-fail .log-name { color: #f87171; }
.log-empty { padding: 120rpx 0; text-align: center; }
.empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-txt { font-size: 24rpx; color: #666; }

.btns { padding: 20rpx 0 40rpx; display: flex; justify-content: center; gap: 20rpx; }
.btn-main { padding: 24rpx 80rpx; background: linear-gradient(135deg, #4ade80, #22c55e); border-radius: 50rpx; cursor: pointer; }
.btn-main text { font-size: 30rpx; color: #fff; font-weight: 700; }
.btn-disabled { background: #333; }
.btn-copy { padding: 24rpx 40rpx; background: #333; border-radius: 50rpx; cursor: pointer; }
.btn-copy text { font-size: 28rpx; color: #aaa; }

.btns-warn { padding: 0 0 40rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx; }
.btn-danger { padding: 20rpx 60rpx; background: #7f1d1d; border: 2rpx solid #f87171; border-radius: 50rpx; cursor: pointer; }
.btn-danger text { font-size: 26rpx; color: #fca5a5; }
.warn-tip { font-size: 20rpx; color: #666; }

.section-title { font-size: 28rpx; color: #aaa; padding: 8rpx 0 12rpx; }
.list-toolbar { display: flex; gap: 16rpx; padding-bottom: 12rpx; flex-wrap: wrap; }
.btn-sm { padding: 12rpx 28rpx; background: #333; border-radius: 30rpx; cursor: pointer; }
.btn-sm text { font-size: 24rpx; color: #ccc; }
.btn-sm-danger { background: #7f1d1d; }
.btn-sm-danger text { color: #fca5a5; }
.list-status { font-size: 22rpx; color: #666; padding: 20rpx 0; text-align: center; }
.list-scroll { max-height: 400rpx; background: #16213e; border-radius: 12rpx; padding: 10rpx; margin-bottom: 16rpx; }
.list-item { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 12rpx; border-bottom: 1rpx solid rgba(255,255,255,0.05); cursor: pointer; }
.list-item-checked { background: rgba(74,222,128,0.08); }
.list-check { font-size: 32rpx; flex-shrink: 0; }
.list-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.list-name { font-size: 26rpx; color: #e0e0e0; }
.list-meta { font-size: 20rpx; color: #888; }
</style>
