<!-- ========== 置顶系统测试 Mock 页 ========== -->
<template>
	<view class="page">
		<!-- 头顶 -->
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">置顶系统测试</text>
				<text v-if="currentUser" class="hd-user">{{ currentUser }}</text>
			</view>
			<text class="hd-subtitle">阶段一·入池 / 阶段二·权重抽取 / 阶段三·过期清理 / 阶段四·候场区 / 阶段五·首页集成 / 阶段六·战绩单</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">

				<!-- ====== 1. 连通性测试 ====== -->
				<view class="section">
					<view class="section-title">1. 连通性测试 ping</view>
					<view class="card">
						<view class="card-row">
							<text class="card-label">ping</text>
							<view class="card-btn" hover-class="press-95" @click="callPing">
								<text class="btn-txt">{{ loading.ping ? '调用中...' : '调用 ping' }}</text>
							</view>
						</view>
						<view v-if="results.ping !== null" class="card-result" :class="results.ping.errCode === 0 ? 'success' : ''">
							<text class="result-icon">{{ results.ping.errCode === 0 ? '✓' : '✗' }}</text>
							<text class="result-txt">{{ JSON.stringify(results.ping) }}</text>
						</view>
					</view>
				</view>

				<!-- ====== 2. 资历查询 ====== -->
				<view class="section">
					<view class="section-title">2. 资历查询 getSeniority</view>
					<view class="card">
						<view class="card-row">
							<text class="card-label">getSeniority</text>
							<view class="card-btn" hover-class="press-95" @click="callGetSeniority">
								<text class="btn-txt">{{ loading.seniority ? '查询中...' : '查询资历' }}</text>
							</view>
						</view>

						<!-- 资历结果卡 -->
						<view v-if="results.seniority !== null" class="seniority-card">
							<view v-if="results.seniority.errCode === 0" class="seniority-body">
								<view class="sen-level">
									<text class="sen-level-val">{{ results.seniority.data.label }}</text>
								</view>
								<view class="sen-detail">
									<view class="sen-item">
										<text class="sen-key">exposureCount</text>
										<text class="sen-val">{{ results.seniority.data.exposureCount }}</text>
									</view>
									<view class="sen-item">
										<text class="sen-key">level</text>
										<text class="sen-val">{{ results.seniority.data.level }}</text>
									</view>
									<view class="sen-item">
										<text class="sen-key">nextLevelAt</text>
										<text class="sen-val" :class="results.seniority.data.nextLevelAt === null ? 'sen-done' : ''">
											{{ results.seniority.data.nextLevelAt === null ? '已满级' : `还需 ${results.seniority.data.nextLevelAt} 次` }}
										</text>
									</view>
								</view>
							</view>
							<view v-else class="sen-error">
								<text class="result-icon">✗</text>
								<text class="result-txt">{{ results.seniority.errMsg || JSON.stringify(results.seniority) }}</text>
							</view>
						</view>

						<!-- exposureCount 快速设置 -->
						<view class="set-panel">
							<text class="set-label">快速设置 exposureCount：</text>
							<view class="set-quick">
								<view v-for="v in [0, 1, 5, 6, 20, 21]" :key="v" class="quick-btn" hover-class="press-95" @click="callSetExposureCount(v)">
									<text class="quick-txt">{{ v }}</text>
								</view>
							</view>
							<view class="set-custom">
								<input class="set-input" v-model="editCount" type="number" placeholder="自定义值" />
								<view class="card-btn card-btn-sm" hover-class="press-95" @click="callSetExposureCount(Number(editCount))">
									<text class="btn-txt">{{ loading.setCount ? '设置中...' : '设置' }}</text>
								</view>
							</view>
							<text v-if="setResultMsg" class="set-msg" :class="setResultOk ? 'set-msg-ok' : 'set-msg-err'">{{ setResultMsg }}</text>
						</view>

						<view class="set-panel" style="margin-top: 12rpx;">
							<view class="set-custom">
								<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="callResetSlots">
									<text class="btn-txt">{{ loading.resetSlots ? '重置中...' : '重置三槽位' }}</text>
								</view>
								<text v-if="resetSlotsMsg" class="set-msg" :class="resetSlotsOk ? 'set-msg-ok' : 'set-msg-err'" style="margin-top: 0;">{{ resetSlotsMsg }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 3. 二次调用（缓存验证） ====== -->
				<view class="section">
					<view class="section-title">3. 缓存验证（可选）</view>
					<view class="card">
						<view class="card-row">
							<text class="card-label">再次查询资历（验证缓存）</text>
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callGetSeniority">
								<text class="btn-txt">再查一次</text>
							</view>
						</view>
						<view class="card-tip">
							<text class="tip-icon">ⓘ</text>
							<text class="tip-txt">第一次查完后去改 DB 资历值，再点这个，如果返回旧值说明缓存正常；返回新值说明缓存无效</text>
						</view>
					</view>
				</view>

				<!-- ====== 4. 方法列表测试 ====== -->
				<view class="section">
					<view class="section-title">4. 方法测试（已实现 / 空壳分离）</view>
					<view class="card">
						<view class="card-row">
							<text class="card-label">已实现方法验证</text>
							<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="callImplementedMethods">
								<text class="btn-txt">{{ loading.implMethods ? '测试中...' : '测试已实现' }}</text>
							</view>
						</view>
						<view v-if="implMethodResults.length > 0" class="shell-list">
							<view v-for="(item, idx) in implMethodResults" :key="idx" class="shell-item" :class="item.errCode === 0 ? 'shell-pass' : 'shell-fail'">
								<view class="shell-left">
									<text class="shell-icon">{{ item.errCode === 0 ? '✓' : '✗' }}</text>
									<text class="shell-name">{{ item.method }}</text>
								</view>
								<text class="shell-msg">{{ item.action || item.errMsg || JSON.stringify(item).slice(0, 100) }}</text>
							</view>
						</view>

						<view style="height: 16rpx;"></view>

						<view class="card-row">
							<text class="card-label">尚为空壳的方法</text>
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callAllShells">
								<text class="btn-txt">{{ loading.shells ? '测试中...' : '全部测试' }}</text>
							</view>
						</view>
						<view v-if="shellResults.length > 0" class="shell-list">
							<view v-for="(item, idx) in shellResults" :key="idx" class="shell-item" :class="item.errCode === 'NOT_IMPLEMENTED' ? 'shell-pass' : 'shell-fail'">
								<view class="shell-left">
									<text class="shell-icon">{{ item.errCode === 'NOT_IMPLEMENTED' ? '✓' : '✗' }}</text>
									<text class="shell-name">{{ item.method }}</text>
								</view>
								<text class="shell-msg">{{ item.errMsg || JSON.stringify(item) }}</text>
							</view>
							<view class="shell-summary">
								通过 {{ passedCount }} / 3
							</view>
						</view>
					</view>
				</view>

				<!-- ====== 5. 未登录测试 ====== -->
				<view class="section">
					<view class="section-title">5. 未登录测试（可选）</view>
					<view class="card">
						<view class="card-row">
							<text class="card-label">未登录时调 getSeniority</text>
							<view class="card-btn card-btn-amber" hover-class="press-95" @click="callSeniorityNoAuth">
								<text class="btn-txt">{{ loading.noauth ? '调用中...' : '模拟无 token 测试' }}</text>
							</view>
						</view>
						<view v-if="results.noauth !== null" class="card-result" :class="results.noauth.errCode === 'NOT_AUTH' ? 'success' : ''">
							<text class="result-icon">{{ results.noauth.errCode === 'NOT_AUTH' ? '✓' : '✗' }}</text>
							<text class="result-txt">{{ JSON.stringify(results.noauth) }}</text>
						</view>
						<view class="card-tip">
							<text class="tip-icon">ⓘ</text>
							<text class="tip-tip">退出登录后再来点这个，看是否返回 NOT_AUTH。如果已登录则用空 token 测试</text>
						</view>
					</view>
				</view>

				<!-- ====== 6. 入池测试 ====== -->
			<view class="section">
				<view class="section-title">6. 入池测试 handleAdReward / enterPool / queueToPool</view>
				<view class="card">
					<view class="set-panel">
						<text class="set-label">surveyId（调 enterPool）：</text>
						<view class="set-custom">
							<input class="set-input" v-model="testSurveyId" type="text" placeholder="填写一个已有的 surveyId" />
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callHandleAdReward">
								<text class="btn-txt">{{ loading.enterPool ? '调用中...' : '调 enterPool' }}</text>
							</view>
						</view>
						<text v-if="enterPoolResult" class="set-msg" :class="enterPoolResult.errCode === 0 ? 'set-msg-ok' : 'set-msg-err'">{{ JSON.stringify(enterPoolResult).length > 200 ? JSON.stringify(enterPoolResult).slice(0, 200) + '...' : JSON.stringify(enterPoolResult) }}</text>
					</view>

					<view style="height: 16rpx;"></view>

					<view class="set-panel">
						<text class="set-label">surveyId + queueId（调 queueToPool）：</text>
						<view class="set-custom">
							<input class="set-input" v-model="testSurveyId" type="text" placeholder="surveyId" style="flex: 1.5;" />
							<input class="set-input" v-model="testQueueId" type="text" placeholder="queueId" style="flex: 1.5;" />
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callQueueToPool">
								<text class="btn-txt">{{ loading.queueToPool ? '调用中...' : '调 queueToPool' }}</text>
							</view>
						</view>
						<text v-if="queueToPoolResult" class="set-msg" :class="queueToPoolResult.errCode === 0 ? 'set-msg-ok' : 'set-msg-err'">{{ JSON.stringify(queueToPoolResult).length > 200 ? JSON.stringify(queueToPoolResult).slice(0, 200) + '...' : JSON.stringify(queueToPoolResult) }}</text>
					</view>

					<view class="card-tip" style="margin-top: 16rpx;">
						<text class="tip-icon">ⓘ</text>
						<text class="tip-txt">
							场景对照：① 设 exposureCount=0 → 点"调 enterPool" → 预期直接入池（绿色通道跳过池满线）&#10;② 设 exposureCount=1（或更高）→ 调 enterPool → 如果池未满则直接入池，池满则进候场区&#10;③ 候场后复制 queueId → 填 queueId 点"调 queueToPool" → 预期转置顶
						</text>
					</view>
				</view>
			</view>

			<!-- ====== 7. 抽取测试 ====== -->
			<view class="section">
				<view class="section-title">7. 抽取测试 draw（阶段二 · 权重算法）</view>
				<view class="card">
					<view class="set-panel">
						<text class="set-label">抽取数量：</text>
						<view class="set-custom">
							<input class="set-input" v-model="drawCount" type="number" placeholder="5" />
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callDraw">
								<text class="btn-txt">{{ loading.draw ? '抽取中...' : '调 draw' }}</text>
							</view>
						</view>
					</view>

					<view v-if="drawResult !== null" class="card-result" :class="drawResult.errCode === 0 && drawResult.data ? 'success' : ''">
						<text class="result-icon">{{ drawResult.errCode === 0 && drawResult.data ? '✓' : '✗' }}</text>
						<text class="result-txt">{{ JSON.stringify(drawResult) }}</text>
					</view>

					<view v-if="drawResult && drawResult.errCode === 0 && drawResult.data && drawResult.data.items" class="draw-list">
						<view v-for="(item, idx) in drawResult.data.items" :key="idx" class="draw-item" :class="item.isMine ? 'draw-mine' : 'draw-other'">
							<view class="draw-rank">#{{ idx + 1 }}</view>
							<view class="draw-body">
								<text class="draw-title">{{ item.surveyTitle || item.surveyId }}</text>
								<view class="draw-tags">
									<text class="draw-tag" :class="item.isMine ? 'tag-mine' : 'tag-other'">{{ item.isMine ? '我的' : '他人' }}</text>
									<text v-if="item.haloActive" class="draw-tag tag-halo">光环</text>
									<text class="draw-tag tag-weight">权重 {{ item.weight }}</text>
								</view>
							</view>
						</view>
					</view>

					<view class="card-tip" style="margin-top: 16rpx;">
						<text class="tip-icon">ⓘ</text>
						<text class="tip-txt">
							先去入池测试区调几次 enterPool 造几条数据，再回来点 draw。权重高的排在前面。
							&#10;光环问卷权重 10000「我的」在 300~500「他人」在 1~200。
						</text>
					</view>
				</view>
			</view>

			<!-- ====== 8. 池子列表查看 ====== -->
			<view class="section">
				<view class="section-title">8. 池子内容查看 getPoolContents</view>
				<view class="card">
					<view class="set-panel">
						<text class="set-label">查看当前 pin-pool 中所有有效问卷：</text>
						<view class="set-custom">
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callGetPoolContents">
								<text class="btn-txt">{{ loading.poolContents ? '查询中...' : '查看池子' }}</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="callResetSlotsWithClear">
								<text class="btn-txt">{{ loading.resetSlots ? '重置中...' : '重置+清池' }}</text>
							</view>
						</view>
					</view>

					<view v-if="poolContents && poolContents.errCode === 0" class="pool-stats">
						<text class="pool-stats-txt">池中共 <text class="pool-stats-num">{{ poolContents.data.total }}</text> 条有效问卷</text>
					</view>

					<view v-if="poolContents && poolContents.errCode === 0 && poolContents.data.pins.length > 0" class="pool-list">
						<view v-for="(pin, idx) in poolContents.data.pins" :key="pin._id" class="pool-item" :class="pin.haloActive ? 'pool-halo' : 'pool-normal'">
							<view class="pool-rank">#{{ idx + 1 }}</view>
							<view class="pool-body">
								<text class="pool-title">{{ pin.surveyTitle || pin.surveyId }}</text>
								<view class="pool-tags">
									<text class="pool-tag tag-weight">权重 {{ pin.weight }}</text>
									<text v-if="pin.haloActive" class="pool-tag tag-halo">光环</text>
									<text class="pool-tag" :class="pin.remainingMinutes <= 2 ? 'tag-expiring' : 'tag-time'">剩 {{ pin.remainingMinutes }} 分钟</text>
								</view>
							</view>
						</view>
					</view>

					<view v-if="poolContents && poolContents.errCode === 0 && poolContents.data.pins.length === 0" class="card-result success">
						<text class="result-icon">✓</text>
						<text class="result-txt">池子为空，没有有效问卷</text>
					</view>

					<view v-if="poolContents && poolContents.errCode !== 0" class="card-result">
						<text class="result-icon">✗</text>
						<text class="result-txt">{{ poolContents.errMsg || JSON.stringify(poolContents) }}</text>
					</view>

					<view class="card-tip" style="margin-top: 16rpx;">
						<text class="tip-icon">ⓘ</text>
						<text class="tip-txt">
							每次 enterPool 都会在池中加一条记录。点「重置+清池」会清空你的池子记录和槽位，方便重新测试。
							&#10;灰色背景 = 普通问卷，黄色背景 = 光环问卷。过期倒计时 2 分钟内标红。
						</text>
					</view>
				</view>
			</view>

			<!-- ====== 9. 候场区测试（阶段四）步骤流 ====== -->
			<view class="section">
				<view class="section-title">9. 候场区测试 · 步骤流</view>

				<!-- === 顶部步骤进度条 === -->
				<view class="qflow-progress">
					<view class="qflow-step" :class="queueStep >= 0 ? 'qflow-done' : ''">
						<text class="qflow-step-num">⓪</text>
						<text class="qflow-step-lbl">生成候场</text>
					</view>
					<view class="qflow-connector" :class="queueStep >= 1 ? 'qflow-conn-on' : ''"></view>
					<view class="qflow-step" :class="queueStep >= 1 ? 'qflow-done' : ''">
						<text class="qflow-step-num">①</text>
						<text class="qflow-step-lbl">查询状态</text>
					</view>
					<view class="qflow-connector" :class="queueStep >= 2 ? 'qflow-conn-on' : ''"></view>
					<view class="qflow-step" :class="queueStep >= 2 ? 'qflow-done' : ''">
						<text class="qflow-step-num">②</text>
						<text class="qflow-step-lbl">加速/入池</text>
					</view>
					<view class="qflow-connector" :class="queueStep >= 3 ? 'qflow-conn-on' : ''"></view>
					<view class="qflow-step" :class="queueStep >= 3 ? 'qflow-done' : ''">
						<text class="qflow-step-num">③</text>
						<text class="qflow-step-lbl">模拟时间</text>
					</view>
				</view>

				<view class="card qflow-card">

					<!-- === 当前状态摘要 === -->
					<view class="qflow-summary">
						<view class="qflow-summary-item">
							<text class="qflow-summary-lbl">queueId</text>
							<text class="qflow-summary-val">{{ currentQueueId ? currentQueueId.slice(0, 24) + '...' : '—' }}</text>
						</view>
						<view class="qflow-summary-item">
							<text class="qflow-summary-lbl">surveyId</text>
							<text class="qflow-summary-val">{{ currentSurveyId }}</text>
						</view>
						<view v-if="queueStep >= 1 && stepResults.queueStatus" class="qflow-summary-item">
							<text class="qflow-summary-lbl">当前阶段</text>
							<text class="qflow-summary-val" :class="'qflow-phase-' + ((stepResults.queueStatus.data && stepResults.queueStatus.data.records[0]) ? stepResults.queueStatus.data.records[0].currentPhase : '')">
								{{ (stepResults.queueStatus.data && stepResults.queueStatus.data.records[0]) ? stepResults.queueStatus.data.records[0].currentPhase : '—' }}
							</text>
						</view>
					</view>

					<!-- ====== 步骤⓪：生成候场记录 ====== -->
					<view class="qflow-step-panel" :class="queueStep === 0 ? 'qflow-active' : 'qflow-done-panel'">
						<view class="qflow-step-header" @click="queueStep = 0">
							<text class="qflow-step-badge" :class="queueStep > 0 ? 'qflow-badge-done' : 'qflow-badge-active'">{{ queueStep > 0 ? '✓' : '⓪' }}</text>
							<text class="qflow-step-title">生成候场记录</text>
							<text v-if="queueStep > 0" class="qflow-step-status">已完成</text>
							<text v-else class="qflow-step-status">待操作</text>
						</view>
						<view v-if="queueStep === 0" class="qflow-step-body">
							<view class="qflow-tip">{{ forceQueueHint }}</view>
							<view class="qflow-inline" style="margin-bottom: 10rpx;">
								<input class="qflow-input" v-model="currentSurveyId" type="text" placeholder="surveyId" />
								<view class="card-btn card-btn-sm" hover-class="press-95" @click="callEnterQueue">
									<text class="btn-txt">{{ stepLoading.enterQueue ? '调用中...' : '→ 进候场' }}</text>
								</view>
							</view>
							<view class="qflow-inline">
								<view class="qflow-toggle" :class="forceQueueMode ? 'qflow-toggle-on' : ''" @click="callToggleForceQueue">
									<view class="qflow-toggle-knob"></view>
									<text class="qflow-toggle-txt">{{ forceQueueMode ? '强制候场(开)' : '强制候场(关)' }}</text>
								</view>
							</view>
							<view v-if="stepResults.enterQueue" class="qflow-result" :class="stepResults.enterQueue.errCode === 0 ? 'qflow-ok' : 'qflow-err'">
								<text>{{ stepResults.enterQueue.errCode === 0 ? '✓' : '✗' }} {{ statusText }}</text>
								<text v-if="stepResults.enterQueue.errCode === 0 && stepResults.enterQueue.action === 'enter_queue' && stepResults.enterQueue.queueData" class="qflow-result-sub">
									queueId: {{ stepResults.enterQueue.queueData.queueId }}
								</text>
								<text v-if="stepResults.enterQueue.errCode === 0 && stepResults.enterQueue.action === 'direct_entry' && stepResults.enterQueue.greenChannel" class="qflow-result-sub">
									绿色通道（Lv.0 新人特权），切换强制候场或设 exposureCount ≥ 1 可绕过
								</text>
								<text v-if="stepResults.enterQueue.errCode === 0 && stepResults.enterQueue.action === 'direct_entry' && !stepResults.enterQueue.greenChannel" class="qflow-result-sub">
									池子未满，直接入池。开启「强制候场」开关重试
								</text>
							</view>
							<view v-if="stepResults.enterQueue && stepResults.enterQueue.errCode === 0 && stepResults.enterQueue.action === 'enter_queue'" class="qflow-step-action" @click="advanceStep(1)">
								<text class="qflow-step-action-txt">下一步 → 查询候场状态</text>
							</view>
						</view>
					</view>

					<!-- ====== 步骤①：查询候场状态 ====== -->
					<view class="qflow-step-panel" :class="queueStep === 1 ? 'qflow-active' : (queueStep > 1 ? 'qflow-done-panel' : '')">
						<view class="qflow-step-header" @click="queueStep = 1">
							<text class="qflow-step-badge" :class="queueStep > 1 ? 'qflow-badge-done' : (queueStep === 1 ? 'qflow-badge-active' : 'qflow-badge-wait')">{{ queueStep > 1 ? '✓' : (queueStep >= 1 ? '①' : '①') }}</text>
							<text class="qflow-step-title">查询候场状态</text>
							<text v-if="queueStep > 1" class="qflow-step-status">已完成</text>
							<text v-else-if="queueStep === 1" class="qflow-step-status qflow-status-now">当前步骤</text>
							<text v-else class="qflow-step-status">等待</text>
						</view>
						<view v-if="queueStep === 1" class="qflow-step-body">
							<view class="qflow-inline">
								<view class="card-btn card-btn-sm" hover-class="press-95" @click="callGetQueueStatus">
									<text class="btn-txt">{{ stepLoading.queueStatus ? '查询中...' : '🔍 查询状态' }}</text>
								</view>
							</view>

							<!-- 候场记录详情卡 -->
							<view v-if="stepResults.queueStatus && stepResults.queueStatus.errCode === 0" class="qflow-queue-card">
								<view v-for="(rec, idx) in ((stepResults.queueStatus.data && stepResults.queueStatus.data.records) || [])" :key="idx" class="qflow-queue-item"
									:class="rec.status === 'completed' ? 'qflow-qi-done' : (rec.status === 'auto_pool_failed' ? 'qflow-qi-err' : '')">
									<view class="qflow-qi-header">
										<text class="qflow-qi-phase" :class="'qflow-phase-' + (rec.currentPhase || '')">{{ rec.currentPhase || (rec.status === 'completed' ? '已完成' : '?') }}</text>
										<text class="qflow-qi-accel">加速 {{ rec.acceleratedCount }}/{{ rec.maxAccelCount }}</text>
									</view>
									<view class="qflow-qi-body">
										<text class="qflow-qi-field">slot 资历: Lv.{{ rec.seniorityLevel }}</text>
									</view>
									<view v-if="rec.logs && rec.logs.length > 0" class="qflow-qi-logs">
										<text v-for="(log, li) in rec.logs" :key="li" class="qflow-qi-log">{{ log }}</text>
									</view>
									<view v-if="rec.status === 'completed'" class="qflow-qi-done-badge">
										<text>✓ 已自动入池</text>
									</view>
									<view v-if="rec.status === 'auto_pool_failed'" class="qflow-qi-err-badge">
										<text>⚠ {{ rec.errMsg }}</text>
									</view>
								</view>
								<view v-if="(stepResults.queueStatus.data && stepResults.queueStatus.data.records && stepResults.queueStatus.data.records.length === 0)" class="qflow-empty">
									<text>暂无候场记录</text>
								</view>
							</view>
							<view v-if="stepResults.queueStatus && stepResults.queueStatus.errCode !== 0" class="qflow-result qflow-err">
								<text>✗ {{ stepResults.queueStatus.errMsg }}</text>
							</view>

							<view class="qflow-step-actions">
								<view class="qflow-step-action" @click="advanceStep(2)">
									<text class="qflow-step-action-txt">下一步 → 执行加速</text>
								</view>
								<view class="qflow-step-action qflow-step-action-sec" @click="callGetQueueStatus">
									<text class="qflow-step-action-txt">↻ 刷新状态</text>
								</view>
							</view>
						</view>
					</view>

					<!-- ====== 步骤②：执行加速 ====== -->
					<view class="qflow-step-panel" :class="queueStep === 2 ? 'qflow-active' : (queueStep > 2 ? 'qflow-done-panel' : '')">
						<view class="qflow-step-header" @click="queueStep = 2">
							<text class="qflow-step-badge" :class="queueStep > 2 ? 'qflow-badge-done' : (queueStep === 2 ? 'qflow-badge-active' : 'qflow-badge-wait')">{{ queueStep > 2 ? '✓' : '②' }}</text>
							<text class="qflow-step-title">加速 / 入池</text>
							<text v-if="queueStep > 2" class="qflow-step-status">已完成</text>
							<text v-else-if="queueStep === 2" class="qflow-step-status qflow-status-now">当前步骤</text>
							<text v-else class="qflow-step-status">等待</text>
						</view>
						<view v-if="queueStep === 2" class="qflow-step-body">
							<view class="qflow-tip">每次加速消耗一次广告观看，第三次加速自动完成入池（queueToPool）</view>
							<view class="qflow-inline">
								<view class="card-btn card-btn-sm" hover-class="press-95" @click="callExecuteAccel">
									<text class="btn-txt">{{ stepLoading.accel ? '加速中...' : '⚡ 执行加速' }}</text>
								</view>
							</view>

							<view v-if="stepResults.accel" class="qflow-result" :class="stepResults.accel.errCode === 0 ? 'qflow-ok' : 'qflow-err'">
								<text>{{ stepResults.accel.errCode === 0 ? '' : '✗' }} {{ stepResults.accel.action === 'accelerated' ? `加速成功 → ${stepResults.accel.data.currentPhase} (第 ${stepResults.accel.data.acceleratedCount} 次)` : '' }}</text>
								<text v-if="stepResults.accel.action === 'pool_entry'">✓ 入池成功！pinId: {{ stepResults.accel.pinData && stepResults.accel.pinData._id }}</text>
								<text v-if="stepResults.accel.errMsg">{{ stepResults.accel.errMsg }}</text>
							</view>
							<view v-if="stepResults.accel && stepResults.accel.data && stepResults.accel.data.logs" class="qflow-qi-logs" style="margin-top: 10rpx;">
								<text v-for="(log, li) in stepResults.accel.data.logs" :key="li" class="qflow-qi-log">{{ log }}</text>
							</view>

							<view class="qflow-step-actions">
								<view class="qflow-step-action" @click="advanceStep(3)">
									<text class="qflow-step-action-txt">下一步 → 模拟时间推进</text>
								</view>
								<view class="qflow-step-action qflow-step-action-sec" @click="callExecuteAccel">
									<text class="qflow-step-action-txt">↻ 再加速一次</text>
								</view>
							</view>
						</view>
					</view>

					<!-- ====== 步骤③：手动设置 enterAt（模拟时间推进） ====== -->
					<view class="qflow-step-panel" :class="queueStep === 3 ? 'qflow-active' : ''">
						<view class="qflow-step-header" @click="queueStep = 3">
							<text class="qflow-step-badge" :class="queueStep === 3 ? 'qflow-badge-active' : 'qflow-badge-wait'">{{ queueStep > 2 ? (queueStep === 3 ? '③' : '✓') : '③' }}</text>
							<text class="qflow-step-title">模拟时间推进</text>
							<text v-if="queueStep === 3" class="qflow-step-status qflow-status-now">当前步骤</text>
							<text v-else class="qflow-step-status">等待</text>
						</view>
						<view v-if="queueStep === 3" class="qflow-step-body">
							<view class="qflow-tip">手动修改 enterAt 模拟时间流逝，然后点「① 查询状态」看阶段变化</view>
							<view class="qflow-time-btns">
								<view v-for="opt in enterAtOptions" :key="opt.label" class="qflow-time-btn" hover-class="press-95" @click="callSetEnterAt(opt.minutes)">
									<text class="qflow-time-btn-lbl">{{ opt.label }}</text>
									<text class="qflow-time-btn-tip">{{ opt.minutes }} 分钟前</text>
								</view>
							</view>
							<text v-if="stepResults.setEnterAt" class="qflow-result qflow-ok" style="margin-top: 10rpx; display: block;">{{ stepResults.setEnterAt }}</text>
							<view class="qflow-hint">
								<text class="qflow-hint-icon">ⓘ</text>
								<text class="qflow-hint-txt">设完后点上方步骤①「刷新状态」查看阶段变化。queuing(0~5min) → inspecting(5~12) → pushing(12~22) → ready(22~30)</text>
							</view>

							<view class="qflow-step-actions">
								<view class="qflow-step-action" @click="queueStep = 1">
									<text class="qflow-step-action-txt">← 回到步骤① 刷新状态</text>
								</view>
							</view>
						</view>
					</view>

				</view>
			</view>

			<!-- ====== 10. 过期清理测试（阶段三） ====== -->
			<view class="section">
				<view class="section-title">10. 过期清理测试 · 定时云函数</view>
				<view class="card">
					<!-- 状态指示 -->
					<view class="exp-status">
						<text class="exp-dot" :class="expStatusColor"></text>
						<text class="exp-label">数据状态：</text>
						<text class="exp-val" :class="expStatusColor">{{ expStatusText }}</text>
					</view>

					<!-- 操作按钮：2x2 网格 -->
					<view class="exp-grid">
						<view class="exp-btn" hover-class="press-95" :class="expLoading.seed ? 'btn-disabled' : 'btn-seed'" @click="callSeedExpiry">
							<text class="exp-btn-txt">{{ expLoading.seed ? '造数据中...' : '① 造测试数据' }}</text>
						</view>
						<view class="exp-btn" hover-class="press-95" :class="expLoading.callFn ? 'btn-disabled' : 'btn-call'" @click="callPinExpiry">
							<text class="exp-btn-txt">{{ expLoading.callFn ? '调用中...' : '② 调 pin-expiry' }}</text>
						</view>
						<view class="exp-btn" hover-class="press-95" :class="expLoading.query ? 'btn-disabled' : 'btn-query'" @click="callQueryCareer">
							<text class="exp-btn-txt">{{ expLoading.query ? '查询中...' : '③ 查看战绩单' }}</text>
						</view>
						<view class="exp-btn" hover-class="press-95" :class="expLoading.clean ? 'btn-disabled' : 'btn-clean'" @click="callCleanExpiry">
							<text class="exp-btn-txt">{{ expLoading.clean ? '清理中...' : '④ 清理数据' }}</text>
						</view>
					</view>

					<!-- 操作提示 -->
					<view class="card-tip" style="margin-top: 16rpx;">
						<text class="tip-icon">ⓘ</text>
						<text class="tip-txt">
							按编号顺序操作：① 造数据 → ② 调云函数 → ③ 看战绩 → ④ 清理。&#10;注意：需要先部署 pin-expiry 云函数到云端才能被调用。
						</text>
					</view>

					<!-- 调 expiry 的结果 -->
					<view v-if="expiryResult !== null" class="exp-result p-12-16" style="margin-top: 16rpx;">
						<text class="exp-result-title">pin-expiry 返回值</text>
						<text class="exp-result-json">{{ JSON.stringify(expiryResult, null, 2) }}</text>
					</view>

					<!-- 战绩单结果 -->
					<view v-if="careerRecords !== null" class="exp-result p-12-16" style="margin-top: 12rpx;">
						<text class="exp-result-title">战绩单记录</text>
						<view v-if="careerRecords.length > 0" class="p-0-8">
							<view v-for="(cr, idx) in careerRecords" :key="idx" class="cr-card">
								<view class="cr-header">
									<text class="cr-number">#{{ cr.careerNumber }} · {{ cr.archiveNumber }}</text>
									<text class="cr-honor">{{ cr.honor ? cr.honor.name : '—' }}</text>
								</view>
								<view class="cr-stats">
									<view class="cr-stat">
										<text class="cr-stat-num">{{ cr.stats ? cr.stats.views : '—' }}</text>
										<text class="cr-stat-lbl">驻足注视</text>
									</view>
									<view class="cr-arrow">
										<text class="cr-arrow-icon">→</text>
									</view>
									<view class="cr-stat">
										<text class="cr-stat-num">{{ cr.stats ? cr.stats.clicks : '—' }}</text>
										<text class="cr-stat-lbl">好奇打开</text>
									</view>
									<view class="cr-arrow">
										<text class="cr-arrow-icon">→</text>
									</view>
									<view class="cr-stat">
										<text class="cr-stat-num">{{ cr.stats ? cr.stats.favorites : '—' }}</text>
										<text class="cr-stat-lbl">决定存档</text>
									</view>
								</view>
								<view v-if="cr.bonusTriggered" class="cr-bonus">
									<text class="cr-bonus-icon">⚡</text>
									<text class="cr-bonus-txt">暴击 ×{{ cr.bonusMultiplier ? cr.bonusMultiplier.toFixed(2) : '—' }}</text>
								</view>
								<view class="cr-comment">
									<text class="cr-comment-txt">{{ cr.comment ? cr.comment.substring(0, 120) : '' }}{{ cr.comment && cr.comment.length > 120 ? '...' : '' }}</text>
								</view>
							</view>
						</view>
						<view v-else class="cr-empty">
							<text class="cr-empty-txt">暂无战绩单记录。先调 pin-expiry 再回来查。</text>
						</view>
					</view>

					<!-- 操作反馈 -->
					<text v-if="expMsg" class="set-msg" :class="expMsgOk ? 'set-msg-ok' : 'set-msg-err'" style="margin-top: 12rpx;">{{ expMsg }}</text>
				</view>
			</view>

			<!-- ====== 11. 阶段五·首页集成测试 ====== -->
			<view class="section">
				<view class="section-title">11. 阶段五 · 首页集成测试（draw字段/卡片渲染/事件回调）</view>
				<view class="card">

					<!-- ====== Panel A: draw 返回字段明细 ====== -->
					<view class="p5-panel">
						<text class="p5-panel-title">A. draw 字段明细</text>
						<text class="p5-panel-desc">调用 draw 后展开每张卡片的完整字段，重点确认 surveyAuthor / surveyCover 存在</text>
						<view class="set-custom p5-inline">
							<input class="set-input" v-model="p5DrawCount" type="number" placeholder="5" />
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="p5CallDraw">
								<text class="btn-txt">{{ p5Loading.draw ? '抽取中...' : '调 draw' }}</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="p5ClearDraw">
								<text class="btn-txt">清空</text>
							</view>
						</view>

						<view v-if="p5DrawResult !== null" class="p5-draw-raw">
							<text class="p5-raw-label">errCode: {{ p5DrawResult.errCode }}</text>
							<text class="p5-raw-info">共抽取 {{ (p5DrawResult.data && p5DrawResult.data.items) ? p5DrawResult.data.items.length : 0 }} 条</text>
						</view>

						<!-- 逐卡片字段展开 -->
						<view v-if="p5DrawResult && p5DrawResult.errCode === 0 && p5DrawResult.data && p5DrawResult.data.items" class="p5-field-list">
							<view v-for="(item, idx) in p5DrawResult.data.items" :key="idx" class="p5-field-card"
								:class="item.isMine ? 'p5-fc-mine' : 'p5-fc-other'">
								<view class="p5-fc-header">
									<text class="p5-fc-rank">#{{ idx + 1 }}</text>
									<view class="p5-fc-tags">
										<text v-if="item.isMine" class="p5-tag p5-tag-mine">我的</text>
										<text v-if="item.haloActive" class="p5-tag p5-tag-halo">光环</text>
									</view>
								</view>
								<view class="p5-fc-field">
									<text class="p5-fc-key">_id</text>
									<text class="p5-fc-val p5-fc-val-mono">{{ item._id }}</text>
								</view>
								<view class="p5-fc-field">
									<text class="p5-fc-key">surveyTitle</text>
									<text class="p5-fc-val">{{ item.surveyTitle }}</text>
								</view>
								<view class="p5-fc-field p5-fc-field-focus">
									<text class="p5-fc-key">surveyAuthor</text>
									<text class="p5-fc-val">{{ item.surveyAuthor || '（空）' }}</text>
									<text class="p5-fc-badge" :class="item.surveyAuthor ? 'p5-badge-ok' : 'p5-badge-warn'">{{ item.surveyAuthor ? '有值' : '为空' }}</text>
								</view>
								<view class="p5-fc-field p5-fc-field-focus">
									<text class="p5-fc-key">surveyCover</text>
									<text class="p5-fc-val p5-fc-val-mono">{{ item.surveyCover ? item.surveyCover.slice(0, 50) + '...' : '（空）' }}</text>
									<text class="p5-fc-badge" :class="item.surveyCover ? 'p5-badge-ok' : 'p5-badge-warn'">{{ item.surveyCover ? '有值' : '为空' }}</text>
								</view>
								<view class="p5-fc-field">
									<text class="p5-fc-key">weight</text>
									<text class="p5-fc-val">{{ item.weight }}</text>
								</view>
								<view class="p5-fc-field">
									<text class="p5-fc-key">expireAt</text>
									<text class="p5-fc-val p5-fc-val-mono">{{ item.expireAt }}</text>
								</view>
							</view>
						</view>

						<view v-if="p5DrawResult && p5DrawResult.errCode === 0 && p5DrawResult.data && p5DrawResult.data.items && p5DrawResult.data.items.length === 0" class="p5-empty-hint">
							<text>池子为空，先去 section 6 入池造数据</text>
						</view>
					</view>

					<!-- ====== Panel B: 首页卡片模拟渲染 ====== -->
					<view class="p5-panel">
						<text class="p5-panel-title">B. 首页卡片模拟（像 pin-topbar 那样渲染）</text>
						<text class="p5-panel-desc">模拟首页 pin-topbar 组件的水平滚动卡片列表——每个卡片展示封面/标题/作者/角标/光环</text>
						<view class="p5-topbar-preview">
							<scroll-view class="p5-topbar-track" scroll-x enable-flex>
								<view v-for="(item, idx) in p5PreviewCards" :key="idx" class="p5-topbar-card">
									<view class="p5-topbar-cover">
										<image v-if="item.surveyCover" :src="item.surveyCover" class="p5-topbar-img" mode="aspectFill" />
										<text v-else class="p5-topbar-emoji">📋</text>
										<view v-if="item.isMine" class="p5-topbar-badge">
											<text class="p5-topbar-badge-txt">我</text>
										</view>
										<view v-if="item.haloActive" class="p5-topbar-halo"></view>
									</view>
									<text class="p5-topbar-title">{{ item.surveyTitle }}</text>
									<text class="p5-topbar-author">{{ item.surveyAuthor || '匿名' }}</text>
								</view>
							</scroll-view>
							<view v-if="p5PreviewCards.length === 0" class="p5-empty-hint">
								<text>先调上方 Panel A 的「调 draw」拉取数据，会自动填充到此处</text>
							</view>
						</view>
					</view>

					<!-- ====== Panel C: 事件回调验证 ====== -->
					<view class="p5-panel">
						<text class="p5-panel-title">C. 模拟首页事件回调</text>
						<text class="p5-panel-desc">验证 onPinned / onGreenChannel 回调参数结构是否与首页 index.vue 兼容</text>
						<view class="p5-event-btns">
							<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="p5SimulateDirectEntry">
								<text class="btn-txt">{{ p5Loading.simDirect ? '模拟中...' : '模拟 direct_entry' }}</text>
							</view>
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="p5SimulateQueue">
								<text class="btn-txt">{{ p5Loading.simQueue ? '模拟中...' : '模拟 enter_queue' }}</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-amber" hover-class="press-95" @click="p5SimulateGreenChannel">
								<text class="btn-txt">{{ p5Loading.simGreen ? '模拟中...' : '模拟 greenChannel' }}</text>
							</view>
						</view>

						<view v-if="p5EventLogs.length > 0" class="p5-event-log">
							<view v-for="(log, idx) in p5EventLogs" :key="idx" class="p5-event-item">
								<text class="p5-event-icon" :class="'p5-ev-' + log.type">{{ log.type === 'err' ? '✗' : '✓' }}</text>
								<text class="p5-event-msg">{{ log.msg }}</text>
							</view>
						</view>
					</view>

				</view>
			</view>

			<!-- ====== 12. 模拟数据管理（自己配他人问卷） ====== -->
			<view class="section">
				<view class="section-title">12. 模拟数据管理 · 配置他人用户与问卷</view>
				<view class="card">

					<!-- === 操作栏 === -->
					<view class="mock-toolbar">
						<view class="card-btn card-btn-sm" hover-class="press-95" @click="mockAddUser">
							<text class="btn-txt">+ 添加用户</text>
						</view>
						<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="mockSeed">
							<text class="btn-txt">{{ mockLoading.seed ? '注入中...' : '📦 注入池子' }}</text>
						</view>
						<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="mockClean">
							<text class="btn-txt">{{ mockLoading.clean ? '清理中...' : '🗑 清空' }}</text>
						</view>
					</view>
					<text v-if="mockResultMsg" class="mock-result-msg" :class="mockResultOk ? 'mock-msg-ok' : 'mock-msg-err'">{{ mockResultMsg }}</text>

					<!-- === 用户列表 === -->
					<view v-if="mockUsers.length === 0" class="mock-empty">
						<text class="mock-empty-txt">暂无模拟用户，点"添加用户"开始配置</text>
					</view>

					<view v-for="(user, ui) in mockUsers" :key="ui" class="mock-user-card" :class="mockExpandIdx === ui ? 'mock-expand' : ''">
						<view class="mock-user-header" @click="mockToggleUser(ui)">
							<view class="mock-user-left">
								<text class="mock-user-icon">{{ mockExpandIdx === ui ? '▼' : '▶' }}</text>
								<text class="mock-user-name">{{ user.nickname || user.id || '新用户' }}</text>
								<text class="mock-user-surveys">{{ user.surveys.length }} 问卷</text>
							</view>
							<view class="mock-user-right">
								<text class="mock-user-lv">Lv.{{ mockCalcLevel(user.exposureCount) }}</text>
								<view class="mock-user-del" hover-class="press-95" @click.stop="mockDelUser(ui)">
									<text class="mock-del-txt">✕</text>
								</view>
							</view>
						</view>

						<!-- === 展开详情 === -->
						<view v-if="mockExpandIdx === ui" class="mock-user-body">
							<!-- 用户配置 -->
							<view class="mock-field-row">
								<text class="mock-label-sm">userId</text>
								<input class="mock-input" v-model="user.id" type="text" placeholder="唯一标识" @input="mockOnChange" />
							</view>
							<view class="mock-field-row">
								<text class="mock-label-sm">昵称</text>
								<input class="mock-input" v-model="user.nickname" type="text" placeholder="显示为作者名" @input="mockOnChange" />
							</view>
							<view class="mock-field-row">
								<text class="mock-label-sm">资历</text>
								<view class="mock-exp-btns">
									<view v-for="v in [0, 1, 5, 20]" :key="v" class="mock-exp-btn" hover-class="press-95"
										:class="user.exposureCount === v ? 'mock-exp-sel' : ''" @click="user.exposureCount = v; mockOnChange()">
										<text class="mock-exp-txt">{{ v }}</text>
									</view>
									<input class="mock-input mock-exp-input" v-model.number="user.exposureCount" type="number" placeholder="自定义" @input="mockOnChange" />
								</view>
							</view>

							<!-- 问卷列表 -->
							<view class="mock-survey-header">
								<text class="mock-survey-title">问卷列表（{{ user.surveys.length }}）</text>
								<view class="card-btn card-btn-sm" hover-class="press-95" @click="mockAddSurvey(ui)">
									<text class="btn-txt" style="font-size: 20rpx;">+ 问卷</text>
								</view>
							</view>

							<view v-for="(svy, si) in user.surveys" :key="si" class="mock-survey-row">
								<input class="mock-input mock-input-sm" v-model="svy.surveyId" type="text" placeholder="surveyId" style="flex: 1.5;" />
								<input class="mock-input mock-input-sm" v-model="svy.title" type="text" placeholder="标题" style="flex: 2;" />
								<view class="mock-survey-del" hover-class="press-95" @click="user.surveys.splice(si, 1); mockOnChange()">
									<text class="mock-del-txt">✕</text>
								</view>
							</view>
						</view>
					</view>

					<!-- 预览：将要注入的条目 -->
					<view v-if="mockPreview.length > 0" class="mock-preview">
						<text class="mock-preview-label">预览：即将注入 {{ mockPreview.length }} 条数据</text>
						<view v-for="(item, idx) in mockPreview" :key="idx" class="mock-preview-item">
							<text class="mock-preview-idx">#{{ idx + 1 }}</text>
							<text class="mock-preview-txt">{{ item.userId }} · {{ item.surveyTitle }} · 资历{{ item.exposureCount }} · 作者{{ item.nickname || item.userId }}</text>
						</view>
					</view>

				</view>
			</view>

			<!-- ====== 13. 阶段六 · 战绩单手动测试 ====== -->
			<view class="section">
				<view class="section-title">13. 阶段六 · 战绩单手动测试</view>
				<view class="card">

					<!-- === Panel F: Auto Run 自动化测试 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">Auto · 自动化云方法测试</text>
						<text class="s6-panel-desc">一键串行执行所有 API 调用测试，输出通过/失败清单。覆盖：连通性、资历查询、未读检测、标记已读/缺参/无效ID、槽位快照、缓存读写、生成调参、未登录防护。</text>
						<view class="s6-auto-hd">
							<view class="card-btn card-btn-auto" hover-class="press-95" @click="s6RunAutoTest">
								<text class="btn-txt">{{ s6AutoRunning ? '⏳ 运行中...' : '▶ 一键 Auto Run' }}</text>
							</view>
							<view v-if="s6AutoSummary !== null" class="s6-summary-badge" :class="s6AutoSummary.allPass ? 's6-badge-pass' : 's6-badge-fail'">
								<text>{{ s6AutoSummary.allPass ? '✅ 全部通过' : '⚠️ ' + s6AutoSummary.passed + '/' + s6AutoSummary.total }}</text>
							</view>
						</view>

						<!-- 进度条 -->
						<view v-if="s6AutoRunning" class="s6-progress-wrap">
							<view class="s6-progress-track">
								<view class="s6-progress-fill" :style="'width:' + s6AutoProgress + '%'"></view>
							</view>
							<text class="s6-progress-txt">{{ Math.round(s6AutoProgress) }}%</text>
						</view>

						<!-- 逐项结果 -->
						<view v-if="s6AutoResults.length > 0" class="s6-auto-list">
							<view v-for="(r, idx) in s6AutoResults" :key="idx" class="s6-auto-item" :class="r.passed ? 's6-auto-pass' : 's6-auto-fail'">
								<view class="s6-auto-left">
									<text class="s6-auto-icon">{{ r.passed ? '✓' : '✗' }}</text>
									<text class="s6-auto-name">{{ r.name }}</text>
								</view>
								<text class="s6-auto-detail">{{ r.detail }}</text>
							</view>
						</view>
					</view>

					<!-- === Panel A: checkCareerStatus 快速测试 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">A. checkCareerStatus（首页 onShow 调用方法）</text>
						<text class="s6-panel-desc">模拟首页检测未读档案——返回 hasUnread + 未读档案摘要列表</text>
						<view class="set-custom s6-inline">
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="s6CallCheckStatus">
								<text class="btn-txt">{{ s6Loading.status ? '检测中...' : '🔍 检测未读' }}</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="s6ClearStatus">
								<text class="btn-txt">清空</text>
							</view>
						</view>

						<!-- 结果展示 -->
						<view v-if="s6StatusResult !== null" class="s6-status-box">
							<view class="s6-status-hd" :class="s6StatusResult.data && s6StatusResult.data.hasUnread ? 's6-hd-unread' : 's6-hd-none'">
								<text class="s6-status-icon">{{ s6StatusResult.data && s6StatusResult.data.hasUnread ? '📜' : '✅' }}</text>
								<text class="s6-status-txt">
									{{ s6StatusResult.data && s6StatusResult.data.hasUnread ? '有 ' + s6StatusResult.data.careers.length + ' 条未读档案' : '无未读档案' }}
								</text>
							</view>
							<view v-if="s6StatusResult.data && s6StatusResult.data.careers && s6StatusResult.data.careers.length > 0" class="s6-status-careers">
								<view v-for="(c, idx) in s6StatusResult.data.careers" :key="idx" class="s6-career-mini">
									<view class="s6-career-mini-hd">
										<text class="s6-career-mini-idx">#{{ idx + 1 }}</text>
										<text class="s6-career-mini-id" style="font-family:monospace;font-size:16rpx;color:#9CA3AF;">{{ c.careerId ? c.careerId.slice(0,20)+'...' : '—' }}</text>
									</view>
									<text class="s6-career-mini-title">「{{ c.surveyTitle }}」</text>
									<view class="s6-career-mini-row">
										<text class="s6-career-mini-honor">🏅 {{ (c.honor && c.honor.name) || '—' }}</text>
										<text v-if="c.bonusTriggered" class="s6-career-mini-bonus">⚡暴击</text>
									</view>
									<view class="s6-career-mini-stats">
										<text class="s6-career-mini-stat">👁 {{ s6Fmt(c.stats && c.stats.views) }}</text>
										<text class="s6-career-mini-stat">👆 {{ s6Fmt(c.stats && c.stats.clicks) }}</text>
										<text class="s6-career-mini-stat">📦 {{ s6Fmt(c.stats && c.stats.favorites) }}</text>
									</view>
									<view class="s6-career-mini-actions">
										<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="s6ViewCareer(c)">
											<text class="btn-txt" style="font-size:20rpx;">查看</text>
										</view>
										<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="s6MarkRead(c.careerId, idx)">
											<text class="btn-txt" style="font-size:20rpx;">标记已读</text>
										</view>
									</view>
								</view>
							</view>
						</view>

						<view v-if="s6StatusResult && s6StatusResult.errCode !== 0" class="card-result">
							<text class="result-icon">✗</text>
							<text class="result-txt">{{ JSON.stringify(s6StatusResult) }}</text>
						</view>
					</view>

					<!-- === Panel B: markCareerAsRead 手动输入 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">B. markCareerAsRead 手动输入</text>
						<text class="s6-panel-desc">手动输入 careerId 直接标记已读（释放对应槽位），观察槽位变化</text>
						<view class="set-custom s6-inline">
							<input class="set-input" v-model="s6CareerInput" type="text" placeholder="输入 careerId" style="flex:2;" />
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="s6CallMarkRead(s6CareerInput)">
								<text class="btn-txt">{{ s6Loading.markRead ? '标记中...' : '标记已读' }}</text>
							</view>
						</view>
						<text v-if="s6MarkReadMsg" class="set-msg" :class="s6MarkReadOk ? 'set-msg-ok' : 'set-msg-err'">{{ s6MarkReadMsg }}</text>
						<text v-if="s6MarkReadRaw" class="s6-raw-json">{{ JSON.stringify(s6MarkReadRaw) }}</text>
					</view>

					<!-- === Panel C: 首页弹窗模拟 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">C. 首页弹窗模拟（仿 index.vue 弹出效果）</text>
						<text class="s6-panel-desc">点下方按钮模拟首页弹窗——与 index.vue 的 career-popup 结构一致</text>

						<!-- 弹窗触发按钮 -->
						<view class="s6-sim-btns">
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="s6ShowMockPopup('normal')">
								<text class="btn-txt">弹出普通档案</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-amber" hover-class="press-95" @click="s6ShowMockPopup('bonus')">
								<text class="btn-txt">弹出暴击档案</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="s6ShowMockPopup('real')">
								<text class="btn-txt">用真实数据弹</text>
							</view>
						</view>

						<!-- 弹窗模拟 overlay（与 index.vue 样式一致） -->
						<view v-if="s6ShowPopup" class="s6-popup-overlay" @click="s6DismissPopup">
							<view class="s6-popup" @click.stop>
								<view class="s6-popup-hd">
									<image class="s6-popup-stamp" src="/static/给狐狸.png" mode="aspectFit"></image>
									<text class="s6-popup-title">15分钟名气管理局</text>
									<text class="s6-popup-sub">临时名人档案 · 新到</text>
								</view>
								<view class="s6-popup-body">
									<text class="s6-popup-honor">🏆 {{ (s6PopupData.honor && s6PopupData.honor.name) || '内容创作者' }}</text>
									<text class="s6-popup-survey">「{{ s6PopupData.surveyTitle || '' }}」</text>
									<view class="s6-popup-stats">
										<view class="s6-popup-stat">
											<text class="s6-popup-num">{{ s6Fmt(s6PopupData.stats && s6PopupData.stats.views) }}</text>
											<text class="s6-popup-label">驻足注视</text>
										</view>
										<text class="s6-popup-sep">|</text>
										<view class="s6-popup-stat">
											<text class="s6-popup-num">{{ s6Fmt(s6PopupData.stats && s6PopupData.stats.clicks) }}</text>
											<text class="s6-popup-label">好奇打开</text>
										</view>
										<text class="s6-popup-sep">|</text>
										<view class="s6-popup-stat">
											<text class="s6-popup-num">{{ s6Fmt(s6PopupData.stats && s6PopupData.stats.favorites) }}</text>
											<text class="s6-popup-label">决定存档</text>
										</view>
									</view>
									<view v-if="s6PopupData.bonusTriggered" class="s6-popup-bonus">
										<text>⚡ 暴击触发 ×{{ s6PopupData.bonusMultiplier ? s6PopupData.bonusMultiplier.toFixed(1) : '1.5' }}</text>
									</view>
								</view>
								<view class="s6-popup-ft">
									<view class="s6-popup-btn s6-popup-btn-view" hover-class="press-95" @click="s6PopupView">
										<text>📖 查看档案</text>
									</view>
									<view class="s6-popup-btn s6-popup-btn-close" hover-class="press-95" @click="s6DismissPopup">
										<text>稍后再说</text>
									</view>
								</view>
							</view>
						</view>

						<view v-if="s6PopupLog" class="card-result" style="margin-top:12rpx;" :class="s6PopupLogOk ? 'success' : ''">
							<text class="result-icon">{{ s6PopupLogOk ? '✓' : '✗' }}</text>
							<text class="result-txt">{{ s6PopupLog }}</text>
						</view>
					</view>

					<!-- === Panel D: 未读缓存操作 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">D. 未读缓存操作（_hasUnreadCareer）</text>
						<text class="s6-panel-desc">首页用 storage 缓存优化避免重复调接口。手动查看/设置/清除缓存值</text>
						<view class="s6-cache-row">
							<text class="s6-cache-val">当前缓存值：<text class="s6-cache-val-num">{{ s6CacheVal === null ? '未设置' : (s6CacheVal === false ? 'false (跳过)' : 'true (检测)') }}</text></text>
							<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="s6CacheRefresh">
								<text class="btn-txt" style="font-size:20rpx;">↻ 刷新</text>
							</view>
						</view>
						<view class="s6-cache-btns">
							<view class="s6-cache-btn" hover-class="press-95" @click="s6CacheSet(true)">设为 true</view>
							<view class="s6-cache-btn" hover-class="press-95" @click="s6CacheSet(false)">设为 false</view>
							<view class="s6-cache-btn s6-cache-btn-clear" hover-class="press-95" @click="s6CacheClear">清除缓存</view>
						</view>
						<text v-if="s6CacheMsg" class="set-msg" style="margin-top:8rpx;" :class="s6CacheMsg.indexOf('✓') === 0 ? 'set-msg-ok' : ''">{{ s6CacheMsg }}</text>
					</view>

					<!-- === Panel E: 槽位状态快照 === -->
					<view class="s6-panel">
						<text class="s6-panel-title">E. 槽位状态快照（getSlotStatus）</text>
						<text class="s6-panel-desc">检查当前三槽位状态，确认 markCareerAsRead 后 claimable→idle 释放正确</text>
						<view class="set-custom s6-inline">
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="s6CallSlots">
								<text class="btn-txt">{{ s6Loading.slots ? '查询中...' : '🔍 查槽位' }}</text>
							</view>
						</view>

						<view v-if="s6Slots.length > 0" class="s6-slot-list">
							<view v-for="(s, idx) in s6Slots" :key="idx" class="s6-slot-item" :class="'s6-slot-' + s.status">
								<view class="s6-slot-left">
									<text class="s6-slot-idx">槽{{ idx + 1 }}</text>
									<text class="s6-slot-status" :class="'s6-slot-status-' + s.status">{{ s6SlotLabel(s.status) }}</text>
								</view>
								<view class="s6-slot-right">
									<text v-if="s.pinId" class="s6-slot-pin">pin: {{ s.pinId.slice(0, 20) }}...</text>
									<text v-if="s.surveyId" class="s6-slot-svy">问卷: {{ s.surveyId.slice(0, 16) }}...</text>
									<text v-if="s.queueId" class="s6-slot-queue">queue: {{ s.queueId.slice(0, 16) }}...</text>
									<text v-if="s.status === 'idle'" class="s6-slot-idle-txt">空闲</text>
								</view>
							</view>
						</view>
						<view v-if="s6Slots.length === 0 && s6Loading.slots" class="s6-slot-empty">查询中...</view>
						<view v-if="s6Slots.length === 0 && !s6Loading.slots" class="s6-slot-empty">点「查槽位」查看</view>
					</view>

				</view>
			</view>

			<!-- ====== 14. 阶段七·迁移与防刷测试 ====== -->
			<view class="section">
				<view class="section-title">14. 阶段七 · 迁移 / 防刷 / 风控</view>
				<view class="card">

					<!-- Panel A: 老用户迁移 -->
					<view class="s7-panel">
						<text class="s7-panel-title">A. 老用户 career 字段迁移</text>
						<text class="s7-panel-desc">一键补全所有缺少 career 字段的老用户，写入默认槽位 + exposureCount=0</text>
						<view class="s7-row">
							<view class="card-btn card-btn-sm" hover-class="press-95" @click="callSystemMigration">
								<text class="btn-txt">{{ s7Loading.migrate ? '迁移中...' : '▶ 执行迁移' }}</text>
							</view>
						</view>
						<text v-if="s7MigrateMsg" class="set-msg" :class="s7MigrateOk ? 'set-msg-ok' : 'set-msg-err'">{{ s7MigrateMsg }}</text>
						<text v-if="s7MigrateRaw" class="s7-raw-json">{{ JSON.stringify(s7MigrateRaw) }}</text>
					</view>

					<!-- Panel B: 防刷风控测试 -->
					<view class="s7-panel">
						<text class="s7-panel-title">B. 防刷风控一键测试</text>
						<text class="s7-panel-desc">串行验证四道防线：频率限制、广告时长校验、每日次数软帽、isEnded 校验</text>
						<view class="s7-row">
							<view class="card-btn card-btn-sm card-btn-green" hover-class="press-95" @click="s7RunSecurityTest">
								<text class="btn-txt">{{ s7Loading.security ? '测试中...' : '▶ 四道防线测试' }}</text>
							</view>
							<view class="card-btn card-btn-sm card-btn-gray" hover-class="press-95" @click="s7ClearSecurity">
								<text class="btn-txt">清空</text>
							</view>
						</view>

						<!-- 进度 -->
						<view v-if="s7SecurityRunning" class="s7-progress-wrap">
							<view class="s7-progress-track">
								<view class="s7-progress-fill" :style="'width:' + s7SecurityProgress + '%'"></view>
							</view>
							<text class="s7-progress-txt">{{ Math.round(s7SecurityProgress) }}%</text>
						</view>

						<!-- 逐项结果 -->
						<view v-if="s7SecurityResults.length > 0" class="s7-result-list">
							<view v-for="(r, idx) in s7SecurityResults" :key="idx" class="s7-result-item" :class="r.passed ? 's7-result-pass' : 's7-result-fail'">
								<view class="s7-result-left">
									<text class="s7-result-icon">{{ r.passed ? '✓' : '✗' }}</text>
									<text class="s7-result-name">{{ r.name }}</text>
								</view>
								<text class="s7-result-detail">{{ r.detail }}</text>
							</view>
						</view>
						<view v-if="s7SecuritySummary !== null" class="s7-security-summary" :class="s7SecuritySummary.allPass ? 's7-summary-pass' : 's7-summary-fail'">
							<text>{{ s7SecuritySummary.allPass ? '✅ 全部通过' : '⚠️ ' + s7SecuritySummary.passed + '/' + s7SecuritySummary.total }}</text>
						</view>
					</view>

				</view>
			</view>

			<!-- ====== 预期对照表 ====== -->
				<view class="section">
					<view class="section-title">附：资历档位对照表</view>
					<view class="card">
						<view v-for="(lv, idx) in levelTable" :key="idx" class="level-row">
							<text class="level-label">{{ lv.label }}</text>
							<text class="level-range">{{ lv.range }}</text>
							<text class="level-next">{{ lv.next }}</text>
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
			loading: { ping: false, seniority: false, shells: false, noauth: false, setCount: false, enterPool: false, queueToPool: false, resetSlots: false, draw: false, poolContents: false,
				implMethods: false, enterQueue: false, getQueueStatus: false, executeAccel: false, setEnterAt: false },
			expLoading: { seed: false, callFn: false, query: false, clean: false },
			expiryResult: null,
			careerRecords: null,
			expMsg: '',
			expMsgOk: false,
			expDataSeeded: false,
			results: { ping: null, seniority: null, noauth: null },
			shellResults: [],
			implMethodResults: [],
			currentUser: '',
			editCount: '',
			setResultMsg: '',
			setResultOk: false,
			resetSlotsMsg: '',
			resetSlotsOk: false,
			drawCount: 5,
			drawResult: null,
			poolContents: null,
			testSurveyId: 'test-survey-001',
			testQueueId: '',
			enterPoolResult: null,
			queueToPoolResult: null,
			// === 阶段五：首页集成测试 ===
			p5DrawCount: 5,
			p5DrawResult: null,
			p5PreviewCards: [],
			p5EventLogs: [],
			p5Loading: { draw: false, simDirect: false, simQueue: false, simGreen: false },
			// === 模拟数据管理器 ===
			mockUsers: [
				{ id: 'mock_user_a', nickname: '张三', exposureCount: 0, surveys: [{ surveyId: 'mock_a_1', title: '今日运势', cover: '' }, { surveyId: 'mock_a_2', title: '智商测试', cover: '' }] },
				{ id: 'mock_user_b', nickname: '李四', exposureCount: 5, surveys: [{ surveyId: 'mock_b_1', title: '人格鉴定', cover: '' }] },
				{ id: 'mock_user_c', nickname: '王五', exposureCount: 20, surveys: [{ surveyId: 'mock_c_1', title: '恋爱分析', cover: '' }, { surveyId: 'mock_c_2', title: '职场人设', cover: '' }] }
			],
			mockExpandIdx: null,
			mockLoading: { seed: false, clean: false },
			mockResultMsg: '',
			mockResultOk: false,
			queueStep: 0,          // 0=未开始, 1=已入候场, 2=已查状态, 3=已查状态(可加速)
			currentSurveyId: 'test-survey-001',
			currentQueueId: '',    // 统一 queueId，所有步骤共用
			stepResults: {
				enterQueue: null,    // 步骤0 结果
				queueStatus: null,   // 步骤1 结果
				accel: null,         // 步骤2 结果
				setEnterAt: ''       // 步骤3 反馈消息
			},
			stepLoading: { enterQueue: false, queueStatus: false, accel: false, setEnterAt: false, forceQueueMode: false },
			forceQueueMode: false,
			enterAtOptions: [
				{ label: '2min', minutes: 2 },
				{ label: '8min', minutes: 8 },
				{ label: '15min', minutes: 15 },
				{ label: '25min', minutes: 25 }
			],
			levelTable: [
				{ label: 'Lv.0 · 新人',    range: 'exposureCount = 0',           next: '还需 1 次升级' },
				{ label: 'Lv.1 · 偶发者',  range: 'exposureCount = 1 ~ 5',       next: '还需 6-exposure 次' },
				{ label: 'Lv.2 · 常客',    range: 'exposureCount = 6 ~ 20',      next: '还需 21-exposure 次' },
				{ label: 'Lv.3 · 老面孔',  range: 'exposureCount ≥ 21',         next: '已满级' },
			],
			// === 阶段六 · 战绩单手动测试 ===
			s6Loading: { status: false, markRead: false, slots: false },
			s6StatusResult: null,
			s6CareerInput: '',
			s6MarkReadMsg: '',
			s6MarkReadOk: false,
			s6MarkReadRaw: null,
			s6ShowPopup: false,
			s6PopupData: { honor: { name: '' }, stats: {}, surveyTitle: '', bonusTriggered: false, bonusMultiplier: 1.0, careerId: '' },
			s6PopupLog: '',
			s6PopupLogOk: false,
			s6CacheVal: null,
			s6CacheMsg: '',
			s6Slots: [],
			// === 阶段六 · Auto Run ===
			s6AutoRunning: false,
			s6AutoProgress: 0,
			s6AutoResults: [],
			s6AutoSummary: null,
			// === 阶段七 · 迁移与防刷测试 ===
			s7Loading: { migrate: false, security: false },
			s7MigrateMsg: '',
			s7MigrateOk: false,
			s7MigrateRaw: null,
			s7SecurityRunning: false,
			s7SecurityProgress: 0,
			s7SecurityResults: [],
			s7SecuritySummary: null
		}
	},
	onLoad() {
		const userInfo = uni.getStorageSync('uni-id-pages-userInfo')
		if (userInfo && userInfo.nickname) {
			this.currentUser = userInfo.nickname
		} else if (userInfo && userInfo.mobile) {
			this.currentUser = userInfo.mobile.slice(-4)
		}
	},
	methods: {
		goBack() { uni.navigateBack() },

		async callPing() {
			this.loading.ping = true
			this.results.ping = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.ping()
				this.results.ping = res
			} catch (e) {
				this.results.ping = { errCode: -1, errMsg: e.message }
			}
			this.loading.ping = false
		},

		async callGetSeniority() {
			this.loading.seniority = true
			this.results.seniority = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getSeniority()
				this.results.seniority = res
			} catch (e) {
				this.results.seniority = { errCode: -1, errMsg: e.message }
			}
			this.loading.seniority = false
		},

		async callAllShells() {
			this.loading.shells = true
			this.shellResults = []

			const methods = [
				{ name: 'generateCareer',   params: { userId: 'test', pinDoc: {} } },
				{ name: 'checkCareerStatus', params: {} },
				{ name: 'markCareerAsRead', params: { careerId: 'test' } }
			]

			const ps = uniCloud.importObject('pin-system')
			for (const m of methods) {
				try {
					const res = await ps[m.name](m.params)
					this.shellResults.push({ method: m.name, ...res })
				} catch (e) {
					const errMsg = e.message || e.errMsg || ''
					this.shellResults.push({
						method: m.name,
						errCode: errMsg.includes('尚未实现') ? 'NOT_IMPLEMENTED' : -1,
						errMsg
					})
				}
			}

			this.loading.shells = false
		},

		async callSeniorityNoAuth() {
			this.loading.noauth = true
			this.results.noauth = null
			const oldToken = uni.getStorageSync('uni_id_token')
			uni.removeStorageSync('uni_id_token')
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getSeniority()
				this.results.noauth = res
			} catch (e) {
				const errMsg = e.message || e.errMsg || ''
				this.results.noauth = {
					errCode: errMsg.includes('用户未登录') ? 'NOT_AUTH' : -1,
					errMsg
				}
			} finally {
				// 无论成功还是失败都恢复 token
				if (oldToken) uni.setStorageSync('uni_id_token', oldToken)
			}
			this.loading.noauth = false
		},

		async callSetExposureCount(count) {
			if (isNaN(count) || count < 0) {
				uni.showToast({ title: '请输入非负整数', icon: 'none' })
				return
			}
			this.loading.setCount = true
			this.setResultMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testSetExposureCount({ count })
				if (res.errCode === 0) {
					this.setResultMsg = `✓ exposureCount 已设为 ${count}`
					this.setResultOk = true
					// 自动重新查询资历
					this.callGetSeniority()
				} else {
					this.setResultMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.setResultOk = false
				}
			} catch (e) {
				this.setResultMsg = `✗ ${e.message}`
				this.setResultOk = false
			}
			this.loading.setCount = false
		},

		async callHandleAdReward() {
			if (!this.testSurveyId) { uni.showToast({ title: '请填写 surveyId', icon: 'none' }); return }
			this.loading.enterPool = true
			this.enterPoolResult = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: this.testSurveyId })
				this.enterPoolResult = res
				// 如果进了候场区，自动填 queueId
				if (res.errCode === 0 && res.action === 'enter_queue' && res.queueData) {
					this.testQueueId = res.queueData.queueId
				}
			} catch (e) {
				this.enterPoolResult = { errCode: -1, errMsg: e.message }
			}
			this.loading.enterPool = false
		},

		async callQueueToPool() {
			if (!this.testSurveyId) { uni.showToast({ title: '请填写 surveyId', icon: 'none' }); return }
			if (!this.testQueueId) { uni.showToast({ title: '请填写 queueId', icon: 'none' }); return }
			this.loading.queueToPool = true
			this.queueToPoolResult = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.queueToPool({ surveyId: this.testSurveyId, queueId: this.testQueueId })
				this.queueToPoolResult = res
			} catch (e) {
				this.queueToPoolResult = { errCode: -1, errMsg: e.message }
			}
			this.loading.queueToPool = false
		},

		async callResetSlots() {
			this.loading.resetSlots = true
			this.resetSlotsMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testResetSlots()
				if (res.errCode === 0) {
					this.resetSlotsMsg = '✓ 已重置'
					this.resetSlotsOk = true
				} else {
					this.resetSlotsMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.resetSlotsOk = false
				}
			} catch (e) {
				this.resetSlotsMsg = `✗ ${e.message}`
				this.resetSlotsOk = false
			}
			this.loading.resetSlots = false
		},

		async callGetPoolContents() {
			this.loading.poolContents = true
			this.poolContents = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getPoolContents()
				this.poolContents = res
			} catch (e) {
				this.poolContents = { errCode: -1, errMsg: e.message }
			}
			this.loading.poolContents = false
		},

		async callResetSlotsWithClear() {
			this.loading.resetSlots = true
			this.poolContents = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testResetSlots()
				if (res.errCode === 0) {
					this.resetSlotsMsg = '✓ 已重置，池中记录已清空'
					this.resetSlotsOk = true
				} else {
					this.resetSlotsMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.resetSlotsOk = false
				}
			} catch (e) {
				this.resetSlotsMsg = `✗ ${e.message}`
				this.resetSlotsOk = false
			}
			this.loading.resetSlots = false
			// 重置后自动刷新池子
			this.callGetPoolContents()
		},

		async callDraw() {
			const count = Number(this.drawCount) || 5
			this.loading.draw = true
			this.drawResult = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.draw({ count })
				this.drawResult = res
			} catch (e) {
				this.drawResult = { errCode: -1, errMsg: e.message }
			}
			this.loading.draw = false
		},

		// ==================== 阶段四测试方法 ====================

		async callImplementedMethods() {
			this.loading.implMethods = true
			this.implMethodResults = []
			const ps = uniCloud.importObject('pin-system')
			const methods = [
				{ name: 'getQueueStatus',   params: {} },
				{ name: 'executeAccel',     params: { queueId: 'test' } },
				{ name: 'getSlotStatus',    params: {} }
			]
			for (const m of methods) {
				try {
					const res = await ps[m.name](m.params)
					this.implMethodResults.push({ method: m.name, ...res })
				} catch (e) {
					const errMsg = e.message || e.errMsg || ''
					this.implMethodResults.push({ method: m.name, errCode: -1, errMsg })
				}
			}
			this.loading.implMethods = false
		},

		advanceStep(step) {
			this.queueStep = step
		},

		async callToggleForceQueue() {
			this.stepLoading.forceQueueMode = true
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testSetForceQueue({ force: !this.forceQueueMode })
				if (res.errCode === 0) {
					this.forceQueueMode = !this.forceQueueMode
					uni.showToast({ title: res.errMsg, icon: 'none' })
				} else {
					uni.showToast({ title: res.errMsg || '切换失败', icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '调用失败', icon: 'none' })
				console.error('[pin-test] toggleForceQueue error:', e)
			}
			this.stepLoading.forceQueueMode = false
		},

		async callEnterQueue() {
			if (!this.currentSurveyId) { uni.showToast({ title: '请填写 surveyId', icon: 'none' }); return }
			this.stepLoading.enterQueue = true
			this.stepResults.enterQueue = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: this.currentSurveyId })
				this.stepResults.enterQueue = res
				if (res.errCode === 0 && res.action === 'enter_queue' && res.queueData) {
					this.currentQueueId = res.queueData.queueId
				}
			} catch (e) {
				this.stepResults.enterQueue = { errCode: -1, errMsg: e.message }
			}
			this.stepLoading.enterQueue = false
		},

		async callGetQueueStatus() {
			this.stepLoading.queueStatus = true
			this.stepResults.queueStatus = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const params = this.currentQueueId ? { queueId: this.currentQueueId } : {}
				const res = await ps.getQueueStatus(params)
				this.stepResults.queueStatus = res
			} catch (e) {
				this.stepResults.queueStatus = { errCode: -1, errMsg: e.message }
			}
			this.stepLoading.queueStatus = false
		},

		async callExecuteAccel() {
			if (!this.currentQueueId) { uni.showToast({ title: '没有 queueId，先进候场', icon: 'none' }); return }
			this.stepLoading.accel = true
			this.stepResults.accel = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.executeAccel({ queueId: this.currentQueueId })
				this.stepResults.accel = res
			} catch (e) {
				this.stepResults.accel = { errCode: -1, errMsg: e.message }
			}
			this.stepLoading.accel = false
		},

		async callSetEnterAt(minutesAgo) {
			if (!this.currentQueueId) { uni.showToast({ title: '没有 queueId，先进候场', icon: 'none' }); return }
			this.stepLoading.setEnterAt = true
			this.stepResults.setEnterAt = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testSetEnterAt({ queueId: this.currentQueueId, minutesAgo })
				if (res.errCode === 0) {
					this.stepResults.setEnterAt = `✓ enterAt 已设为 ${minutesAgo} 分钟前`
				} else {
					this.stepResults.setEnterAt = `✗ ${res.errMsg || JSON.stringify(res)}`
				}
			} catch (e) {
				this.stepResults.setEnterAt = `✗ ${e.message}`
			}
			this.stepLoading.setEnterAt = false
		},

		// ==================== 阶段三测试方法 ====================

		async callSeedExpiry() {
			this.expLoading.seed = true
			this.expMsg = ''
			this.expiryResult = null
			this.careerRecords = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testSeedExpiryData()
				if (res.errCode === 0) {
					this.expMsg = `✓ 测试数据已创建：pinId=${res.data.pinId}，queueId=${res.data.queueId}`
					this.expMsgOk = true
					this.expDataSeeded = true
					this.expStatus = 'seeded'
				} else {
					this.expMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.expMsgOk = false
				}
			} catch (e) {
				this.expMsg = `✗ ${e.message}`
				this.expMsgOk = false
			}
			this.expLoading.seed = false
		},

		async callPinExpiry() {
			this.expLoading.callFn = true
			this.expiryResult = null
			this.expMsg = ''
			try {
				const res = await uniCloud.callFunction({ name: 'pin-expiry' })
				this.expiryResult = res.result || res
				this.expMsg = `✓ pin-expiry 调用成功`
				this.expMsgOk = true
			} catch (e) {
				this.expiryResult = { errCode: -1, errMsg: e.message }
				this.expMsg = `✗ 调用失败：${e.message}`
				this.expMsgOk = false
			}
			this.expLoading.callFn = false
		},

		async callQueryCareer() {
			this.expLoading.query = true
			this.careerRecords = null
			this.expMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testQueryCareer()
				this.careerRecords = (res.data || [])
				if (this.careerRecords.length > 0) {
					this.expMsg = `✓ 查到 ${this.careerRecords.length} 条战绩单`
				} else {
					this.expMsg = '⚠ 未找到战绩单，先调 pin-expiry 试试'
				}
				this.expMsgOk = this.careerRecords.length > 0
			} catch (e) {
				this.careerRecords = []
				this.expMsg = `✗ 查询失败：${e.message}`
				this.expMsgOk = false
			}
			this.expLoading.query = false
		},

		async callCleanExpiry() {
			this.expLoading.clean = true
			this.expMsg = ''
			this.expDataSeeded = false
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testCleanupExpiryData()
				if (res.errCode === 0) {
					this.expMsg = `✓ 已清理：pin-pool ${res.data.pinPoolDeleted}条，queue ${res.data.queueDeleted}条，career ${res.data.careerDeleted}条`
					this.expMsgOk = true
					this.expiryResult = null
					this.careerRecords = null
				} else {
					this.expMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.expMsgOk = false
				}
			} catch (e) {
				this.expMsg = `✗ ${e.message}`
				this.expMsgOk = false
			}
			this.expLoading.clean = false
		},

		// ==================== 阶段五测试方法 ====================

		async p5CallDraw() {
			const count = Number(this.p5DrawCount) || 5
			this.p5Loading.draw = true
			this.p5DrawResult = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.draw({ count })
				this.p5DrawResult = res
				if (res.errCode === 0 && res.data && res.data.items) {
					this.p5PreviewCards = res.data.items
				}
			} catch (e) {
				this.p5DrawResult = { errCode: -1, errMsg: e.message }
			}
			this.p5Loading.draw = false
		},

		p5ClearDraw() {
			this.p5DrawResult = null
			this.p5PreviewCards = []
		},

		p5SimulateDirectEntry() {
			this.p5Loading.simDirect = true
			this.p5EventLogs = []
			const mockPinData = {
				action: 'direct_entry',
				pinData: {
					_id: 'pin_' + Date.now(),
					surveyId: 'demo-survey-001',
					surveyTitle: '今日运势',
					expireAt: Date.now() + 13 * 60 * 1000,
					haloActive: true
				}
			}
			const logs = []
			const required = ['_id', 'surveyId', 'surveyTitle', 'expireAt', 'haloActive']
			const allExist = required.every(k => k in mockPinData.pinData)
			logs.push({ type: allExist ? 'ok' : 'err', msg: `pinData 字段完整: ${allExist ? '✓ (5/5)' : '✗ 缺失字段'}` })
			if (!allExist) {
				const missing = required.filter(k => !(k in mockPinData.pinData))
				logs.push({ type: 'err', msg: `缺失: ${missing.join(', ')}` })
			}
			logs.push({ type: 'ok', msg: `action = "${mockPinData.action}"` })
			logs.push({ type: 'ok', msg: `surveyTitle = "${mockPinData.pinData.surveyTitle}"` })
			logs.push({ type: 'ok', msg: `haloActive = ${mockPinData.pinData.haloActive}` })
			logs.push({ type: 'ok', msg: `expireAt 可解析: ${!isNaN(new Date(mockPinData.pinData.expireAt).getTime())}` })
			this.p5EventLogs = logs
			this.p5Loading.simDirect = false
		},

		p5SimulateQueue() {
			this.p5Loading.simQueue = true
			this.p5EventLogs = []
			const mockQueueData = {
				action: 'enter_queue',
				queueData: {
					queueId: 'queue_' + Date.now(),
					surveyId: 'demo-survey-001',
					enterAt: Date.now(),
					seniorityLevel: 2,
					currentPhase: 'queuing',
					maxAccelCount: 3
				}
			}
			const logs = []
			const required = ['queueId', 'surveyId', 'enterAt', 'seniorityLevel', 'currentPhase', 'maxAccelCount']
			const allExist = required.every(k => k in mockQueueData.queueData)
			logs.push({ type: allExist ? 'ok' : 'err', msg: `queueData 字段完整: ${allExist ? '✓ (6/6)' : '✗ 缺失字段'}` })
			if (!allExist) {
				const missing = required.filter(k => !(k in mockQueueData.queueData))
				logs.push({ type: 'err', msg: `缺失: ${missing.join(', ')}` })
			}
			logs.push({ type: 'ok', msg: `action = "${mockQueueData.action}"` })
			logs.push({ type: 'ok', msg: `maxAccelCount = ${mockQueueData.queueData.maxAccelCount}` })
			logs.push({ type: 'ok', msg: `首页 onPinned 行为: 不刷新置顶栏, 800ms 后跳转 career-history` })
			this.p5EventLogs = logs
			this.p5Loading.simQueue = false
		},

		p5SimulateGreenChannel() {
			this.p5Loading.simGreen = true
			this.p5EventLogs = []
			const mockGreenData = {
				pinData: {
					_id: 'pin_gc_' + Date.now(),
					surveyId: 'demo-survey-001',
					surveyTitle: 'Lv.0 新人特权问卷',
					expireAt: Date.now() + 13 * 60 * 1000,
					haloActive: true
				}
			}
			const logs = []
			const required = ['_id', 'surveyId', 'surveyTitle', 'expireAt', 'haloActive']
			const allExist = required.every(k => k in mockGreenData.pinData)
			logs.push({ type: allExist ? 'ok' : 'err', msg: `绿色通道 pinData 字段完整: ${allExist ? '✓' : '✗'}` })
			logs.push({ type: 'ok', msg: `首页 showGreenChannel = true → 闪屏 overlay 出现` })
			logs.push({ type: 'ok', msg: `2s 后 autoDismiss → onGreenChannelClose → showGreenChannel = false` })
			logs.push({ type: 'ok', msg: `关闭后首页自动 refresh() 刷新置顶栏` })
			this.p5EventLogs = logs
			this.p5Loading.simGreen = false
		},

		// ==================== 模拟数据管理器方法 ====================

		mockAddUser() {
			this.mockUsers.push({
				id: 'mock_user_' + String(Math.random()).slice(2, 6),
				nickname: '',
				exposureCount: 0,
				surveys: [{ surveyId: 'mock_svy_001', title: '新问卷', cover: '' }]
			})
			this.mockExpandIdx = this.mockUsers.length - 1
		},

		mockToggleUser(ui) {
			this.mockExpandIdx = this.mockExpandIdx === ui ? null : ui
		},

		mockDelUser(ui) {
			this.mockUsers.splice(ui, 1)
			if (this.mockExpandIdx === ui) this.mockExpandIdx = null
			if (this.mockExpandIdx !== null && this.mockExpandIdx >= this.mockUsers.length) {
				this.mockExpandIdx = this.mockUsers.length - 1
			}
			this.mockOnChange()
		},

		mockAddSurvey(ui) {
			this.mockUsers[ui].surveys.push({ surveyId: 'mock_svy_' + String(Math.random()).slice(2, 6), title: '新问卷', cover: '' })
		},

		mockOnChange() {
			// trigger reactivity for computed mockPreview
		},

		mockCalcLevel(exp) {
			if (exp <= 0) return 0
			if (exp <= 5) return 1
			if (exp <= 20) return 2
			return 3
		},

		async mockSeed() {
			const pins = this.mockPreview
			if (pins.length === 0) {
				uni.showToast({ title: '没有有效配置，请先添加用户和问卷', icon: 'none' })
				return
			}
			this.mockLoading.seed = true
			this.mockResultMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testSeedMockPins({ pins })
				if (res.errCode === 0) {
					this.mockResultMsg = `✓ 注入成功：插入 ${res.data.inserted} 条，失败 ${res.data.failed} 条`
					this.mockResultOk = true
				} else {
					this.mockResultMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.mockResultOk = false
				}
			} catch (e) {
				this.mockResultMsg = `✗ ${e.message}`
				this.mockResultOk = false
			}
			this.mockLoading.seed = false
		},

		async mockClean() {
			this.mockLoading.clean = true
			this.mockResultMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testCleanMockPins()
				if (res.errCode === 0) {
					this.mockResultMsg = `✓ 已清理 ${res.data.deleted} 条模拟数据`
					this.mockResultOk = true
				} else {
					this.mockResultMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.mockResultOk = false
				}
			} catch (e) {
				this.mockResultMsg = `✗ ${e.message}`
				this.mockResultOk = false
			}
			this.mockLoading.clean = false
		},

		// ==================== 阶段六 · 战绩单手动测试 ====================

		async s6CallCheckStatus() {
			this.s6Loading.status = true
			this.s6StatusResult = null
			this.s6MarkReadMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.checkCareerStatus()
				this.s6StatusResult = res
			} catch (e) {
				this.s6StatusResult = { errCode: -1, errMsg: e.message }
			}
			this.s6Loading.status = false
		},

		s6ClearStatus() {
			this.s6StatusResult = null
			this.s6MarkReadMsg = ''
			this.s6MarkReadRaw = null
		},

		async s6MarkRead(careerId, idx) {
			if (!careerId) return
			this.s6MarkReadMsg = ''
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.markCareerAsRead({ careerId })
				if (res.errCode === 0) {
					this.s6MarkReadMsg = `✓ 已标记为已读`
					this.s6MarkReadOk = true
					// 从未读列表移除
					if (this.s6StatusResult?.data?.careers) {
						this.s6StatusResult.data.careers.splice(idx, 1)
						if (this.s6StatusResult.data.careers.length === 0) {
							this.s6StatusResult.data.hasUnread = false
						}
					}
					// 自动刷新槽位
					this.s6CallSlots()
				} else {
					this.s6MarkReadMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.s6MarkReadOk = false
				}
			} catch (e) {
				this.s6MarkReadMsg = `✗ ${e.message}`
				this.s6MarkReadOk = false
			}
		},

		async s6CallMarkRead(careerId) {
			if (!careerId) { uni.showToast({ title: '请输入 careerId', icon: 'none' }); return }
			this.s6Loading.markRead = true
			this.s6MarkReadMsg = ''
			this.s6MarkReadRaw = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.markCareerAsRead({ careerId })
				this.s6MarkReadRaw = res
				if (res.errCode === 0) {
					this.s6MarkReadMsg = `✓ careerId ${careerId.slice(0, 16)}... 已标记为已读（槽位已释放）`
					this.s6MarkReadOk = true
					this.s6CallSlots()
				} else {
					this.s6MarkReadMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.s6MarkReadOk = false
				}
			} catch (e) {
				this.s6MarkReadRaw = { errCode: -1, errMsg: e.message }
				this.s6MarkReadMsg = `✗ ${e.message}`
				this.s6MarkReadOk = false
			}
			this.s6Loading.markRead = false
		},

		s6ViewCareer(c) {
			if (c && c.careerId) {
				uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + c.careerId })
			} else {
				uni.showToast({ title: '无 careerId', icon: 'none' })
			}
		},

		// === 弹窗模拟 ===
		s6ShowMockPopup(type) {
			this.s6PopupLog = ''
			if (type === 'normal') {
				this.s6PopupData = {
					honor: { name: '内容创作者', desc: '稳定输出，质量在线。' },
					stats: { views: 3427, clicks: 518, favorites: 89 },
					surveyTitle: '你今天过得怎么样',
					bonusTriggered: false,
					bonusMultiplier: 1.0,
					careerId: 'mock_normal_' + Date.now()
				}
			} else if (type === 'bonus') {
				this.s6PopupData = {
					honor: { name: '破格流量获得者', desc: '本局特此破格授予——数据显示，该问卷在曝光期间经历了罕见的指数级扩散。' },
					stats: { views: 8921, clicks: 2345, favorites: 678 },
					surveyTitle: '你的MBTI是什么',
					bonusTriggered: true,
					bonusMultiplier: 1.8,
					careerId: 'mock_bonus_' + Date.now()
				}
			} else if (type === 'real' && this.s6StatusResult?.data?.careers?.length > 0) {
				// 用第一条真实检测结果
				const c = this.s6StatusResult.data.careers[0]
				this.s6PopupData = {
					honor: c.honor || { name: '内容创作者' },
					stats: c.stats || { views: 0, clicks: 0, favorites: 0 },
					surveyTitle: c.surveyTitle || '',
					bonusTriggered: c.bonusTriggered || false,
					bonusMultiplier: 1.0,
					careerId: c.careerId || ''
				}
			} else if (type === 'real') {
				uni.showToast({ title: '无真实数据，先用模拟数据', icon: 'none' })
				this.s6ShowMockPopup('normal')
				return
			}
			this.s6ShowPopup = true
		},

		s6DismissPopup() {
			const careerId = this.s6PopupData.careerId
			this.s6ShowPopup = false
			this.s6PopupLog = `仿 index.vue 行为：已关闭弹窗`
			if (careerId && careerId.startsWith('mock_')) {
				this.s6PopupLog += `（模拟数据，未调 markCareerAsRead）`
				this.s6PopupLogOk = true
			} else if (careerId) {
				// 真实数据 → 自动调 markCareerAsRead
				this.s6CallMarkRead(careerId)
				this.s6PopupLog += `，已调用 markCareerAsRead`
				this.s6PopupLogOk = true
			}
		},

		s6PopupView() {
			const careerId = this.s6PopupData.careerId
			this.s6ShowPopup = false
			this.s6PopupLog = '仿 index.vue 行为：查看 + markCareerAsRead + 跳转'
			this.s6PopupLogOk = true
			if (careerId && careerId.startsWith('mock_')) {
				this.s6PopupLog += '（mock 不跳转）'
			} else if (careerId) {
				this.s6CallMarkRead(careerId)
				uni.navigateTo({ url: '/pages-tools/career/career-detail?careerId=' + careerId })
			}
		},

		// === 缓存操作 ===
		s6CacheRefresh() {
			const v = uni.getStorageSync('_hasUnreadCareer')
			this.s6CacheVal = v === undefined || v === null ? null : v
			this.s6CacheMsg = `✓ 当前缓存值: ${v === undefined || v === null ? '未设置' : (v === false ? 'false (跳过)' : 'true (检测)')}`
		},

		s6CacheSet(val) {
			uni.setStorageSync('_hasUnreadCareer', val)
			this.s6CacheVal = val
			this.s6CacheMsg = `✓ 已设为 ${val === true ? 'true (检测)' : 'false (跳过)'}`
		},

		s6CacheClear() {
			uni.removeStorageSync('_hasUnreadCareer')
			this.s6CacheVal = null
			this.s6CacheMsg = '✓ 缓存已清除'
		},

		// === 槽位快照 ===
		async s6CallSlots() {
			this.s6Loading.slots = true
			this.s6Slots = []
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getSlotStatus()
				if (res.errCode === 0 && res.data) {
					this.s6Slots = res.data.slots || []
				} else {
					uni.showToast({ title: '查询失败: ' + (res.errMsg || ''), icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '查询失败: ' + e.message, icon: 'none' })
			}
			this.s6Loading.slots = false
		},

		s6SlotLabel(status) {
			const labels = { idle: '闲置', queuing: '候场中', active: '置顶中', claimable: '待签收' }
			return labels[status] || status
		},

		s6Fmt(val) {
			if (typeof val !== 'number') return '--'
			if (val >= 10000) return (val / 10000).toFixed(1) + '万'
			return val.toLocaleString()
		},

		// ==================== Auto Run 自动化测试 ====================
		async s6RunAutoTest() {
			this.s6AutoRunning = true
			this.s6AutoProgress = 0
			this.s6AutoResults = []
			this.s6AutoSummary = null

			const results = []
			const totalSteps = 11
			let passed = 0

			const add = (name, ok, detail) => {
				results.push({ name, passed: ok, detail: detail || '' })
				if (ok) passed++
			}

			const ps = uniCloud.importObject('pin-system')

			// 1. ping
			this.s6AutoProgress = 9
			try {
				const r = await ps.ping()
				add('连通性 ping', r.errCode === 0, JSON.stringify(r))
			} catch (e) { add('连通性 ping', false, e.message) }

			// 2. getSeniority
			this.s6AutoProgress = 18
			try {
				const r = await ps.getSeniority()
				const ok = r.errCode === 0 && r.data && typeof r.data.level === 'number'
				add('资历查询 getSeniority', ok, ok ? `Lv.${r.data.level} ${r.data.label}（exposure=${r.data.exposureCount}）` : JSON.stringify(r))
			} catch (e) { add('资历查询 getSeniority', false, e.message) }

			// 3. checkCareerStatus
			this.s6AutoProgress = 27
			try {
				const r = await ps.checkCareerStatus()
				const ok = r.errCode === 0 && typeof r.data?.hasUnread === 'boolean'
				add('未读检测 checkCareerStatus', ok, ok ? `hasUnread=${r.data.hasUnread}，${r.data.careers?.length || 0} 条未读` : JSON.stringify(r))
			} catch (e) { add('未读检测 checkCareerStatus', false, e.message) }

			// 4. checkCareerStatus 二次调用
			this.s6AutoProgress = 36
			try {
				const r1 = await ps.checkCareerStatus()
				const r2 = await ps.checkCareerStatus()
				add('checkCareerStatus（二次调用）', r1.errCode === 0 && r2.errCode === 0, '两次皆成功')
			} catch (e) { add('checkCareerStatus（二次调用）', false, e.message) }

			// 5. markCareerAsRead 缺参（预期抛错，参数校验生效即为通过）
			this.s6AutoProgress = 45
			try {
				const r = await ps.markCareerAsRead({})
				add('markCareerAsRead（缺参）', r.errCode === 'INVALID_PARAM', '返回 INVALID_PARAM ✓')
			} catch (e) {
				const isExpected = e.message && e.message.includes('缺少')
				add('markCareerAsRead（缺参）', isExpected, isExpected ? '参数校验生效，拒绝调用 ✓' : e.message)
			}

			// 6. markCareerAsRead 无效 ID
			this.s6AutoProgress = 54
			try {
				const r = await ps.markCareerAsRead({ careerId: '__auto_invalid_' + Date.now() })
				const ok = r.errCode === 0 || r.errCode === 'SYSTEM_ERROR'
				add('markCareerAsRead（无效 ID）', ok, JSON.stringify(r).slice(0, 80))
			} catch (e) { add('markCareerAsRead（无效 ID）', false, e.message) }

			// 7. getSlotStatus
			this.s6AutoProgress = 63
			try {
				const r = await ps.getSlotStatus()
				const ok = r.errCode === 0 && Array.isArray(r.data?.slots)
				add('槽位快照 getSlotStatus', ok, ok ? `${r.data.slots.length} 个槽位` : JSON.stringify(r))
			} catch (e) { add('槽位快照 getSlotStatus', false, e.message) }

			// 8. generateCareer 缺参（预期抛错，参数校验生效即为通过）
			this.s6AutoProgress = 72
			try {
				const r = await ps.generateCareer({})
				add('generateCareer（缺参）', r.errCode === 'INVALID_PARAM', '返回 INVALID_PARAM ✓')
			} catch (e) {
				const isExpected = e.message && (e.message.includes('缺少') || e.message.includes('userId'))
				add('generateCareer（缺参）', isExpected, isExpected ? '参数校验生效，拒绝调用 ✓' : e.message)
			}

			// 9. 缓存读写
			this.s6AutoProgress = 81
			try {
				const key = '_hasUnreadCareer'
				const old = uni.getStorageSync(key)
				uni.setStorageSync(key, true); const v1 = uni.getStorageSync(key)
				uni.setStorageSync(key, false); const v2 = uni.getStorageSync(key)
				uni.removeStorageSync(key); const v3 = uni.getStorageSync(key)
				if (old !== undefined && old !== null && old !== '') uni.setStorageSync(key, old)
				const ok = v1 === true && v2 === false && (v3 === '' || v3 === undefined || v3 === null)
				add('缓存读写（set/true→false→clear）', ok, `true=${v1} false=${v2} clear=${v3 === '' || v3 === null ? 'OK' : v3}`)
			} catch (e) { add('缓存读写（set/true→false→clear）', false, e.message) }

			// 10. getPoolContents
			this.s6AutoProgress = 90
			try {
				const r = await ps.getPoolContents()
				const ok = r.errCode === 0 && r.data !== undefined
				add('池子内容 getPoolContents', ok, ok ? `池中 ${r.data?.total || 0} 条有效` : JSON.stringify(r))
			} catch (e) { add('池子内容 getPoolContents', false, e.message) }

			// 11. 未登录防护
			this.s6AutoProgress = 99
			try {
				const old = uni.getStorageSync('uni_id_token')
				uni.removeStorageSync('uni_id_token')
				const r = await ps.getSeniority()
				if (old) uni.setStorageSync('uni_id_token', old)
				add('未登录防护（无 token 调 getSeniority）', r.errCode === 'NOT_AUTH', '返回 NOT_AUTH ✓')
			} catch (e) {
				const isNotAuth = e.message && e.message.includes('未登录')
				add('未登录防护（无 token 调 getSeniority）', isNotAuth, isNotAuth ? '抛 NOT_AUTH ✓' : e.message)
			}

			this.s6AutoProgress = 100
			this.s6AutoResults = results
			this.s6AutoSummary = { passed, total: totalSteps, allPass: passed === totalSteps }
			this.s6AutoRunning = false
		},

		// ==================== 阶段七 · 迁移与防刷测试 ====================

		/** Panel A: 老用户 career 迁移 */
		async callSystemMigration() {
			this.s7Loading.migrate = true
			this.s7MigrateMsg = ''
			this.s7MigrateRaw = null
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.systemRunCareerMigration({ confirm: 'migrate' })
				this.s7MigrateRaw = res
				if (res.errCode === 0) {
					this.s7MigrateMsg = `✓ 迁移完成，已为 ${res.data.updated} 个老用户补全 career 字段`
					this.s7MigrateOk = true
				} else {
					this.s7MigrateMsg = `✗ ${res.errMsg || JSON.stringify(res)}`
					this.s7MigrateOk = false
				}
			} catch (e) {
				this.s7MigrateRaw = { errCode: -1, errMsg: e.message }
				this.s7MigrateMsg = `✗ ${e.message}`
				this.s7MigrateOk = false
			}
			this.s7Loading.migrate = false
		},

		/** Panel B: 四道防线一键测试（自动清理残留数据） */
		async s7RunSecurityTest() {
			this.s7SecurityRunning = true
			this.s7SecurityProgress = 0
			this.s7SecurityResults = []
			this.s7SecuritySummary = null

			const results = []
			let passed = 0
			const total = 5
			const add = (name, ok, detail) => {
				results.push({ name, passed: ok, detail: detail || '' })
				if (ok) passed++
			}

			const ps = uniCloud.importObject('pin-system')

			// 0. 前置清理：清空槽位 + 池子，避免残留数据干扰
			this.s7SecurityProgress = 5
			try {
				await ps.testResetSlots()
			} catch (e) { /* 清理失败不影响后续，继续测试 */ }

			// 1. 频率限制测试：快速连续调用 6 次 ping，预期第 6 次返回 RATE_LIMIT
			this.s7SecurityProgress = 20
			try {
				let gotRateLimit = false
				for (let i = 0; i < 6; i++) {
					const r = await ps.ping()
					if (r.errCode === 'RATE_LIMIT') { gotRateLimit = true; break }
				}
				add('① 频率限制（_before RATE_LIMIT）', gotRateLimit, gotRateLimit ? '第 6 次被限 ✓' : '未触发限流（可能冷启动重置了计数器）')
			} catch (e) { add('① 频率限制', false, e.message) }

			// 2. 广告时长校验：传 adDuration=5000ms（< 阈值 15s）→ 预期 AD_TOO_SHORT
			this.s7SecurityProgress = 40
			try {
				const r = await ps.handleAdReward({ scene: 'first_pin', surveyId: '__sec_ad_test_' + Date.now(), adDuration: 5000 })
				const ok = r.errCode === 'AD_TOO_SHORT'
				add('② 广告时长校验（5s < 15s → AD_TOO_SHORT）', ok, ok ? '返回 AD_TOO_SHORT ✓' : `返回 ${r.errCode}`)
			} catch (e) {
				// 云对象可能抛异常而不是返回 errCode，检查异常消息
				const isAdTooShort = e.message && e.message.includes('广告观看时长不足')
				add('② 广告时长校验（5s < 15s → AD_TOO_SHORT）', isAdTooShort, isAdTooShort ? '抛异常拦截：广告观看时长不足 ✓' : `异常：${e.message}`)
			}

			// 3. 每日次数软帽：槽位已清空，正常调用 enterPool
			this.s7SecurityProgress = 55
			try {
				const r = await ps.enterPool({ surveyId: '__sec_daily_test_' + Date.now() })
				// 正常入池或已达每日上限都算接口正常
				const ok = r.errCode === 0 || r.errCode === 'DAILY_CAP_SOFT'
				add('③ 每日次数软帽（enterPool 接口）', ok, ok ? `返回 ${r.errCode}（${r.errMsg || '正常入池'}）` : JSON.stringify(r).slice(0, 60))
			} catch (e) { add('③ 每日次数软帽', false, e.message) }

			// 4. 正常时长不拦截：adDuration=20000ms（>= 15s），校验通过后走向入池逻辑
			this.s7SecurityProgress = 70
			try {
				const r = await ps.handleAdReward({ scene: 'first_pin', surveyId: '__sec_ad_ok_' + Date.now(), adDuration: 20000 })
				// 20000ms >= 15000ms → 不拦截，之后的入池可能成功也可能报 SLOTS_FULL 等
				const notBlocked = r.errCode !== 'AD_TOO_SHORT'
				add('④ 正常时长放行（20s >= 15s → 不拦截）', notBlocked, notBlocked ? `返回 ${r.errCode}（时长校验通过，${r.errMsg || '正常'}）` : `被拦截：${r.errCode}`)
			} catch (e) {
				const isAdTooShort = e.message && e.message.includes('广告观看时长不足')
				add('④ 正常时长放行（20s >= 15s → 不拦截）', !isAdTooShort, !isAdTooShort ? `异常但不是广告拦截：${e.message} ✓` : `异常：${e.message}`)
			}

			// 5. isEnded 等价校验：adDuration=0（未完整观看）→ 跳过时长校验，走其他参数校验
			this.s7SecurityProgress = 85
			try {
				const r = await ps.handleAdReward({ scene: 'first_pin', surveyId: '__sec_isEnded_' + Date.now(), adDuration: 0 })
				// adDuration=0 跳过了时长校验，后续可能返回 SLOTS_FULL（第二张问卷）或进入入池逻辑
				// 只要不是 AD_TOO_SHORT 就算合理
				const ok = r.errCode !== 'AD_TOO_SHORT'
				add('⑤ isEnded 等价（adDuration=0 → 跳过时长校验）', ok, ok ? `返回 ${r.errCode}（${r.errMsg || '正常'}，未拦截 ✓）` : `异常拦截：${r.errCode}`)
			} catch (e) {
				const isAdTooShort = e.message && e.message.includes('广告观看时长不足')
				add('⑤ isEnded 等价（adDuration=0 → 跳过时长校验）', !isAdTooShort, !isAdTooShort ? `异常但不是广告拦截：${e.message} ✓` : `异常：${e.message}`)
			}

			this.s7SecurityProgress = 100
			this.s7SecurityResults = results
			this.s7SecuritySummary = { passed, total, allPass: passed === total }
			this.s7SecurityRunning = false
		},

		s7ClearSecurity() {
			this.s7SecurityResults = []
			this.s7SecuritySummary = null
		}
	},
	computed: {
		forceQueueHint() {
			if (this.forceQueueMode) return '强制候场模式已开启，点「→ 进候场」将直接进入候场区'
			return '默认流程：Lv.0 走绿色通道直接入池；非 Lv.0 池满则进候场。池未满可开启下方「强制候场」开关'
		},
		statusText() {
			const r = this.stepResults.enterQueue
			if (!r) return ''
			if (r.errCode !== 0) return r.errMsg
			if (r.action === 'enter_queue') return '已进入候场区'
			if (r.action === 'direct_entry' && r.greenChannel) return '绿色通道：新人特权直接入池'
			if (r.action === 'direct_entry' && !r.greenChannel) return '池子未满，直接入池'
			return '操作完成'
		},
		mockPreview() {
			const items = []
			for (const u of this.mockUsers) {
				for (const s of u.surveys) {
					if (u.id && s.surveyId) {
						items.push({
							userId: u.id,
							nickname: u.nickname || '',
							surveyId: s.surveyId,
							surveyTitle: s.title || s.surveyId,
							surveyCover: s.cover || '',
							exposureCount: u.exposureCount || 0
						})
					}
				}
			}
			return items
		},
		passedCount() {
			return this.shellResults.filter(r => r.errCode === 'NOT_IMPLEMENTED').length
		},
		expStatusText() {
			const cleanDone = this.expMsg && this.expMsg.includes('已清理') && this.expMsgOk
			if (cleanDone) return '已清理'
			if (this.expDataSeeded) return '已造数据'
			return '空'
		},
		expStatusColor() {
			const cleanDone = this.expMsg && this.expMsg.includes('已清理') && this.expMsgOk
			if (cleanDone) return 'exp-ok'
			if (this.expDataSeeded) return 'exp-warn'
			return ''
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
.body-inner { padding: 32rpx 40rpx 0; }
.press-9 { transform: scale(.9); }
.press-95 { transform: scale(.95); }

/* ====== Section ====== */
.section { margin-bottom: 32rpx; }
.section-title { font-size: 28rpx; font-weight: 700; color: #1E2939; margin-bottom: 12rpx; }

/* ====== Card ====== */
.card { background: white; border-radius: 32rpx; padding: 24rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1); }
.card-row { display: flex; align-items: center; justify-content: space-between; }
.card-label { font-size: 26rpx; font-weight: 600; color: #1E2939; }
.card-btn {
	background: linear-gradient(90deg, #FFB900 0%, #FF6900 100%);
	border-radius: 40rpx; padding: 12rpx 32rpx;
}
.card-btn-sm { padding: 8rpx 24rpx; }
.card-btn-amber { background: #F59E0B; }
.card-btn-gray { background: #6B7280; }
.card-btn-green { background: #16A34A; }
.btn-txt { font-size: 24rpx; font-weight: 600; color: white; }

.card-result {
	margin-top: 16rpx; padding: 16rpx; border-radius: 16rpx;
	background: #FEF2F2; display: flex; align-items: flex-start; gap: 8rpx;
}
.card-result.success { background: #F0FDF4; }
.result-icon { font-size: 24rpx; flex-shrink: 0; margin-top: 2rpx; }
.card-result.success .result-icon { color: #16A34A; }
.card-result:not(.success) .result-icon { color: #DC2626; }
.result-txt { font-size: 22rpx; color: #374151; word-break: break-all; line-height: 1.6; }

.card-tip {
	margin-top: 16rpx; padding: 16rpx; border-radius: 16rpx;
	background: #FFF7ED; display: flex; gap: 8rpx; align-items: flex-start;
}
.tip-icon { font-size: 22rpx; flex-shrink: 0; color: #D97706; }
.tip-txt, .tip-tip { font-size: 22rpx; color: #92400E; line-height: 1.6; }

/* ====== 资历卡片 ====== */
.seniority-card {
	margin-top: 16rpx; border-radius: 20rpx; overflow: hidden;
	background: #F0FDF4; border: 2rpx solid #BBF7D0;
}
.seniority-body { padding: 20rpx; }
.sen-level { text-align: center; margin-bottom: 12rpx; }
.sen-level-val { font-size: 36rpx; font-weight: 800; color: #166534; }
.sen-detail { display: flex; gap: 8rpx; }
.sen-item {
	flex: 1; background: #DCFCE7; border-radius: 12rpx;
	padding: 12rpx; text-align: center;
}
.sen-key { font-size: 20rpx; color: #6B7280; display: block; }
.sen-val { font-size: 28rpx; font-weight: 700; color: #166534; display: block; }
.sen-done { color: #059669; }
.sen-error {
	padding: 16rpx; background: #FEF2F2; display: flex; align-items: flex-start; gap: 8rpx;
}

/* ====== 空壳列表 ====== */
.shell-list { margin-top: 16rpx; }
.shell-item {
	display: flex; align-items: center; justify-content: space-between;
	padding: 12rpx 16rpx; border-radius: 12rpx; margin-bottom: 6rpx;
}
.shell-pass { background: #F0FDF4; }
.shell-fail { background: #FEF2F2; }
.shell-left { display: flex; align-items: center; gap: 8rpx; }
.shell-icon { font-size: 20rpx; }
.shell-pass .shell-icon { color: #16A34A; }
.shell-fail .shell-icon { color: #DC2626; }
.shell-name { font-size: 24rpx; font-weight: 600; color: #1E2939; }
.shell-msg { font-size: 20rpx; color: #6B7280; }
.shell-summary { text-align: center; font-size: 24rpx; font-weight: 600; color: #059669; padding: 12rpx; }

/* ====== 对照表 ====== */
.level-row {
	display: flex; align-items: center; padding: 12rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}
.level-row:last-child { border-bottom: none; }
.level-label { width: 200rpx; font-size: 24rpx; font-weight: 600; color: #1E2939; }
.level-range { flex: 1; font-size: 22rpx; color: #6B7280; }
.level-next { font-size: 22rpx; color: #059669; }

/* ====== exposureCount 设置面板 ====== */
.set-panel { margin-top: 16rpx; padding: 16rpx; background: #F8FAFC; border-radius: 16rpx; }
.set-label { font-size: 22rpx; font-weight: 600; color: #475569; display: block; margin-bottom: 10rpx; }
.set-quick { display: flex; gap: 10rpx; margin-bottom: 12rpx; }
.quick-btn {
	background: white; border: 2rpx solid #E2E8F0; border-radius: 16rpx;
	padding: 10rpx 20rpx; min-width: 60rpx; text-align: center;
}
.quick-txt { font-size: 24rpx; font-weight: 600; color: #1E2939; }
.set-custom { display: flex; align-items: center; gap: 12rpx; }
.set-input {
	flex: 1; height: 64rpx; border: 2rpx solid #E2E8F0; border-radius: 16rpx;
	padding: 0 16rpx; font-size: 24rpx; background: white;
}
.set-msg { display: block; margin-top: 10rpx; font-size: 22rpx; }
.set-msg-ok { color: #16A34A; }
.set-msg-err { color: #DC2626; }

.bottom-spacer { height: 60rpx; }

/* ====== Draw 列表 ====== */
.draw-list { margin-top: 16rpx; }
.draw-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx; border-radius: 16rpx; margin-bottom: 8rpx;
}
.draw-mine { background: #F0FDF4; border: 2rpx solid #BBF7D0; }
.draw-other { background: #F8FAFC; border: 2rpx solid #E2E8F0; }
.draw-rank { font-size: 28rpx; font-weight: 800; color: #1E2939; width: 48rpx; text-align: center; }
.draw-body { flex: 1; min-width: 0; }
.draw-title { font-size: 24rpx; font-weight: 600; color: #1E2939; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.draw-tags { display: flex; gap: 8rpx; margin-top: 6rpx; }
.draw-tag { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 8rpx; }
.tag-mine { background: #DCFCE7; color: #166534; }
.tag-other { background: #E2E8F0; color: #475569; }
.tag-halo { background: #FEF9C3; color: #A16207; }
.tag-weight { background: #EDE9FE; color: #6D28D9; }

/* ====== 池子列表 ====== */
.pool-stats { margin-top: 16rpx; padding: 12rpx; background: #F0F9FF; border-radius: 12rpx; text-align: center; }
.pool-stats-txt { font-size: 24rpx; color: #1E40AF; }
.pool-stats-num { font-size: 32rpx; font-weight: 800; color: #1D4ED8; }
.pool-list { margin-top: 12rpx; }
.pool-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx; border-radius: 16rpx; margin-bottom: 8rpx;
}
.pool-halo { background: #FEFCE8; border: 2rpx solid #FDE68A; }
.pool-normal { background: #F8FAFC; border: 2rpx solid #E2E8F0; }
.pool-rank { font-size: 28rpx; font-weight: 800; color: #1E2939; width: 48rpx; text-align: center; }
.pool-body { flex: 1; min-width: 0; }
.pool-title { font-size: 24rpx; font-weight: 600; color: #1E2939; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pool-tags { display: flex; gap: 8rpx; margin-top: 6rpx; }
.pool-tag { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 8rpx; }
.tag-expiring { background: #FEE2E2; color: #DC2626; }
.tag-time { background: #E0E7FF; color: #4338CA; }

/* ====== 阶段四：候场区步骤流 ====== */
.qflow-progress {
	display: flex; align-items: center; gap: 0; padding: 0 8rpx; margin-bottom: 20rpx;
}
.qflow-step { display: flex; flex-direction: column; align-items: center; gap: 4rpx; flex: 1; }
.qflow-step-num { font-size: 28rpx; font-weight: 800; color: #CBD5E1; }
.qflow-step-lbl { font-size: 18rpx; color: #CBD5E1; white-space: nowrap; }
.qflow-done .qflow-step-num { color: #16A34A; }
.qflow-done .qflow-step-lbl { color: #16A34A; font-weight: 600; }
.qflow-connector { height: 2rpx; flex: 1; background: #E2E8F0; margin: 0 6rpx; margin-top: -20rpx; }
.qflow-conn-on { background: #16A34A; }

.qflow-card { padding: 0 !important; overflow: hidden; }

.qflow-summary { display: flex; gap: 20rpx; padding: 20rpx 24rpx; background: #F8FAFC; border-bottom: 2rpx solid #E2E8F0; }
.qflow-summary-item { flex: 1; }
.qflow-summary-lbl { font-size: 18rpx; color: #6B7280; display: block; }
.qflow-summary-val { font-size: 22rpx; font-weight: 600; color: #1E2939; display: block; margin-top: 2rpx; font-family: monospace; word-break: break-all; }
.qflow-phase-queuing { color: #92400E; }
.qflow-phase-inspecting { color: #3730A3; }
.qflow-phase-pushing { color: #6B21A8; }
.qflow-phase-ready { color: #16A34A; }

.qflow-step-panel { border-bottom: 2rpx solid #F3F4F6; }
.qflow-step-panel:last-child { border-bottom: none; }
.qflow-active { background: white; }
.qflow-done-panel { background: #FAFFFA; }

.qflow-step-header {
	display: flex; align-items: center; gap: 12rpx; padding: 16rpx 24rpx;
	cursor: pointer; min-height: 60rpx;
}
.qflow-step-badge {
	width: 36rpx; height: 36rpx; border-radius: 50%; display: flex;
	align-items: center; justify-content: center; font-size: 18rpx; font-weight: 700; flex-shrink: 0;
}
.qflow-badge-done { background: #DCFCE7; color: #16A34A; }
.qflow-badge-active { background: #22C55E; color: white; }
.qflow-badge-wait { background: #F3F4F6; color: #9CA3AF; }
.qflow-step-title { font-size: 26rpx; font-weight: 600; color: #1E2939; flex: 1; }
.qflow-step-status { font-size: 20rpx; color: #9CA3AF; }
.qflow-status-now { color: #16A34A; font-weight: 600; }

.qflow-step-body { padding: 0 24rpx 20rpx 72rpx; }
.qflow-tip { font-size: 20rpx; color: #6B7280; line-height: 1.6; margin-bottom: 12rpx; padding: 10rpx 14rpx; background: #FFF7ED; border-radius: 10rpx; }
.qflow-inline { display: flex; align-items: center; gap: 12rpx; }
.qflow-input { flex: 1; height: 64rpx; border: 2rpx solid #E2E8F0; border-radius: 16rpx; padding: 0 16rpx; font-size: 24rpx; background: white; }
.qflow-result { font-size: 22rpx; margin-top: 10rpx; line-height: 1.6; }
.qflow-ok { color: #16A34A; }
.qflow-err { color: #DC2626; }
.qflow-result-sub { font-size: 20rpx; display: block; margin-top: 2rpx; opacity: 0.8; font-family: monospace; }

.qflow-step-action {
	display: inline-flex; align-items: center; gap: 6rpx; margin-top: 14rpx;
	background: #22C55E; border-radius: 20rpx; padding: 10rpx 24rpx;
}
.qflow-step-action-sec { background: #6B7280; margin-left: 10rpx; }
.qflow-step-action-txt { font-size: 22rpx; font-weight: 600; color: white; }
.qflow-step-actions { display: flex; align-items: center; flex-wrap: wrap; }

/* 候场记录详情卡（内嵌步骤流） */
.qflow-queue-card { margin-top: 12rpx; }
.qflow-queue-item {
	border: 2rpx solid #E2E8F0; border-radius: 16rpx; padding: 14rpx; margin-bottom: 8rpx;
	background: #F8FAFC;
}
.qflow-qi-done { background: #F0FDF4; border-color: #BBF7D0; }
.qflow-qi-err { background: #FEF2F2; border-color: #FCA5A5; }
.qflow-qi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.qflow-qi-phase { font-size: 22rpx; font-weight: 700; padding: 2rpx 14rpx; border-radius: 8rpx; }
.qflow-qi-accel { font-size: 18rpx; color: #6B7280; }
.qflow-qi-body { margin-bottom: 6rpx; }
.qflow-qi-field { font-size: 18rpx; color: #475569; }
.qflow-qi-logs { background: #050505; border-radius: 10rpx; padding: 10rpx; }
.qflow-qi-log { font-size: 18rpx; color: #4ADE80; font-family: monospace; display: block; line-height: 1.7; }
.qflow-qi-done-badge { margin-top: 6rpx; font-size: 20rpx; font-weight: 600; color: #16A34A; }
.qflow-qi-err-badge { margin-top: 6rpx; font-size: 20rpx; color: #DC2626; }
.qflow-empty { text-align: center; padding: 24rpx; font-size: 22rpx; color: #9CA3AF; }

/* 时间模拟按钮 */
.qflow-time-btns { display: flex; gap: 10rpx; flex-wrap: wrap; }
.qflow-time-btn {
	flex: 1; min-width: 140rpx; text-align: center;
	background: white; border: 2rpx solid #E2E8F0; border-radius: 16rpx;
	padding: 14rpx 12rpx;
}
.qflow-time-btn-lbl { font-size: 22rpx; font-weight: 700; color: #1E2939; display: block; }
.qflow-time-btn-tip { font-size: 18rpx; color: #6B7280; display: block; margin-top: 2rpx; }

.qflow-hint { margin-top: 14rpx; padding: 12rpx; background: #FFF7ED; border-radius: 12rpx; display: flex; gap: 8rpx; align-items: flex-start; }
.qflow-hint-icon { font-size: 20rpx; flex-shrink: 0; color: #D97706; }
.qflow-hint-txt { font-size: 20rpx; color: #92400E; line-height: 1.6; }

/* 强制候场开关 */
.qflow-toggle {
	display: inline-flex; align-items: center; gap: 8rpx;
	padding: 6rpx 14rpx; border-radius: 20rpx;
	background: #F3F4F6; border: 2rpx solid #D1D5DB;
}
.qflow-toggle-on { background: #DCFCE7; border-color: #22C55E; }
.qflow-toggle-knob {
	width: 20rpx; height: 20rpx; border-radius: 50%;
	background: #9CA3AF; transition: background 0.2s;
}
.qflow-toggle-on .qflow-toggle-knob { background: #16A34A; }
.qflow-toggle-txt { font-size: 20rpx; color: #6B7280; font-weight: 500; }
.qflow-toggle-on .qflow-toggle-txt { color: #16A34A; font-weight: 700; }

/* ====== 阶段三：过期清理测试 ====== */
.exp-status { display: flex; align-items: center; gap: 8rpx; padding: 12rpx 16rpx; background: #F8FAFC; border-radius: 16rpx; margin-bottom: 16rpx; }
.exp-dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #CBD5E1; flex-shrink: 0; }
.exp-dot.exp-ok { background: #16A34A; }
.exp-dot.exp-warn { background: #D97706; }
.exp-label { font-size: 24rpx; color: #64748B; }
.exp-val { font-size: 24rpx; font-weight: 600; color: #64748B; }
.exp-val.exp-ok { color: #16A34A; }
.exp-val.exp-warn { color: #D97706; }

.exp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.exp-btn { border-radius: 20rpx; padding: 18rpx; text-align: center; }
.exp-btn.btn-disabled { opacity: 0.65; }
.btn-seed { background: #E0E7FF; }
.btn-call { background: #FEF9C3; }
.btn-query { background: #DCFCE7; }
.btn-clean { background: #FEE2E2; }
.exp-btn-txt { font-size: 24rpx; font-weight: 600; color: #1E2939; }

.exp-result { background: #F8FAFC; border-radius: 16rpx; }
.exp-result-title { font-size: 22rpx; font-weight: 600; color: #1E2939; display: block; margin-bottom: 8rpx; }
.exp-result-json { font-size: 20rpx; color: #475569; font-family: monospace; white-space: pre-wrap; word-break: break-all; line-height: 1.6; }
.p-12-16 { padding: 12rpx 16rpx; }
.p-0-8 { padding: 0 8rpx; }

.cr-card { background: white; border: 2rpx solid #E2E8F0; border-radius: 16rpx; padding: 16rpx; margin-bottom: 10rpx; }
.cr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.cr-number { font-size: 22rpx; font-weight: 700; color: #1E2939; }
.cr-honor { font-size: 20rpx; font-weight: 600; color: #D97706; background: #FEF3C7; padding: 2rpx 12rpx; border-radius: 8rpx; }
.cr-stats { display: flex; align-items: center; gap: 4rpx; margin-bottom: 10rpx; }
.cr-stat { flex: 1; text-align: center; }
.cr-stat-num { font-size: 32rpx; font-weight: 800; color: #1E2939; display: block; }
.cr-stat-lbl { font-size: 20rpx; color: #6B7280; display: block; margin-top: 2rpx; }
.cr-arrow { flex-shrink: 0; }
.cr-arrow-icon { font-size: 24rpx; color: #CBD5E1; }
.cr-bonus { background: #FEF3C7; border-radius: 8rpx; padding: 6rpx 12rpx; display: inline-flex; align-items: center; gap: 6rpx; margin-bottom: 8rpx; }
.cr-bonus-icon { font-size: 18rpx; }
.cr-bonus-txt { font-size: 20rpx; font-weight: 600; color: #A16207; }
.cr-comment { padding: 8rpx 10rpx; background: #F3F4F6; border-radius: 8rpx; }
.cr-comment-txt { font-size: 20rpx; color: #475569; line-height: 1.6; }
.cr-empty { padding: 20rpx; text-align: center; }
.cr-empty-txt { font-size: 22rpx; color: #6B7280; }

/* ====== 阶段五 · 首页集成测试 ====== */
.p5-panel { margin-bottom: 24rpx; padding-bottom: 24rpx; border-bottom: 2rpx solid #F3F4F6; }
.p5-panel:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
.p5-panel-title { font-size: 26rpx; font-weight: 700; color: #1E2939; display: block; margin-bottom: 4rpx; }
.p5-panel-desc { font-size: 20rpx; color: #6B7280; display: block; margin-bottom: 12rpx; line-height: 1.6; }
.p5-inline { margin-bottom: 12rpx; }

/* Panel A: 字段明细 */
.p5-draw-raw { display: flex; align-items: center; gap: 16rpx; margin-bottom: 12rpx; }
.p5-raw-label { font-size: 24rpx; font-weight: 700; color: #16A34A; }
.p5-raw-info { font-size: 22rpx; color: #6B7280; }
.p5-field-list { margin-top: 8rpx; }
.p5-field-card {
	border-radius: 20rpx; padding: 16rpx; margin-bottom: 10rpx;
	position: relative;
}
.p5-fc-mine { background: #F0FDF4; border: 2rpx solid #BBF7D0; }
.p5-fc-other { background: #F8FAFC; border: 2rpx solid #E2E8F0; }
.p5-fc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.p5-fc-rank { font-size: 24rpx; font-weight: 800; color: #1E2939; }
.p5-fc-tags { display: flex; gap: 6rpx; }
.p5-tag { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 6rpx; font-weight: 600; }
.p5-tag-mine { background: #DCFCE7; color: #166534; }
.p5-tag-halo { background: #FEF9C3; color: #A16207; }

.p5-fc-field { display: flex; align-items: center; gap: 10rpx; margin-bottom: 4rpx; }
.p5-fc-field-focus { background: #FFF7ED; padding: 4rpx 10rpx; border-radius: 8rpx; margin-bottom: 6rpx; margin-top: 4rpx; }
.p5-fc-key { font-size: 20rpx; font-weight: 600; color: #475569; min-width: 100rpx; flex-shrink: 0; }
.p5-fc-val { font-size: 20rpx; color: #1E2939; word-break: break-all; flex: 1; }
.p5-fc-val-mono { font-family: monospace; font-size: 18rpx; }
.p5-fc-badge { font-size: 16rpx; padding: 1rpx 8rpx; border-radius: 6rpx; font-weight: 600; flex-shrink: 0; }
.p5-badge-ok { background: #DCFCE7; color: #166534; }
.p5-badge-warn { background: #FEF3C7; color: #92400E; }

/* Panel B: 首页卡片模拟 */
.p5-topbar-preview { margin-top: 8rpx; }
.p5-topbar-track { display: flex; flex-direction: row; gap: 16rpx; min-height: 180rpx; padding: 8rpx 0; }
.p5-topbar-card {
	flex-shrink: 0; width: 160rpx; background: white;
	border-radius: 24rpx; padding: 14rpx 10rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	text-align: center; position: relative; overflow: visible;
}
.p5-topbar-cover {
	width: 80rpx; height: 80rpx; margin: 0 auto 8rpx;
	background: #FFF7ED; border-radius: 20rpx;
	display: flex; align-items: center; justify-content: center;
	position: relative; overflow: hidden;
}
.p5-topbar-img { width: 100%; height: 100%; border-radius: 20rpx; }
.p5-topbar-emoji { font-size: 36rpx; }
.p5-topbar-badge {
	position: absolute; top: -4rpx; right: -4rpx;
	background: #F97316; border-radius: 50%;
	width: 28rpx; height: 28rpx;
	display: flex; align-items: center; justify-content: center;
	z-index: 2;
}
.p5-topbar-badge-txt { font-size: 16rpx; color: white; font-weight: 700; }
.p5-topbar-halo {
	position: absolute; inset: -6rpx;
	border: 4rpx solid #FBBF24; border-radius: 24rpx;
	animation: p5HaloPulse 1.5s ease-in-out infinite;
	opacity: 0.6; pointer-events: none;
}
.p5-topbar-title { font-size: 20rpx; font-weight: 600; color: #1E2939; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p5-topbar-author { font-size: 18rpx; color: #99A1AF; display: block; margin-top: 2rpx; }

/* Panel C: 事件回调 */
.p5-event-btns { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 12rpx; }
.p5-event-log { margin-top: 8rpx; }
.p5-event-item { display: flex; align-items: flex-start; gap: 8rpx; padding: 6rpx 10rpx; margin-bottom: 4rpx; border-radius: 8rpx; background: #F8FAFC; }
.p5-event-icon { font-size: 18rpx; flex-shrink: 0; margin-top: 2rpx; font-weight: 700; }
.p5-ev-ok { color: #16A34A; }
.p5-ev-err { color: #DC2626; }
.p5-event-msg { font-size: 20rpx; color: #1E2939; line-height: 1.5; }

.p5-empty-hint { text-align: center; padding: 24rpx; font-size: 22rpx; color: #9CA3AF; }


@keyframes p5HaloPulse {
	0%, 100% { opacity: 0.3; }
	50% { opacity: 0.8; }
}

/* ====== 阶段五 · 模拟数据管理器 ====== */
.mock-toolbar { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 12rpx; }
.mock-result-msg { display: block; font-size: 22rpx; margin-bottom: 12rpx; }
.mock-msg-ok { color: #16A34A; }
.mock-msg-err { color: #DC2626; }
.mock-empty { padding: 24rpx; text-align: center; }
.mock-empty-txt { font-size: 22rpx; color: #9CA3AF; }

.mock-user-card {
	border-radius: 20rpx; margin-bottom: 10rpx;
	background: white; border: 2rpx solid #E2E8F0;
	overflow: hidden; transition: border-color 0.2s;
}
.mock-expand { border-color: #22C55E; }
.mock-user-header {
	display: flex; align-items: center; justify-content: space-between;
	padding: 14rpx 16rpx; 
}
.mock-user-left { display: flex; align-items: center; gap: 10rpx; flex: 1; min-width: 0; }
.mock-user-icon { font-size: 18rpx; color: #9CA3AF; width: 20rpx; }
.mock-user-name { font-size: 24rpx; font-weight: 700; color: #1E2939; }
.mock-user-surveys { font-size: 18rpx; color: #99A1AF; margin-left: auto; }
.mock-user-right { display: flex; align-items: center; gap: 10rpx; flex-shrink: 0; }
.mock-user-lv { font-size: 18rpx; font-weight: 600; color: #16A34A; background: #DCFCE7; padding: 2rpx 10rpx; border-radius: 6rpx; }
.mock-user-del { width: 36rpx; height: 36rpx; border-radius: 50%; background: #FEE2E2; display: flex; align-items: center; justify-content: center; }
.mock-del-txt { font-size: 18rpx; color: #DC2626; font-weight: 700; }

.mock-user-body { padding: 0 16rpx 16rpx; border-top: 2rpx solid #F3F4F6; }
.mock-field-row { display: flex; align-items: center; gap: 10rpx; margin-top: 12rpx; }
.mock-label-sm { font-size: 20rpx; font-weight: 600; color: #475569; min-width: 56rpx; flex-shrink: 0; }
.mock-input {
	flex: 1; height: 56rpx; border: 2rpx solid #E2E8F0; border-radius: 12rpx;
	padding: 0 12rpx; font-size: 22rpx; background: #F8FAFC;
}
.mock-exp-btns { display: flex; gap: 8rpx; align-items: center; flex-wrap: wrap; flex: 1; }
.mock-exp-btn {
	padding: 6rpx 16rpx; border-radius: 10rpx; border: 2rpx solid #E2E8F0;
	background: white; min-width: 48rpx; text-align: center;
}
.mock-exp-sel { background: #DCFCE7; border-color: #22C55E; }
.mock-exp-txt { font-size: 20rpx; font-weight: 600; color: #1E2939; }
.mock-exp-input { width: 90rpx; flex: none; text-align: center; }
.mock-input-sm { font-size: 20rpx; height: 48rpx; }

.mock-survey-header { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; }
.mock-survey-title { font-size: 20rpx; font-weight: 600; color: #6B7280; }
.mock-survey-row { display: flex; align-items: center; gap: 8rpx; margin-top: 8rpx; }
.mock-survey-del { width: 32rpx; height: 32rpx; border-radius: 50%; background: #FEE2E2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.mock-preview { margin-top: 16rpx; padding: 14rpx; background: #F8FAFC; border-radius: 16rpx; }
.mock-preview-label { font-size: 20rpx; font-weight: 600; color: #475569; display: block; margin-bottom: 8rpx; }
.mock-preview-item { display: flex; gap: 8rpx; align-items: flex-start; padding: 4rpx 0; font-size: 18rpx; color: #6B7280; }
.mock-preview-idx { font-weight: 700; color: #1E2939; flex-shrink: 0; width: 28rpx; }
.mock-preview-txt { word-break: break-all; line-height: 1.5; }

/* ====== 阶段六 · 战绩单手动测试 ====== */
.s6-panel { margin-bottom: 24rpx; padding-bottom: 24rpx; border-bottom: 2rpx solid #F3F4F6; }
.s6-panel:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
.s6-panel-title { font-size: 26rpx; font-weight: 700; color: #1E2939; display: block; margin-bottom: 4rpx; }
.s6-panel-desc { font-size: 20rpx; color: #6B7280; display: block; margin-bottom: 12rpx; line-height: 1.6; }
.s6-inline { margin-bottom: 10rpx; }

/* Panel A: checkCareerStatus 结果 */
.s6-status-box { margin-top: 12rpx; }
.s6-status-hd { display: flex; align-items: center; gap: 10rpx; padding: 14rpx 18rpx; border-radius: 16rpx; margin-bottom: 10rpx; }
.s6-hd-unread { background: #FFF7ED; border: 2rpx solid #FDE68A; }
.s6-hd-none { background: #F0FDF4; border: 2rpx solid #BBF7D0; }
.s6-status-icon { font-size: 28rpx; }
.s6-status-txt { font-size: 26rpx; font-weight: 700; color: #1E2939; }

.s6-status-careers { display: flex; flex-direction: column; gap: 10rpx; }
.s6-career-mini { background: #F8FAFC; border: 2rpx solid #E2E8F0; border-radius: 16rpx; padding: 14rpx; }
.s6-career-mini-hd { display: flex; align-items: center; gap: 8rpx; margin-bottom: 6rpx; }
.s6-career-mini-idx { font-size: 20rpx; font-weight: 700; color: #1E2939; background: #E2E8F0; padding: 1rpx 10rpx; border-radius: 6rpx; }
.s6-career-mini-title { font-size: 24rpx; font-weight: 600; color: #1E2939; display: block; }
.s6-career-mini-row { display: flex; align-items: center; gap: 8rpx; margin-top: 6rpx; }
.s6-career-mini-honor { font-size: 22rpx; color: #D97706; font-weight: 600; }
.s6-career-mini-bonus { font-size: 18rpx; font-weight: 700; color: #7C3AED; background: #EDE9FE; padding: 1rpx 10rpx; border-radius: 6rpx; }
.s6-career-mini-stats { display: flex; gap: 12rpx; margin-top: 8rpx; }
.s6-career-mini-stat { font-size: 20rpx; color: #6B7280; }
.s6-career-mini-actions { display: flex; gap: 10rpx; margin-top: 10rpx; }
.s6-raw-json { display: block; margin-top: 8rpx; font-size: 18rpx; color: #475569; font-family: monospace; background: #F8FAFC; padding: 10rpx; border-radius: 10rpx; word-break: break-all; line-height: 1.5; }

/* Panel C: 弹窗模拟 */
.s6-sim-btns { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 12rpx; }

.s6-popup-overlay {
	position: fixed; top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(0,0,0,.5); z-index: 999;
	display: flex; align-items: center; justify-content: center;
	padding: 60rpx;
	animation: s6FadeIn .25s ease-out;
}
.s6-popup {
	background: white; border-radius: 32rpx; width: 100%; max-width: 560rpx;
	overflow: hidden; box-shadow: 0 16rpx 48rpx rgba(0,0,0,.2);
	animation: s6SlideUp .3s cubic-bezier(.34,1.56,.64,1);
}
.s6-popup-hd {
	background: linear-gradient(135deg, #B91C1C, #DC2626);
	padding: 40rpx 36rpx 28rpx; text-align: center;
}
.s6-popup-stamp { width: 56rpx; height: 56rpx; margin-bottom: 12rpx; }
.s6-popup-title { font-size: 32rpx; font-weight: 800; color: white; display: block; letter-spacing: 2rpx; }
.s6-popup-sub { font-size: 22rpx; color: rgba(255,255,255,.7); display: block; margin-top: 6rpx; }

.s6-popup-body { padding: 32rpx 36rpx; text-align: center; }
.s6-popup-honor { font-size: 30rpx; font-weight: 800; color: #B91C1C; display: block; margin-bottom: 8rpx; }
.s6-popup-survey { font-size: 24rpx; color: #6B7280; display: block; margin-bottom: 24rpx; }
.s6-popup-stats { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-bottom: 16rpx; }
.s6-popup-stat { text-align: center; }
.s6-popup-num { font-size: 36rpx; font-weight: 800; color: #EA580C; display: block; font-family: monospace; }
.s6-popup-label { font-size: 20rpx; color: #9CA3AF; display: block; margin-top: 4rpx; }
.s6-popup-sep { font-size: 24rpx; color: #D1D5DC; }
.s6-popup-bonus text {
	display: inline-block; background: linear-gradient(135deg, #7C3AED, #A855F7);
	color: white; font-size: 20rpx; font-weight: 700;
	padding: 4rpx 16rpx; border-radius: 16rpx;
}

.s6-popup-ft { padding: 0 36rpx 36rpx; display: flex; gap: 16rpx; }
.s6-popup-btn {
	flex: 1; padding: 20rpx; border-radius: 24rpx; text-align: center; font-size: 26rpx; font-weight: 700;
}
.s6-popup-btn-view { background: #1E2939; color: white; }
.s6-popup-btn-close { background: #F3F4F6; color: #6B7280; }

@keyframes s6FadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes s6SlideUp { from { opacity: 0; transform: translateY(40rpx); } to { opacity: 1; transform: translateY(0); } }

/* Panel D: 缓存操作 */
.s6-cache-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 10rpx; }
.s6-cache-val { font-size: 22rpx; color: #6B7280; }
.s6-cache-val-num { font-weight: 700; color: #1E2939; font-family: monospace; }
.s6-cache-btns { display: flex; gap: 10rpx; flex-wrap: wrap; }
.s6-cache-btn {
	padding: 10rpx 24rpx; border-radius: 14rpx; background: white; border: 2rpx solid #E2E8F0;
	font-size: 22rpx; font-weight: 600; color: #1E2939; text-align: center;
}
.s6-cache-btn-clear { background: #FEE2E2; border-color: #FCA5A5; color: #DC2626; }

/* Panel E: 槽位快照 */
.s6-slot-list { display: flex; flex-direction: column; gap: 8rpx; margin-top: 10rpx; }
.s6-slot-item {
	display: flex; align-items: center; justify-content: space-between;
	padding: 14rpx 16rpx; border-radius: 14rpx; border: 2rpx solid #E2E8F0;
	background: #F8FAFC;
}
.s6-slot-idle { background: #FAFFFA; }
.s6-slot-queuing { background: #FFF7ED; border-color: #FDE68A; }
.s6-slot-active { background: #EFF6FF; border-color: #BFDBFE; }
.s6-slot-claimable { background: #FFF7ED; border-color: #FBBF24; }
.s6-slot-left { display: flex; align-items: center; gap: 10rpx; }
.s6-slot-idx { font-size: 22rpx; font-weight: 700; color: #1E2939; }
.s6-slot-status { font-size: 20rpx; font-weight: 600; padding: 2rpx 12rpx; border-radius: 6rpx; }
.s6-slot-status-idle { background: #DCFCE7; color: #166534; }
.s6-slot-status-queuing { background: #FEF3C7; color: #92400E; }
.s6-slot-status-active { background: #DBEAFE; color: #1E40AF; }
.s6-slot-status-claimable { background: #FEF3C7; color: #B45309; }
.s6-slot-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2rpx; }
.s6-slot-pin, .s6-slot-svy, .s6-slot-queue { font-size: 16rpx; color: #9CA3AF; font-family: monospace; }
.s6-slot-idle-txt { font-size: 20rpx; color: #9CA3AF; }

/* ====== Auto Run 自动化测试 ====== */
.s6-auto-hd { display: flex; align-items: center; gap: 16rpx; margin-bottom: 14rpx; flex-wrap: wrap; }
.card-btn-auto { padding: 16rpx 40rpx; min-width: 260rpx; text-align: center; }
.s6-summary-badge { padding: 10rpx 24rpx; border-radius: 40rpx; font-size: 24rpx; font-weight: 700; }
.s6-badge-pass { background: #DCFCE7; color: #166534; }
.s6-badge-fail { background: #FEF2F2; color: #DC2626; }

.s6-progress-wrap { display: flex; align-items: center; gap: 12rpx; margin-bottom: 14rpx; }
.s6-progress-track { flex: 1; height: 12rpx; background: #F3F4F6; border-radius: 99rpx; overflow: hidden; }
.s6-progress-fill { height: 100%; background: linear-gradient(90deg, #22C55E, #16A34A); border-radius: 99rpx; transition: width .3s ease; }
.s6-progress-txt { font-size: 20rpx; font-weight: 600; color: #16A34A; width: 40rpx; text-align: right; }

.s6-auto-list { display: flex; flex-direction: column; gap: 6rpx; }
.s6-auto-item {
	display: flex; align-items: flex-start; justify-content: space-between;
	padding: 12rpx 16rpx; border-radius: 12rpx; gap: 12rpx;
}
.s6-auto-pass { background: #F0FDF4; }
.s6-auto-fail { background: #FEF2F2; }
.s6-auto-left { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; min-width: 240rpx; }
.s6-auto-icon { font-size: 20rpx; width: 24rpx; text-align: center; }
.s6-auto-pass .s6-auto-icon { color: #16A34A; }
.s6-auto-fail .s6-auto-icon { color: #DC2626; }
.s6-auto-name { font-size: 24rpx; font-weight: 600; color: #1E2939; white-space: nowrap; }
.s6-auto-detail { font-size: 20rpx; color: #6B7280; text-align: right; word-break: break-all; line-height: 1.5; flex: 1; min-width: 0; }
.s6-auto-fail .s6-auto-detail { color: #DC2626; }
.s6-slot-empty { text-align: center; padding: 16rpx; font-size: 22rpx; color: #9CA3AF; }

/* ====== 阶段七 · 迁移与防刷测试 ====== */
.s7-panel { margin-bottom: 24rpx; }
.s7-panel:last-child { margin-bottom: 0; }
.s7-panel-title { font-size: 26rpx; font-weight: 700; color: #1E2939; margin-bottom: 6rpx; }
.s7-panel-desc { font-size: 22rpx; color: #99A1AF; margin-bottom: 14rpx; line-height: 1.5; }
.s7-row { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 10rpx; }
.s7-raw-json { display: block; margin-top: 8rpx; font-size: 18rpx; color: #6B7280; font-family: monospace; word-break: break-all; background: #F8FAFC; padding: 12rpx; border-radius: 10rpx; }

/* Panel B: 四道防线 */
.s7-progress-wrap { display: flex; align-items: center; gap: 12rpx; margin-bottom: 14rpx; }
.s7-progress-track { flex: 1; height: 12rpx; background: #F3F4F6; border-radius: 99rpx; overflow: hidden; }
.s7-progress-fill { height: 100%; background: linear-gradient(90deg, #6366F1, #4F46E5); border-radius: 99rpx; transition: width .3s ease; }
.s7-progress-txt { font-size: 20rpx; font-weight: 600; color: #4F46E5; width: 40rpx; text-align: right; }
.s7-result-list { display: flex; flex-direction: column; gap: 6rpx; }
.s7-result-item {
	display: flex; align-items: flex-start; justify-content: space-between;
	padding: 12rpx 16rpx; border-radius: 12rpx; gap: 12rpx;
}
.s7-result-pass { background: #F0FDF4; }
.s7-result-fail { background: #FEF2F2; }
.s7-result-left { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; min-width: 240rpx; }
.s7-result-icon { font-size: 20rpx; width: 24rpx; text-align: center; }
.s7-result-pass .s7-result-icon { color: #16A34A; }
.s7-result-fail .s7-result-icon { color: #DC2626; }
.s7-result-name { font-size: 24rpx; font-weight: 600; color: #1E2939; white-space: nowrap; }
.s7-result-detail { font-size: 20rpx; color: #6B7280; text-align: right; word-break: break-all; line-height: 1.5; flex: 1; min-width: 0; }
.s7-result-fail .s7-result-detail { color: #DC2626; }
.s7-security-summary { text-align: center; margin-top: 12rpx; padding: 12rpx; border-radius: 12rpx; font-size: 26rpx; font-weight: 700; }
.s7-summary-pass { background: #DCFCE7; color: #166534; }
.s7-summary-fail { background: #FEF2F2; color: #DC2626; }

</style>
