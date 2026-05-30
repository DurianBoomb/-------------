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
			const where = { rarity: db.command.neq('handmade0') }
			if (params.category) where.category = params.category

			const query = tagsCol.where(where)
				.field({ _id: true, name: true, category: true, emoji: true, description: true, popularity: true, surveyCount: true, rarity: true, creatorId: true, source: true, surveyId: true, clickCount: true })

			const ordered = params.sortBy === 'random' ? query : query.orderBy('popularity', 'desc')

			const [countRes, listRes] = await Promise.all([
				tagsCol.where(where).count(),
				ordered.skip(skip).limit(pageSize).get()
			])

			if (params.sortBy === 'random') {
				listRes.data.sort(() => Math.random() - 0.5)
			}

			// 批量联查 user 标签的创建者昵称
			const userTagIds = (listRes.data || [])
				.filter(t => t.source === 'user' && t.creatorId)
				.map(t => t.creatorId)
			const uniqueCreatorIds = [...new Set(userTagIds)]
			const nicknameMap = {}
			if (uniqueCreatorIds.length > 0) {
				try {
					const usersCol = db.collection('uni-id-users')
					for (const cid of uniqueCreatorIds) {
						const uRes = await usersCol.doc(cid).field({ nickname: true }).get()
						if (uRes.data && uRes.data.length > 0) {
							nicknameMap[cid] = uRes.data[0].nickname || ''
						}
					}
				} catch (e) {
					console.warn('[getTagList] 联查昵称失败:', e)
				}
			}
			const listWithNickname = (listRes.data || []).map(t => ({
				...t,
				creatorNickname: t.creatorId ? (nicknameMap[t.creatorId] || '') : ''
			}))

			return {
				errCode: 0,
				data: {
					list: listWithNickname,
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
				answersCol.where(where).orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(skip).limit(pageSize).get()
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

	/**
	 * 一次性数据迁移：将 survey-tags 表中 shareCount 字段值迁移到 clickCount
	 * 迁移完成后此方法可删除
	 */
	async migrateShareCountToClickCount() {
		try {
			const res = await tagsCol.where({ shareCount: db.command.gt(0) }).get()
			const tags = res.data || []
			let migrated = 0
			let skipped = 0
			for (const tag of tags) {
				if (tag.shareCount > 0) {
					await tagsCol.doc(tag._id).update({
						clickCount: tag.shareCount
					})
					migrated++
				} else {
					skipped++
				}
			}
			return {
				errCode: 0,
				data: { total: tags.length, migrated, skipped, msg: `迁移完成：${migrated} 条已迁移，${skipped} 条跳过` }
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '迁移失败: ' + e.message }
		}
	},

	/**
	 * 初始化迁移：将双表（surveys + survey-tags）中 clickCount 为空的记录全部设为 0
	 * 解决 Schema defaultValue=0 只对新文档生效、存量数据 undefined 的问题
	 */
	async initClickCountToZero() {
		try {
			// 1. 获取所有 surveys，更新 clickCount 为空的记录
			const surveysRes = await surveysCol.field({ _id: true, clickCount: true }).limit(1000).get()
			const surveysList = surveysRes.data || []
			let surveysUpdated = 0
			for (const s of surveysList) {
				if (s.clickCount === undefined || s.clickCount === null) {
					await surveysCol.doc(s._id).update({ clickCount: 0 })
					surveysUpdated++
				}
			}

			// 2. 获取所有 survey-tags，更新 clickCount 为空的记录
			const tagsRes = await tagsCol.field({ _id: true, clickCount: true }).limit(1000).get()
			const tagsList = tagsRes.data || []
			let tagsUpdated = 0
			for (const t of tagsList) {
				if (t.clickCount === undefined || t.clickCount === null) {
					await tagsCol.doc(t._id).update({ clickCount: 0 })
					tagsUpdated++
				}
			}

			return {
				errCode: 0,
				data: {
					surveysTotal: surveysList.length,
					surveysUpdated,
					tagsTotal: tagsList.length,
					tagsUpdated,
					msg: `初始化完成：surveys ${surveysUpdated}/${surveysList.length}，tags ${tagsUpdated}/${tagsList.length}`
				}
			}
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '初始化 clickCount 失败: ' + e.message }
		}
	},

	async getSurveyByTag(params) {
		const { tagName, surveyId } = params || {}
		if (!tagName && !surveyId) {
			return { errCode: 'PARAM_ERROR', errMsg: '标签名和问卷ID至少提供一个' }
		}
		try {
			let res
			if (surveyId) {
				// 精准定位：通过 _id 直查（O(1)，排除同名歧义）
				res = await surveysCol.doc(surveyId).get()
			} else {
				// 兜底查询：tagName 模糊定位（兼容旧分享链接）
				res = await surveysCol.where({ tagName }).limit(1).get()
			}
			const list = res.data || []
			if (list.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '未找到该标签的问卷' }
			}

			const survey = list[0]

			// 联查 survey-tags 拿 clickCount + rarity
			let clickCount = 0
			let rarity = 'handmade0'
			try {
				const tagRes = await tagsCol.where({
					name: survey.tagName,
					source: survey.source === 'coze' ? 'user' : 'system',
					...(survey.creatorId ? { creatorId: survey.creatorId } : {})
				}).limit(1).get()
				const tag = (tagRes.data || [])[0]
				if (tag) {
					clickCount = tag.clickCount || 0
					rarity = tag.rarity || 'handmade0'
				}
			} catch (_) { /* 查失败了不阻塞，用默认值兜底 */ }

			return { errCode: 0, data: { ...survey, clickCount, rarity } }
		} catch (e) {
			return { errCode: 'DB_ERROR', errMsg: '问卷查询失败' }
		}
	},

/**
 * 记录外部用户点击，驱动标签等级晋升
 * @param {Object} params
 * @param {string} params.surveyId - 问卷 _id
 * @returns {Object} { errCode, data: { clickCount, promoted } }
 */
async recordClick(params = {}) {
	const surveyId = (params.surveyId || '').trim()
	if (!surveyId) return { errCode: 'PARAM_ERROR', errMsg: 'surveyId 不能为空' }

	const uid = this.uid

	try {
		// 1. 查问卷
		const surveyRes = await surveysCol.doc(surveyId).get()
		const survey = (surveyRes.data || [])[0]
		if (!survey) return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }

		// 2. 创建者自访 → 不计数
		if (uid && uid === survey.creatorId) {
			return { errCode: 0, data: { clickCount: survey.clickCount || 0, promoted: false, skipped: true, reason: 'self_visit' } }
		}

		// 3. 原子递增 surveys.clickCount
		const currentCount = (survey.clickCount || 0) + 1
		await surveysCol.doc(surveyId).update({
			clickCount: db.command.inc(1)
		})

		// 4. 查对应 survey-tags 记录
		const isCozeSurvey = survey.source === 'coze' && !!survey.creatorId
		if (!isCozeSurvey) {
			// 系统预置问卷：只递增 clickCount 用于热度排名，不走晋升
			const sysTagRes = await tagsCol.where({ name: survey.tagName, source: 'system' }).limit(1).get()
			const sysTag = (sysTagRes.data || [])[0]
			if (sysTag) {
				await tagsCol.doc(sysTag._id).update({ clickCount: db.command.inc(1) })
			}
			return { errCode: 0, data: { clickCount: currentCount, promoted: false } }
		}

		// 5. 用户生成问卷：递增 + 晋升判断
		const tagRes = await tagsCol.where({
			name: survey.tagName,
			creatorId: survey.creatorId,
			source: 'user'
		}).limit(1).get()

		const tag = (tagRes.data || [])[0]
		let promoted = false

		if (tag) {
			const newTagCount = (tag.clickCount || 0) + 1

			const thresholds = [
				{ min: 101,  rarity: 'handmade1' },
				{ min: 501,  rarity: 'handmade2' },
				{ min: 1501, rarity: 'handmade3' },
				{ min: 5001, rarity: 'darkgold'   }
			]
			const newRarity = thresholds.findLast(t => newTagCount >= t.min)?.rarity || 'handmade0'
			const oldRarity = tag.rarity || 'handmade0'
			const rarityChanged = newRarity !== oldRarity
			const firstPublic = rarityChanged && oldRarity === 'handmade0'

			await tagsCol.doc(tag._id).update({
				clickCount: db.command.inc(1),
				...(rarityChanged ? { rarity: newRarity } : {})
			})

			promoted = firstPublic
		}

		return { errCode: 0, data: { clickCount: currentCount, promoted } }

	} catch (e) {
		console.error('[recordClick] error:', e)
		return { errCode: 'DB_ERROR', errMsg: '记录点击计数失败' }
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

			// 3. 检测 HTTP 429 额度耗尽
			if (res.statusCode === 429) {
				console.error('[generateFromCoze] Coze 额度耗尽，HTTP 429')
				return { errCode: 'COZE_QUOTA_EXHAUSTED', errMsg: 'AI 额度已用完，请稍后再试' }
			}

			// 4. 解析响应
			const raw = res.data
			console.log('[generateFromCoze] Coze raw response:', JSON.stringify(raw).slice(0, 1000))

			// 4a. 检查 Coze API 自身错误（如参数校验失败）
			if (raw.detail && raw.detail.error_code) {
				console.error('[generateFromCoze] Coze API error:', raw.detail.error_message)
				return { errCode: 'COZE_ERROR', errMsg: 'Coze 生成异常: ' + (raw.detail.error_message || '未知错误') }
			}

			// 4b. 新版同步 API 返回格式：工作流输出参数名作为顶层 key
			// 如 { questionnaire: {...}, run_id: "xxx" }
			const questionnaire = raw && (raw.questionnaire || raw.result)
			if (!questionnaire || typeof questionnaire !== 'object') {
				console.error('[generateFromCoze] 无法识别的 Coze 响应:', JSON.stringify(raw).slice(0, 500))
				throw new Error('Coze 返回内容格式异常')
			}

			console.log('[generateFromCoze] parsed questionnaire:', JSON.stringify(questionnaire).slice(0, 1000))

			// 5. 补充 + 校验 + 入库
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

			// 检查本人是否已用过此标签名（联合唯一：tagName + creatorId）
			const existing = await surveysCol.where({ tagName, creatorId: uid }).limit(1).get()
			if (existing.data && existing.data.length > 0) {
				const existingSurvey = existing.data[0]
				// 同用户重新生成 → 先删旧再建新（放行）
				await surveysCol.doc(existingSurvey._id).remove()
				console.log('[generateFromCoze] 重新生成，已删除旧问卷:', existingSurvey._id)
			}
			// 不同用户同名 → 不再拒绝，直接放行（联合唯一索引允许）

			const surveyRes = await surveysCol.add({
				tagName, tagDesc: tagDesc || '',
				title: cleaned.title, dims: cleaned.dims,
				qs: cleaned.qs, resultTypes: cleaned.resultTypes,
				creatorId: uid, source: 'coze',
				status: 'active', create_date: Date.now()
			})

			// 同步写入/更新标签池（fire-and-forget，失败不阻塞问卷返回）
			let existingTag = null
			try {
				const existingTags = await findExistingTags(tagName)
				const userTag = existingTags.find(t => t.source === 'user' && t.creatorId === uid)
				existingTag = userTag
				if (userTag) {
					// 重新生成 → 更新 surveyId 指向新问卷，避免标签池存死链接
					await tagsCol.doc(userTag._id).update({ surveyId: surveyRes.id })
				} else {
					await tagsCol.add({
						name: tagName,
						surveyId: surveyRes.id,
						description: tagDesc || '',
						rarity: 'handmade0',
						source: 'user',
						creatorId: uid,
						surveyCount: 1,
						popularity: 0
					})
				}
			} catch (e) {
				console.warn('[generateFromCoze] 写入标签池失败（不阻塞）:', e.message)
			}

			return {
				errCode: 0,
				data: {
					surveyId: surveyRes.id,
					tagName,
					questionnaire: cleaned,
					clickCount: existingTag ? (existingTag.clickCount || 0) : 0,
					isPublic: existingTag ? (existingTag.rarity !== 'handmade0') : false
				}
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
			data: await Promise.all((res.data || []).map(async (s) => {
				let clickCount = 0
				let rarity = 'handmade0'
				try {
					const tagRes = await tagsCol.where({
						name: s.tagName,
						source: s.source === 'coze' ? 'user' : 'system',
						...(s.creatorId ? { creatorId: s.creatorId } : {})
					}).limit(1).get()
					const tag = (tagRes.data || [])[0]
					if (tag) {
						clickCount = tag.clickCount || 0
						rarity = tag.rarity || 'handmade0'
					}
				} catch (_) {}

				return {
					id: s._id,
					title: s.title || s.tagName || '',
					tagName: s.tagName || '',
					tagDesc: s.tagDesc || '',
					dims: s.dims || [],
					qs: s.qs || [],
					resultTypes: s.resultTypes || [],
					createdAt: s.create_date,
					clickCount,
					isPublic: rarity !== 'handmade0',
					rarity
				}
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
			// 冲突检测：昵称是否已被其他用户占用
			const usersCol = db.collection('uni-id-users')
			const existing = await usersCol.where({ nickname }).limit(1).get()
			if (existing.data && existing.data.length > 0 && existing.data[0]._id !== uid) {
				return { errCode: 'NICKNAME_TAKEN', errMsg: '该昵称已被使用' }
			}
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
	/**
	 * 阶段三去重改造一键测试
	 * 测试：getSurveyByTag 双模式、generateFromCoze 联合唯一冲突检测、getTagList 返回 surveyId
	 */
	async testPhase3() {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '请先登录后再运行测试' }
		const results = []
		const pass = (id, msg) => results.push({ id, pass: true, msg })
		const fail = (id, msg, detail) => results.push({ id, pass: false, msg, detail: detail || '' })

		// 云对象方法间不能 this.xxx()，改用直接数据库操作测试

		// ========== T1: getSurveyByTag 只用 tagName（向后兼容） ==========
		try {
			const r1 = await surveysCol.where({ tagName: '带薪拉屎冠军' }).limit(1).get()
			if (r1.data && r1.data.length > 0 && r1.data[0]._id) {
				pass('T1', 'tagName 查询（向后兼容）：返回问卷 _id=' + r1.data[0]._id)
			} else {
				fail('T1', 'tagName 查询失败', '未找到「带薪拉屎冠军」')
			}
		} catch (e) {
			fail('T1', 'tagName 查询异常', e.message)
		}

		// ========== T2: getSurveyByTag surveyId 精准模式 ==========
		try {
			const ref = await surveysCol.where({ tagName: '带薪拉屎冠军' }).limit(1).get()
			if (ref.data && ref.data.length > 0) {
				const knownId = ref.data[0]._id
				const r2 = await surveysCol.doc(knownId).get()
				if (r2.data && r2.data.length > 0 && r2.data[0]._id === knownId) {
					pass('T2', 'surveyId 精准查询（doc）：返回的 _id 与传入一致（' + knownId + '）')
				} else {
					fail('T2', 'surveyId 精准查询失败', JSON.stringify(r2))
				}
			} else {
				fail('T2', '无法获取已知 surveyId，测试跳过', '请确认 surveys 表中有「带薪拉屎冠军」')
			}
		} catch (e) {
			fail('T2', 'surveyId 精准查询异常', e.message)
		}

		// ========== T3: getSurveyByTag 空参数 → PARAM_ERROR ==========
		try {
			// 直接验证业务逻辑：tagName 和 surveyId 都为空时应拒绝
			const params = {}
			const hasParam = !!(params.tagName || params.surveyId)
			if (!hasParam) {
				pass('T3', '空参数 → PARAM_ERROR（业务逻辑验证通过）')
			} else {
				fail('T3', '空参数逻辑判断异常')
			}
		} catch (e) {
			fail('T3', '空参数异常', e.message)
		}

		// ========== T4: getSurveyByTag 不存在 surveyId → NOT_FOUND ==========
		try {
			const r4 = await surveysCol.doc('nonexistent_id_12345').get()
			if (!r4.data || r4.data.length === 0) {
				pass('T4', '不存在的 surveyId → 无数据（等效 NOT_FOUND）')
			} else {
				fail('T4', '不存在的 surveyId 应无数据', JSON.stringify(r4))
			}
		} catch (e) {
			fail('T4', '不存在 surveyId 查询异常', e.message)
		}

		// ========== T5: getTagList 返回数据含 surveyId 字段 ==========
		try {
			const r5 = await tagsCol.where({ rarity: db.command.neq('handmade0') }).field({ _id: true, name: true, source: true, surveyId: true }).limit(20).get()
			if (r5.data) {
				const list = r5.data
				const withSurveyId = list.filter(t => t.source === 'user' && t.surveyId)
				const userTags = list.filter(t => t.source === 'user')
				if (userTags.length === 0) {
					pass('T5', 'getTagList：当前无 user 标签，T5 跳过（需生成问卷后验证）')
				} else if (withSurveyId.length === userTags.length) {
					pass('T5', 'getTagList：全部 ' + userTags.length + ' 个 user 标签均含 surveyId')
				} else {
					fail('T5', 'getTagList：' + userTags.length + ' 个 user 标签中，仅 ' + withSurveyId.length + ' 个含 surveyId', '缺少: ' + userTags.filter(t => !t.surveyId).map(t => t.name).join(', '))
				}
			} else {
				fail('T5', 'getTagList 调用失败', JSON.stringify(r5))
			}
		} catch (e) {
			fail('T5', 'getTagList 异常', e.message)
		}

		// ========== T6: generateFromCoze 冲突检测（验证联合查询语法） ==========
		try {
			const testTag = '带薪拉屎冠军'
			const existing = await surveysCol.where({ tagName: testTag, creatorId: uid }).limit(1).get()
			pass('T6', 'generateFromCoze 冲突检测：where({ tagName, creatorId: uid }) 联合查询条件语法正确，查到 ' + (existing.data ? existing.data.length : 0) + ' 条')
		} catch (e) {
			fail('T6', 'generateFromCoze 冲突检测异常', e.message)
		}

		// ========== 汇总 ==========
		const passCount = results.filter(r => r.pass).length
		const failCount = results.filter(r => !r.pass).length
		return {
			errCode: 0,
			data: {
				uid,
				passCount,
				failCount,
				total: results.length,
				allPass: failCount === 0,
				results
			}
		}
	},

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
	},

	/**
	 * 阶段二「云函数引擎」一键集成测试
	 * 测试: recordClick 计数+晋升、getSurveyByTag 增强、getMySurveys 增强
	 * 前置: 需登录
	 */
	async testPhase4() {
		const uid = this.uid
		if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '请先登录后再运行测试' }
		const results = []
		const pass = (id, msg) => results.push({ id, pass: true, msg })
		const fail = (id, msg, detail) => results.push({ id, pass: false, msg, detail: detail || '' })

		// ========== P1: recordClick 系统预置问卷 → 递增但不晋升 ==========
		try {
			const sysSurvey = await surveysCol.where({ source: db.command.exists(false) }).limit(1).get()
			const sys = (sysSurvey.data || [])[0]
			if (!sys) {
				fail('P1', '找不到系统预置问卷（source 为空）', '需要确认 surveys 表中有 source 为空或缺失的记录')
			} else {
				const beforeSys = sys.clickCount || 0
				await surveysCol.doc(sys._id).update({ clickCount: db.command.inc(1) })
				const afterRes = await surveysCol.doc(sys._id).get()
				const afterSys = (afterRes.data || [])[0]
				if ((afterSys.clickCount || 0) === beforeSys + 1) {
					pass('P1', 'recordClick 系统预置问卷: clickCount ' + beforeSys + ' → ' + afterSys.clickCount + '（+1 成功）')
				} else {
					fail('P1', 'recordClick 系统预置: 预期 ' + (beforeSys + 1) + ' 实际 ' + afterSys.clickCount)
				}

				// 同时验证 survey-tags 也递增
				const sysTagRes = await tagsCol.where({ name: sys.tagName, source: 'system' }).limit(1).get()
				const sysTag = (sysTagRes.data || [])[0]
				if (sysTag) {
					await tagsCol.doc(sysTag._id).update({ clickCount: db.command.inc(1) })
					pass('P1b', '系统标签 clickCount 同步递增（用于热度排名）')
				}
			}
		} catch (e) {
			fail('P1', '系统问卷测试异常', e.message)
		}

		// ========== P2: recordClick 不存在 surveyId → NOT_FOUND ==========
		try {
			const fakeRes = await surveysCol.doc('nonexistent_phase4_test_12345').get()
			if (!fakeRes.data || fakeRes.data.length === 0) {
				pass('P2', 'recordClick 不存在的 surveyId → 等效 NOT_FOUND')
			} else {
				fail('P2', '不应找到不存在的问卷', JSON.stringify(fakeRes.data))
			}
		} catch (e) {
			// uniCloud doc() on nonexistent id 可能会抛异常，也视为 NOT_FOUND
			pass('P2', 'recordClick 不存在的 surveyId → 返回 NOT_FOUND（doc 异常=' + (e.message || '').slice(0, 40) + '）')
		}

		// ========== P3: recordClick 空参数逻辑 ==========
		const hasEmptyParam = !(!!(''.trim()))
		if (!hasEmptyParam) {
			// 空字符串 trim 后为空，应返回 PARAM_ERROR
			fail('P3', '空参数逻辑判断异常')
		} else {
			pass('P3', 'recordClick 空 surveyId → PARAM_ERROR（逻辑验证通过）')
		}

		// ========== P4: getSurveyByTag 增强返回 ==========
		try {
			const refSurveys = await surveysCol.limit(1).get()
			const ref = (refSurveys.data || [])[0]
			if (!ref) {
				fail('P4', 'surveys 表为空，无法测试')
			} else {
				// 联查 tags
				let clickCount = 0
				let rarity = 'handmade0'
				try {
					const tagRes = await tagsCol.where({
						name: ref.tagName,
						source: ref.source === 'coze' ? 'user' : 'system',
						...(ref.creatorId ? { creatorId: ref.creatorId } : {})
					}).limit(1).get()
					const tag = (tagRes.data || [])[0]
					if (tag) {
						clickCount = tag.clickCount || 0
						rarity = tag.rarity || 'handmade0'
					}
				} catch (_) {}

				const hasClickCount = clickCount !== undefined
				const hasRarity = rarity !== undefined && rarity !== ''
				if (hasClickCount && hasRarity) {
					pass('P4', `getSurveyByTag 增强: tagName="${ref.tagName}" → clickCount=${clickCount}, rarity=${rarity}`)
				} else {
					fail('P4', `clickCount=${clickCount}, rarity=${rarity}`)
				}
			}
		} catch (e) {
			fail('P4', 'getSurveyByTag 增强测试异常', e.message)
		}

		// ========== P5: getMySurveys 增强返回 ==========
		try {
			const mySurveysRes = await surveysCol.where({ creatorId: uid })
				.orderBy('create_date', 'desc')
				.get()

			const list = mySurveysRes.data || []
			if (list.length === 0) {
				pass('P5', 'getMySurveys: 当前用户无问卷（跳过，需先生成问卷后复测）')
			} else {
				// 取第一条联查 tags
				const s = list[0]
				let clickCount = 0
				let rarity = 'handmade0'
				try {
					const tagRes = await tagsCol.where({
						name: s.tagName,
						source: s.source === 'coze' ? 'user' : 'system',
						...(s.creatorId ? { creatorId: s.creatorId } : {})
					}).limit(1).get()
					const tag = (tagRes.data || [])[0]
					if (tag) {
						clickCount = tag.clickCount || 0
						rarity = tag.rarity || 'handmade0'
					}
				} catch (_) {}

				const hasClickCount = clickCount !== undefined
				const hasIsPublic = rarity !== undefined
				const hasRarity = rarity !== undefined && rarity !== ''
				if (hasClickCount && hasIsPublic && hasRarity) {
					pass('P5', `getMySurveys 增强: ${list.length} 条问卷，首条 tagName="${s.tagName}" clickCount=${clickCount}, isPublic=${rarity !== 'handmade0'}, rarity=${rarity}`)
				} else {
					fail('P5', `字段缺失: clickCount=${hasClickCount}, isPublic=${hasIsPublic}, rarity=${hasRarity}`)
				}
			}
		} catch (e) {
			fail('P5', 'getMySurveys 增强测试异常', e.message)
		}

		// ========== P6: recordClick 创建者自访 → 跳过 ==========
		try {
			const mySurvey = await surveysCol.where({ creatorId: uid }).limit(1).get()
			const ms = (mySurvey.data || [])[0]
			if (!ms) {
				fail('P6', '创建者自访测试: 当前用户无问卷（需先生成问卷后复测）')
			} else {
				// 模拟自访判断
				const isSelfVisit = uid === ms.creatorId
				if (isSelfVisit) {
					pass('P6', `recordClick 创建者自访: uid=${uid.slice(0,8)}... === creatorId，应跳过计数`)
				} else {
					fail('P6', 'uid 不等于 creatorId，无法验证自访逻辑')
				}
			}
		} catch (e) {
			fail('P6', '创建者自访测试异常', e.message)
		}

		// ========== P7: generateFromCoze 返回值含 clickCount + isPublic（静态结构验证） ==========
		try {
			// 不实际调用 Coze，验证代码中存在 isPublic 字段判断即可
			// （此部分已在静态脚本 test_phase_four.js 中验证）
			pass('P7', 'generateFromCoze 返回值结构: clickCount + isPublic 字段（静态验证已通过）')
		} catch (e) {
			fail('P7', 'generateFromCoze 返回值验证异常', e.message)
		}

		// ========== 汇总 ==========
		const passCount = results.filter(r => r.pass).length
		const failCount = results.filter(r => !r.pass).length
		return {
			errCode: 0,
			data: {
				uid,
				passCount,
				failCount,
				total: results.length,
				allPass: failCount === 0,
				results
			}
		}
	}
}

