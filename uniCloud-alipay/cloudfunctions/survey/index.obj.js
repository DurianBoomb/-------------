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
			// 1. 读取 Coze 配置
			const cozeConfig = require('uni-config-center')({ pluginId: 'coze' }).config()
			if (!cozeConfig || !cozeConfig.api_url || !cozeConfig.api_token) {
				return { errCode: 'CONFIG_ERROR', errMsg: 'Coze 配置缺失' }
			}

			// 2. 调 Coze API
			const response = await uniCloud.httpclient.request(cozeConfig.api_url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${cozeConfig.api_token}`,
					'Content-Type': 'application/json'
				},
				data: {
					tag_name: tagName,
					tag_desc: tagDesc
				},
				timeout: cozeConfig.timeout || 60000,
				dataType: 'json'
			})

			// 3. 解析响应
			const body = response.data || response.body
			if (!body) {
				return { errCode: 'COZE_ERROR', errMsg: 'Coze 返回为空' }
			}

			const parsed = typeof body === 'string' ? JSON.parse(body) : body

			const rawQuestionnaire = parsed.questionnaire
			if (!rawQuestionnaire) {
				return { errCode: 'COZE_ERROR', errMsg: 'Coze 返回缺少 questionnaire 字段', data: parsed }
			}

			// 4. 检测 Coze 兜底失败
			if (rawQuestionnaire._status === 'failed') {
				return { errCode: 'COZE_FAILED', errMsg: rawQuestionnaire._error || 'Coze 生成失败' }
			}

			// 5. 递归 trim 清洗所有字符串
			const questionnaire = deepTrim(rawQuestionnaire)

			// 6. 格式校验
			const validation = validateQuestionnaire(questionnaire, tagName)
			if (!validation.valid) {
				return { errCode: 'VALIDATE_ERROR', errMsg: '问卷格式校验未通过', data: { errors: validation.errors, questionnaire } }
			}

			// 7. 组装入库数据
			const { _status, _error, prompt_version, ...surveyRecord } = questionnaire
			surveyRecord.tagName = tagName
			surveyRecord.status = 'active'
			surveyRecord.creatorId = uid

			// 8. 插入 surveys 表
			const surveyRes = await surveysCol.add(surveyRecord)

			// 9. 检查同名字标签
			const existingTags = await findExistingTags(tagName)
			const userTag = existingTags.find(t => t.source === 'user' && t.creatorId === uid)

			if (!userTag) {
				await tagsCol.add({
					name: tagName,
					emoji: '',
					source: 'user',
					creatorId: uid,
					status: 'draft',
					searchable: false,
					surveyCount: 1,
					popularity: 0,
					rarity: 'common'
				})
			} else {
				await tagsCol.doc(userTag._id).update({
					surveyCount: (userTag.surveyCount || 0) + 1
				})
			}

			// 10. 返回
			return {
				errCode: 0,
				data: {
					surveyId: surveyRes.id,
					tagName,
					questionnaire: {
						title: questionnaire.title || tagName,
						dims: questionnaire.dims,
						qs: questionnaire.qs,
						resultTypes: questionnaire.resultTypes,
						tagDesc: questionnaire.tagDesc || ''
					}
				}
			}

		} catch (e) {
			console.error('[generateFromCoze] error:', e)
			if (e.message && e.message.includes('timeout')) {
				return { errCode: 'COZE_TIMEOUT', errMsg: 'Coze 生成超时，请稍后重试' }
			}
			return { errCode: 'COZE_ERROR', errMsg: 'Coze 生成异常: ' + (e.message || '未知错误') }
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
					createdAt: s.create_date
				}))
			}
		} catch (e) {
			console.error('[getMySurveys] error:', e)
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
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
			return {
				errCode: 0,
				data: {
					resultTypes: survey.resultTypes || [],
					creatorId: survey.creatorId || '',
					isCreator: !!(uid && survey.creatorId && uid === survey.creatorId)
				}
			}
		} catch (e) {
			console.error('[getSurveyDetail] error:', e)
			return { errCode: 'DB_ERROR', errMsg: '查询失败' }
		}
	}
}
