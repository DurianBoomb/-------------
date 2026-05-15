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
	}
}
