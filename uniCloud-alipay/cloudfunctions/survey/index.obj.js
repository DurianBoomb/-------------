/**
 * survey 云对象
 * 问卷业务：分类查询、标签列表、问卷获取
 */

const db = uniCloud.database()
const categoriesCol = db.collection('survey-categories')
const tagsCol = db.collection('survey-tags')
const surveysCol = db.collection('surveys')
const answersCol = db.collection('survey-answers')
const likesCol = db.collection('survey-likes')
const uniID = require('uni-id-common')

module.exports = {
	async _before() {
		this.timestamp = Date.now()
		this.uid = null
		const token = this.getUniIdToken()
		if (!token) return
		try {
			const uniIDInstance = uniID.createInstance({ context: this.getCloudInfo() })
			const payload = await uniIDInstance.checkToken(token)
			if (payload.uid) {
				this.uid = payload.uid
			}
		} catch (e) {
			console.error('[survey] token 校验失败', e.errCode || '', e.message || e)
		}
	},

	async getCategories() {
		try {
			const res = await categoriesCol.orderBy('sort', 'asc').get()
			return { errCode: 0, data: res.data || [] }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '分类查询失败' }
		}
	},

	async getTagList(params = {}) {
		try {
			const page = params.page || 1
			const pageSize = params.pageSize || 50
			const skip = (page - 1) * pageSize
			const where = { status: 'published' }
			if (params.category) where.category = params.category

			const query = tagsCol.where(where)
				.field({ _id: true, name: true, category: true, emoji: true, description: true, popularity: true, surveyCount: true, rarity: true })

			const ordered = params.sortBy === 'random' ? query : query.orderBy('popularity', 'desc')

			const [countRes, listRes] = await Promise.all([
				tagsCol.where(where).count(),
				ordered.skip(skip).limit(pageSize).get()
			])

			if (params.sortBy === 'random') {
				listRes.data.sort(() => Math.random() - 0.5)
			}

			return {
				errCode: 0,
				data: {
					list: listRes.data || [],
					total: countRes.total,
					page,
					pageSize,
					totalPage: Math.ceil(countRes.total / pageSize)
				}
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '标签查询失败' }
		}
	},

	async submitAnswer(params) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		if (!params || !params.surveyId || !params.answers) {
			return { errCode: 'PARAM_ERROR', errMsg: '参数不完整' }
		}
		try {
			const doc = {
				surveyId: params.surveyId,
				userId: uid,
				answers: params.answers,
				dimensionScores: params.dimensionScores || {},
				matchedType: params.matchedType || null,
				duration: params.duration || 0,
				surveySnapshot: params.surveySnapshot || {}
			}
			const res = await answersCol.add(doc)
			return { errCode: 0, data: { id: res.id } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '提交失败' }
		}
	},

	async getAnswerHistory(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		try {
			const page = params.page || 1
			const pageSize = params.pageSize || 50
			const skip = (page - 1) * pageSize
			const where = { userId: uid }

			const [countRes, listRes] = await Promise.all([
				answersCol.where(where).count(),
				answersCol.where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get()
			])

			const list = (listRes.data || []).map(item => ({
				_id: item._id,
				surveyId: item.surveyId,
				tagName: (item.surveySnapshot && item.surveySnapshot.tagName) || '',
				dims: (item.surveySnapshot && item.surveySnapshot.dims) || [],
				scores: item.dimensionScores || {},
				resultName: (item.matchedType && item.matchedType.name) || '',
				emoji: (item.matchedType && item.matchedType.emoji) || '',
				createdAt: item.createdAt,
				duration: item.duration
			}))

			return {
				errCode: 0,
				data: { list, total: countRes.total, page, pageSize, totalPage: Math.ceil(countRes.total / pageSize) }
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '历史记录查询失败' }
		}
	},

	/**
	 * 删除单条答题记录
	 */
	async removeAnswer(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		const answerId = (params.answerId || '').trim()
		if (!answerId) return { errCode: 'PARAM_ERROR', errMsg: 'answerId 不能为空' }
		try {
			const res = await answersCol.doc(answerId).get()
			if (!res.data || res.data.length === 0) return { errCode: 'NOT_FOUND', errMsg: '记录不存在' }
			if (res.data[0].userId !== uid) return { errCode: 'AUTH_ERROR', errMsg: '无权操作' }
			await answersCol.doc(answerId).remove()
			return { errCode: 0 }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '删除失败' }
		}
	},

	async voteTag(params) {
		if (!params || !params.tagName || !params.type) return { errCode: 'PARAM_ERROR', errMsg: '参数不完整' }
		if (!['like', 'dislike'].includes(params.type)) return { errCode: 'PARAM_ERROR', errMsg: 'type 无效' }
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		try {
			const existing = await likesCol.where({ userId: uid, tagName: params.tagName }).get()
			if (existing.data && existing.data.length > 0) {
				const doc = existing.data[0]
				if (doc.type === params.type) {
					await likesCol.doc(doc._id).remove()
					return { errCode: 0, data: { voted: null } }
				} else {
					await likesCol.doc(doc._id).update({ type: params.type })
					return { errCode: 0, data: { voted: params.type } }
				}
			} else {
				await likesCol.add({ userId: uid, tagName: params.tagName, type: params.type })
				return { errCode: 0, data: { voted: params.type } }
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '评价失败' }
		}
	},

	async getVoteStats(params) {
		if (!params || !params.tagName) return { errCode: 'PARAM_ERROR', errMsg: '标签名不能为空' }
		try {
			const [likeRes, dislikeRes] = await Promise.all([
				likesCol.where({ tagName: params.tagName, type: 'like' }).count(),
				likesCol.where({ tagName: params.tagName, type: 'dislike' }).count()
			])
			return { errCode: 0, data: { likes: likeRes.total, dislikes: dislikeRes.total } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	async getUserVote(params) {
		if (!params || !params.tagName) return { errCode: 'PARAM_ERROR', errMsg: '参数错误' }
		const uid = this.uid
		if (!uid) return { errCode: 0, data: { voted: null } }
		try {
			const res = await likesCol.where({ userId: uid, tagName: params.tagName }).get()
			return { errCode: 0, data: { voted: (res.data && res.data.length > 0) ? res.data[0].type : null } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	async getUserProfile() {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		try {
			const res = await answersCol.where({ userId: uid }).orderBy('createdAt', 'asc').get()
			const list = res.data || []
			const seen = {}
			const profile = []
			list.forEach(item => {
				const tagName = item.surveySnapshot && item.surveySnapshot.tagName
				if (!tagName || seen[tagName]) return
				seen[tagName] = true
				profile.push({
					tagName,
					emoji: (item.matchedType && item.matchedType.emoji) || '',
					resultName: (item.matchedType && item.matchedType.name) || '',
					createdAt: item.createdAt
				})
			})
			return { errCode: 0, data: profile }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	/**
	 * 批量导入问卷数据（管理员用，绕过 schema 权限）
	 * 每次调用建议传 5-10 条，避免单次负载过大
	 */
	async importSurveys(params = {}) {
		const { surveys = [] } = params
		if (!Array.isArray(surveys) || surveys.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '请提供问卷数据数组' }
		}
		try {
			// 过滤掉生成失败的条目
			const valid = surveys.filter(s => {
				if (s._status === 'failed') return false
				if (!s.tagName || !s.dims || !s.qs) return false
				return true
			})
			const total = valid.length
			// 逐条插入，避免批量 add 超过限制
			const results = []
			for (let i = 0; i < valid.length; i++) {
				// 清除 Coze 内部字段
				const { _status, _error, prompt_version, ...record } = valid[i]
				const res = await surveysCol.add(record)
				results.push({ index: i, id: res.id, tagName: record.tagName })
			}
			return { errCode: 0, data: { total, imported: results.length, results } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '导入失败: ' + e.message }
		}
	},

	/**
	 * 批量导入标签数据（管理员用）
	 */
	async importTags(params = {}) {
		const { tags = [] } = params
		if (!Array.isArray(tags) || tags.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '请提供标签数据数组' }
		}
		try {
			const results = []
			for (let i = 0; i < tags.length; i++) {
				const record = tags[i]
				record.status = record.status || 'published'
				const res = await tagsCol.add(record)
				results.push({ index: i, id: res.id, name: record.name })
			}
			return { errCode: 0, data: { total: tags.length, imported: results.length, results } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '标签导入失败: ' + e.message }
		}
	},

	/**
	 * 查重：列出 surveys 中所有重复的 tagName
	 */
	async checkDuplicates() {
		try {
			const res = await surveysCol.aggregate()
				.group({
					_id: '$tagName',
					count: { $sum: 1 },
					ids: { $addToSet: '$_id' },
					creatorIds: { $addToSet: '$creatorId' },
					earliestDate: { $min: '$create_date' }
				})
				.match({ count: { $gt: 1 } })
				.sort({ count: -1 })
				.end()

			const duplicates = (res.data || []).map(d => ({
				tagName: d._id,
				count: d.count,
				ids: d.ids || [],
				creatorIds: (d.creatorIds || []).filter(Boolean),
				earliestDate: d.earliestDate
			}))

			return {
				errCode: 0,
				data: {
					total: duplicates.length,
					duplicates
				}
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查重失败: ' + e.message }
		}
	},

	/**
	 * 去重：对指定 tagName，保留最早的一条，删除其余
	 */
	async deduplicate(params = {}) {
		const tagName = (params.tagName || '').trim()
		if (!tagName) return { errCode: 'PARAM_ERROR', errMsg: 'tagName 不能为空' }

		try {
			// 查出所有同名记录，按创建时间升序
			const res = await surveysCol.where({ tagName })
				.orderBy('create_date', 'asc')
				.get()

			const list = res.data || []
			if (list.length <= 1) {
				return { errCode: 0, data: { kept: list[0] ? list[0]._id : null, deleted: [], count: 0 } }
			}

			// 保留第一条（最早），删除其余
			const kept = list[0]
			const toDelete = list.slice(1)

			const deletedIds = []
			for (const doc of toDelete) {
				await surveysCol.doc(doc._id).remove()
				deletedIds.push(doc._id)
			}

			return {
				errCode: 0,
				data: {
					tagName,
					kept: kept._id,
					keptDate: kept.create_date,
					deleted: deletedIds,
					count: deletedIds.length
				}
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '去重失败: ' + e.message }
		}
	},

	async getSurveyByTag(params) {
		if (!params || !params.tagName) {
			return { errCode: 'PARAM_ERROR', errMsg: '标签名不能为空' }
		}
		try {
			const res = await surveysCol.where({
				tagName: params.tagName
			}).limit(1).get()

			const list = res.data || []
			if (list.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '未找到该标签的问卷' }
			}

			// 标签唯一性约束下，至多一条记录，直接取第一条
			return { errCode: 0, data: list[0] }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '问卷查询失败' }
		}
	},

	/**
	 * 获取当前用户创建的问卷列表
	 */
	async getMySurveys() {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }

		try {
			const res = await surveysCol.where({ creatorId: uid })
				.orderBy('create_date', 'desc')
				.get()

			return {
				errCode: 0,
				data: (res.data || []).map(s => ({
					id: s._id,
					title: s.title || s.tagName || '',
					tagName: s.tagName || '',
					tagDesc: s.tagDesc || '',
					dims: s.dims || [],
					qs: s.qs || [],
					resultTypes: s.resultTypes || [],
					createdAt: s.create_date
				}))
			}
		} catch (e) {
			console.error('[getMySurveys] error:', e)
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	/**
	 * 删除我生成的问卷
	 */
	async removeSurvey(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		const surveyId = (params.surveyId || '').trim()
		if (!surveyId) return { errCode: 'PARAM_ERROR', errMsg: 'surveyId 不能为空' }
		try {
			const res = await surveysCol.doc(surveyId).get()
			if (!res.data || res.data.length === 0) return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			if (res.data[0].creatorId !== uid) return { errCode: 'AUTH_ERROR', errMsg: '无权操作' }
			await surveysCol.doc(surveyId).remove()
			return { errCode: 0 }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '删除失败' }
		}
	},

	/**
	 * 获取问卷详情（用于结果页创建者预览）
	 */
	async getSurveyDetail(params = {}) {
		const uid = this.uid
		const surveyId = (params.surveyId || '').trim()
		if (!surveyId) return { errCode: 'PARAM_ERROR', errMsg: 'surveyId 不能为空' }

		try {
			const res = await surveysCol.doc(surveyId).get()
			if (!res.data || res.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}

			const survey = res.data[0]

			// 联查创建者昵称
			let creatorNickname = ''
			if (survey.creatorId) {
				try {
					const usersCol = db.collection('uni-id-users')
					const userRes = await usersCol.doc(survey.creatorId).field({ nickname: true }).get()
					if (userRes.data && userRes.data.length > 0) {
						creatorNickname = userRes.data[0].nickname || ''
					}
				} catch (e) {
					console.warn('[getSurveyDetail] 查询创建者昵称失败:', e)
				}
			}

			return {
				errCode: 0,
				data: {
					resultTypes: survey.resultTypes || [],
					creatorId: survey.creatorId || '',
					creatorNickname,
					isCreator: !!(uid && survey.creatorId && uid === survey.creatorId)
				}
			}
		} catch (e) {
			console.error('[getSurveyDetail] error:', e)
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	/**
	 * 文字内容安全审核（调微信内容安全 API）
	 * @param {Object} params
	 * @param {string} params.content - 待审核文本
	 * @returns {Object} { errCode, data: { pass: boolean } }
	 */
	async checkTextContent(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }

		const content = (params.content || '').trim()
		if (!content) return { errCode: 'PARAM_ERROR', errMsg: '内容不能为空' }

		try {
			// 获取用户 openid（版本 2 需要）
			const usersCol = db.collection('uni-id-users')
			const userRes = await usersCol.doc(uid).field({ 'wx_openid.mp': true }).get()
			const openid = (userRes.data && userRes.data.length > 0) ? userRes.data[0].wx_openid.mp : ''
			if (!openid) {
				console.warn('[checkTextContent] 无法获取 openid，放行')
				return { errCode: 0, data: { pass: true } }
			}

			// 创建审核实例（用 uni-sec-check 插件）
			const UniSecCheck = require('uni-sec-check')
			const uniSecCheck = new UniSecCheck({
				provider: 'mp-weixin',
				requestId: this.getClientInfo().requestId
			})

			// 调用插件文本审核，version=2 会做基本同步检测 + 异步深度检测
			const result = await uniSecCheck.textSecCheck({
				content,
				openid,
				scene: 1,
				version: 2
			})

			console.log('[checkTextContent] 插件返回:', JSON.stringify(result))

			// 记录审核结果明细
			const r = result.result || {}
			const suggest = r.suggest || 'unknown'
			const label = r.label || 'unknown'
			console.log('[checkTextContent] 审核明细 | suggest:', suggest, '| label:', label, '| content:', content)

			// 按文档推荐逻辑：errCode === 'uni-sec-check-risk-content' 即有风险
			if (result.errCode === 'uni-sec-check-risk-content') {
				console.warn('[checkTextContent] 内容违规 | suggest:', suggest, '| label:', label)
				return { errCode: 0, data: { pass: false } }
			}

			return { errCode: 0, data: { pass: true } }

		} catch (e) {
			console.error('[checkTextContent] error:', e)
			return { errCode: 0, data: { pass: true }, warning: '审核服务异常，已放行' }
		}
	},

	/**
	 * 更新用户昵称（含内容安全审核）
	 * @param {Object} params
	 * @param {string} params.nickname - 新昵称
	 * @returns {Object} { errCode, data: { nickname } }
	 */
	async updateNickname(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }

		const nickname = (params.nickname || '').trim()
		if (!nickname) return { errCode: 'PARAM_ERROR', errMsg: '昵称不能为空' }

		try {
			// 更新昵称（敏感词校验已由客户端 check-word-safe 插件完成）
			const usersCol = db.collection('uni-id-users')
			await usersCol.doc(uid).update({ nickname })
			return { errCode: 0, data: { nickname } }

		} catch (e) {
			console.error('[updateNickname] error:', e)
			return { errCode: 'DB_ERROR', errMsg: '昵称修改失败' }
		}
	},

	/**
	 * 查询当前各稀有度标签数量
	 */
	async getRarityDistribution() {
		try {
			const counts = {}
			const rarities = ['common', 'rare', 'mythic', 'epic', 'legendary', 'darkgold']
			for (const r of rarities) {
				const c = await tagsCol.where({ rarity: r }).count()
				counts[r] = c.total
			}
			const total = Object.values(counts).reduce((a, b) => a + b, 0)
			return { errCode: 0, data: { distribution: counts, total } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: e.message || '查询失败' }
		}
	},

	/**
	 * 将全部史诗标签的稀有度改为传奇
	 */
	async mockEpicToLegendary() {
		try {
			const res = await tagsCol.where({ rarity: 'epic' }).field({ _id: true, name: true }).get()
			const epicList = res.data || []
			if (epicList.length === 0) {
				return { errCode: 0, data: { count: 0, msg: '没有史诗标签需要转换' } }
			}

			const ids = epicList.map(d => d._id)
			for (let i = 0; i < ids.length; i += 50) {
				const chunk = ids.slice(i, i + 50)
				await tagsCol.where({ _id: db.command.in(chunk) }).update({ rarity: 'legendary' })
			}

			const counts = {}
			const rarities = ['common', 'rare', 'mythic', 'epic', 'legendary', 'darkgold']
			for (const r of rarities) {
				const c = await tagsCol.where({ rarity: r }).count()
				counts[r] = c.total
			}

			return {
				errCode: 0,
				data: {
					count: ids.length,
					names: epicList.map(d => d.name),
					distribution: counts
				}
			}
		} catch (e) {
			console.error('[mockEpicToLegendary]', e)
			return { errCode: 'DB_ERROR', errMsg: e.message || '转换失败' }
		}
	},

	/**
	 * Mock：随机升级 common 标签为 mythic/legendary
	 * mythic 90 个 + legendary 40 个
	 */
	async mockUpgradeRarity() {
		try {
			// 1. 查询所有 common 标签的 _id
			const res = await tagsCol.where({ rarity: 'common' }).field({ _id: true }).limit(1000).get()
			const commonIds = (res.data || []).map(d => d._id)
			if (commonIds.length < 130) {
				return { errCode: 'NOT_ENOUGH', errMsg: `common 标签不足 130（当前 ${commonIds.length}）` }
			}

			// 2. Fisher-Yates 洗牌
			const arr = [...commonIds]
			for (let i = arr.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[arr[i], arr[j]] = [arr[j], arr[i]]
			}

			const mythicIds = arr.slice(0, 90)
			const legendaryIds = arr.slice(90, 130)

			// 3. 批量更新（分批 50 条，避免单次过大）
			const batch = async (ids, rarity) => {
				for (let i = 0; i < ids.length; i += 50) {
					const chunk = ids.slice(i, i + 50)
					await tagsCol.where({ _id: db.command.in(chunk) }).update({ rarity })
				}
			}

			await Promise.all([
				batch(mythicIds, 'mythic'),
				batch(legendaryIds, 'legendary')
			])

			// 4. 统计当前分布
			const counts = {}
			const rarities = ['common', 'rare', 'mythic', 'epic', 'legendary', 'darkgold']
			for (const r of rarities) {
				const c = await tagsCol.where({ rarity: r }).count()
				counts[r] = c.total
			}

			return { errCode: 0, data: { mythic: mythicIds.length, legendary: legendaryIds.length, distribution: counts } }
		} catch (e) {
			console.error('[mockUpgradeRarity]', e)
			return { errCode: 'DB_ERROR', errMsg: e.message || '升级失败' }
		}
	},

	/**
	 * 方案 A：按优先级重新分配稀有度
	 * 稀有 → 史诗 50 个 → 神话 60 个 → 普通 → 稀有 74 个
	 * 目标：普通125 稀有87 神话60 史诗50 传奇41 暗金1
	 */
	async mockRedistribute() {
		try {
			const batchUpdate = async (ids, rarity) => {
				for (let i = 0; i < ids.length; i += 50) {
					const chunk = ids.slice(i, i + 50)
					await tagsCol.where({ _id: db.command.in(chunk) }).update({ rarity })
				}
			}

			const shuffle = (arr) => {
				const a = [...arr]
				for (let i = a.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[a[i], a[j]] = [a[j], a[i]]
				}
				return a
			}

			// Step 1: 稀有 → 史诗（50 个）
			const rareRes = await tagsCol.where({ rarity: 'rare' }).field({ _id: true, name: true }).limit(1000).get()
			const rareList = (rareRes.data || [])
			if (rareList.length < 110) {
				return { errCode: 'NOT_ENOUGH', errMsg: `稀有标签不足 110（当前 ${rareList.length}），无法分给史诗50+神话60` }
			}

			const shuffledRare = shuffle(rareList)
			const toEpic = shuffledRare.slice(0, 50)
			const toMythic = shuffledRare.slice(50, 110)
			// 剩余 13 个保持稀有

			await batchUpdate(toEpic.map(d => d._id), 'epic')
			await batchUpdate(toMythic.map(d => d._id), 'mythic')

			// Step 2: 普通 → 稀有（74 个）
			const commonRes = await tagsCol.where({ rarity: 'common' }).field({ _id: true }).limit(1000).get()
			const commonList = (commonRes.data || [])
			if (commonList.length < 74) {
				return { errCode: 'NOT_ENOUGH', errMsg: `普通标签不足 74（当前 ${commonList.length}）` }
			}

			const shuffledCommon = shuffle(commonList)
			const toRare = shuffledCommon.slice(0, 74)

			await batchUpdate(toRare.map(d => d._id), 'rare')

			// 统计当前分布
			const counts = {}
			const rarities = ['common', 'rare', 'mythic', 'epic', 'legendary', 'darkgold']
			for (const r of rarities) {
				const c = await tagsCol.where({ rarity: r }).count()
				counts[r] = c.total
			}

			return {
				errCode: 0,
				data: {
					steps: {
						'稀有→史诗': toEpic.length,
						'稀有→神话': toMythic.length,
						'普通→稀有': toRare.length
					},
					distribution: counts
				}
			}
		} catch (e) {
			console.error('[mockRedistribute]', e)
			return { errCode: 'DB_ERROR', errMsg: e.message || '重新分配失败' }
		}
	}
}
