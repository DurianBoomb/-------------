/**
 * survey 云对象
 * 问卷业务：分类查询、标签列表、问卷获取
 */

const db = uniCloud.database()
const categoriesCol = db.collection('survey-categories')
const tagsCol = db.collection('survey-tags')
const surveysCol = db.collection('surveys')
const answersCol = db.collection('survey-answers')
const favoritesCol = db.collection('survey-favorites')
const likesCol = db.collection('survey-likes')
const uniID = require('uni-id-common')

// ==================== Coze 问卷生成 ====================

// ==================== Coze 问卷生成 ====================

/**
 * 递归 trim 对象/数组中所有字符串字段
 */
function deepTrim(obj) {
	if (typeof obj === 'string') return obj.trim()
	if (Array.isArray(obj)) return obj.map(deepTrim)
	if (obj && typeof obj === 'object') {
		const result = {}
		for (const key of Object.keys(obj)) {
			result[key] = deepTrim(obj[key])
		}
		return result
	}
	return obj
}

/**
 * 格式校验：确保 Coze 返回的问卷符合前端消费要求
 * @param {Object} q - 清洗后的 questionnaire 对象
 * @param {string} tagName - 输入的标签名
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateQuestionnaire(q, tagName) {
	const errors = []

	// 1. 必须有 dims 且长度 3-7
	if (!Array.isArray(q.dims) || q.dims.length < 3 || q.dims.length > 7) {
		errors.push(`dims 长度需 3-7，当前 ${q.dims ? q.dims.length : '无'}`)
	}
	const dims = q.dims || []

	// 2. 必须有 qs
	if (!Array.isArray(q.qs) || q.qs.length === 0) {
		errors.push('qs 为空')
	}

	// 3. qs 数量 = dims 数量 × 3（允许 ±1 容差）
	if (dims.length > 0 && Array.isArray(q.qs)) {
		const expected = dims.length * 3
		if (q.qs.length < expected - 1 || q.qs.length > expected + 1) {
			errors.push(`qs 数量 ${q.qs.length} 偏离预期 ${expected}（±1 容差内可接受）`)
		}
	}

	// 4. 每题 dim 必须在 dims 中
	if (Array.isArray(q.qs)) {
		q.qs.forEach((item, idx) => {
			if (item.dim && dims.length > 0 && !dims.includes(item.dim)) {
				errors.push(`qs[${idx}].dim "${item.dim}" 不在 dims 列表中`)
			}
		})
	}

	// 5. 必须有 resultTypes
	if (!Array.isArray(q.resultTypes) || q.resultTypes.length < 1) {
		errors.push('resultTypes 为空或不足')
	}

	// 6. 每个 resultType 的 match 必须在 dims 中
	if (Array.isArray(q.resultTypes)) {
		q.resultTypes.forEach((item, idx) => {
			if (item.match && dims.length > 0 && !dims.includes(item.match)) {
				errors.push(`resultTypes[${idx}].match "${item.match}" 不在 dims 列表中`)
			}
		})
	}

	// 7. tag 必须与输入的 tagName 一致
	if (q.tag && q.tag !== tagName) {
		errors.push(`tag "${q.tag}" 与输入的标签名 "${tagName}" 不一致`)
	}

	return { valid: errors.length === 0, errors }
}

/**
 * 检查标签名是否已存在同名记录（不限来源），返回已有记录列表
 */
async function findExistingTags(tagName) {
	const res = await tagsCol.where({ name: tagName }).get()
	return res.data || []
}

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
			// token 校验失败，uid 保持 null
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

	async toggleFavorite(params) {
		if (!params || !params.tagName) return { errCode: 'PARAM_ERROR', errMsg: '标签名不能为空' }
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		try {
			const existing = await favoritesCol.where({ userId: uid, tagName: params.tagName }).get()
			if (existing.data && existing.data.length > 0) {
				await favoritesCol.doc(existing.data[0]._id).remove()
				return { errCode: 0, data: { favorited: false } }
			} else {
				await favoritesCol.add({ userId: uid, tagName: params.tagName })
				return { errCode: 0, data: { favorited: true } }
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '操作失败' }
		}
	},

	async getFavorites() {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
		try {
			const res = await favoritesCol.where({ userId: uid }).orderBy('createdAt', 'desc').get()
			return { errCode: 0, data: (res.data || []).map(f => ({ tagName: f.tagName, createdAt: f.createdAt })) }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	},

	async checkFavorites(params) {
		if (!params || !params.tagNames) return { errCode: 'PARAM_ERROR', errMsg: '参数错误' }
		const uid = this.uid
		if (!uid) return { errCode: 0, data: {} }
		try {
			const res = await favoritesCol.where({ userId: uid, tagName: db.command.in(params.tagNames) }).get()
			const map = {}
			;(res.data || []).forEach(f => { map[f.tagName] = true })
			return { errCode: 0, data: map }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
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

	async getSurveyByTag(params) {
		if (!params || !params.tagName) {
			return { errCode: 'PARAM_ERROR', errMsg: '标签名不能为空' }
		}
		try {
			const res = await surveysCol.where({
				tagName: params.tagName
			}).get()

			const list = res.data || []
			if (list.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '未找到该标签的问卷' }
			}

			const survey = list[Math.floor(Math.random() * list.length)]
			return { errCode: 0, data: survey }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '问卷查询失败' }
		}
	},

	/**
	 * 看广告→Coze 实时生成问卷
	 */
	async generateFromCoze(params = {}) {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }

		const tagName = (params.tagName || '').trim()
		if (!tagName) return { errCode: 'PARAM_ERROR', errMsg: '标签名不能为空' }
		const tagDesc = (params.tagDesc || '').trim()

		try {
			// 1. 加载配置
			const configCenter = require('uni-config-center')
			const cozeConfig = configCenter({ pluginId: 'coze' }).config()

			// 2. 调用扣子编程新版工作流 API（参数直接放顶层，不用 inputs 包裹）
			const body = JSON.stringify({ tag_name: tagName, tag_desc: tagDesc })
			const res = await uniCloud.httpclient.request(cozeConfig.api_url, {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + cozeConfig.api_token,
					'Content-Type': 'application/json'
				},
				data: body,
				timeout: cozeConfig.timeout || 60000,
				dataType: 'json'
			})

			// 3. 解析响应
			const raw = res.data
			console.log('[generateFromCoze] Coze raw response:', JSON.stringify(raw).slice(0, 1000))

			// 3a. 检查 Coze API 自身错误（如参数校验失败）
			if (raw.detail && raw.detail.error_code) {
				console.error('[generateFromCoze] Coze API error:', raw.detail.error_message)
				return { errCode: 'COZE_ERROR', errMsg: 'Coze 生成异常: ' + (raw.detail.error_message || '未知错误') }
			}

			// 3b. 新版同步 API 返回格式：工作流输出参数名作为顶层 key
			// 如 { questionnaire: {...}, run_id: "xxx" }
			const questionnaire = raw && (raw.questionnaire || raw.result)
			if (!questionnaire || typeof questionnaire !== 'object') {
				console.error('[generateFromCoze] 无法识别的 Coze 响应:', JSON.stringify(raw).slice(0, 500))
				throw new Error('Coze 返回内容格式异常')
			}

			console.log('[generateFromCoze] parsed questionnaire:', JSON.stringify(questionnaire).slice(0, 1000))

			// 4. 补充 + 校验 + 入库
			questionnaire.title = questionnaire.title || tagName
			questionnaire.tag = questionnaire.tag || tagName
			questionnaire.tagDesc = questionnaire.tagDesc || tagDesc || ''

			const cleaned = deepTrim(questionnaire)
			const validation = validateQuestionnaire(cleaned, tagName)
			if (!validation.valid) {
				console.error('[generateFromCoze] 校验失败, errors:', JSON.stringify(validation.errors))
				console.error('[generateFromCoze] cleaned:', JSON.stringify(cleaned).slice(0, 1500))
				return { errCode: 'VALIDATE_ERROR', errMsg: 'AI 生成的内容格式有误，请修改标签名后重试', data: { errors: validation.errors } }
			}

			const surveyRes = await surveysCol.add({
				tagName, tagDesc: tagDesc || '',
				title: cleaned.title, dims: cleaned.dims,
				qs: cleaned.qs, resultTypes: cleaned.resultTypes,
				creatorId: uid, source: 'coze',
				status: 'active', create_date: Date.now()
			})

			return {
				errCode: 0,
				data: { surveyId: surveyRes.id, tagName, questionnaire: cleaned }
			}

		} catch (e) {
			console.error('[generateFromCoze]', e.message)
			return {
				errCode: e.message && e.message.includes('timeout') ? 'COZE_TIMEOUT' : 'COZE_ERROR',
				errMsg: e.message && e.message.includes('timeout') ? 'Coze 生成超时，请稍后重试' : 'Coze 生成异常: ' + (e.message || '未知错误')
			}
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
	}
}
