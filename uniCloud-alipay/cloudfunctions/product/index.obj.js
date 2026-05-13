const db = uniCloud.database()
const dbCmd = db.command
const productCol = db.collection('opendb-news-articles')

module.exports = {
	_before() {
		this.timestamp = Date.now()
	},

	async getDetail({ id }) {
		if (!id) {
			return { errCode: 'PARAM_IS_NULL', errMsg: '商品ID不能为空' }
		}
		const res = await productCol.doc(id).get()
		if (!res.data || !res.data.length) {
			return { errCode: 'NOT_FOUND', errMsg: '商品不存在' }
		}
		const product = res.data[0]
		if (product.article_status !== 1) {
			return { errCode: 'OFF_SHELF', errMsg: '商品已下架' }
		}
		await productCol.doc(id).update({ view_count: dbCmd.inc(1) })
		return { errCode: 0, data: product }
	},

	async getList({ category_id, page = 1, pageSize = 10, keyword } = {}) {
		const where = { article_status: 1 }
		if (category_id) where.category_id = category_id
		if (keyword) where.title = new RegExp(keyword, 'i')
		const skip = (page - 1) * pageSize
		const [countRes, listRes] = await Promise.all([
			productCol.where(where).count(),
			productCol.where(where)
				.field('_id,title,avatar,price,original_price,sales_count,excerpt,category_id,is_sticky,is_essence,publish_date')
				.orderBy('is_sticky desc', 'publish_date desc')
				.skip(skip)
				.limit(pageSize)
				.get()
		])
		return {
			errCode: 0,
			data: {
				list: listRes.data,
				total: countRes.total,
				page,
				pageSize,
				totalPage: Math.ceil(countRes.total / pageSize)
			}
		}
	},

	async addProduct(data) {
		const tokenExpired = uniCloud.getCurrentUserInfo().tokenExpired
		if (tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		const productData = {
			user_id: uniCloud.getCurrentUserInfo().uid,
			title: data.title,
			content: data.content || '',
			excerpt: data.excerpt || '',
			price: data.price || 0,
			original_price: data.original_price || 0,
			images: data.images || [],
			avatar: data.avatar || (data.images && data.images[0]) || '',
			sales_count: 0,
			stock: data.stock || 0,
			specs: data.specs || [],
			freight: data.freight || 0,
			article_status: data.article_status !== undefined ? data.article_status : 0,
			view_count: 0,
			like_count: 0,
			comment_count: 0,
			is_sticky: false,
			is_essence: false,
			comment_status: 1,
			publish_date: this.timestamp,
			last_modify_date: this.timestamp
		}
		if (data.category_id) productData.category_id = data.category_id
		const res = await productCol.add(productData)
		return { errCode: 0, data: { id: res.id } }
	},

	async updateProduct({ id, ...data }) {
		if (!id) return { errCode: 'PARAM_IS_NULL', errMsg: '商品ID不能为空' }
		const tokenExpired = uniCloud.getCurrentUserInfo().tokenExpired
		if (tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		const product = await productCol.doc(id).get()
		if (!product.data || !product.data.length) {
			return { errCode: 'NOT_FOUND', errMsg: '商品不存在' }
		}
		if (product.data[0].user_id !== uniCloud.getCurrentUserInfo().uid) {
			return { errCode: 'FORBIDDEN', errMsg: '无权修改此商品' }
		}
		const updateData = { last_modify_date: this.timestamp }
		const allowFields = ['title', 'content', 'excerpt', 'price', 'original_price', 'images', 'avatar', 'stock', 'specs', 'freight', 'article_status', 'category_id', 'comment_status']
		allowFields.forEach(field => {
			if (data[field] !== undefined) updateData[field] = data[field]
		})
		if (updateData.images && updateData.images.length && !updateData.avatar) {
			updateData.avatar = updateData.images[0]
		}
		await productCol.doc(id).update(updateData)
		return { errCode: 0, errMsg: '修改成功' }
	},

	async deleteProduct({ id }) {
		if (!id) return { errCode: 'PARAM_IS_NULL', errMsg: '商品ID不能为空' }
		const tokenExpired = uniCloud.getCurrentUserInfo().tokenExpired
		if (tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		const product = await productCol.doc(id).get()
		if (!product.data || !product.data.length) {
			return { errCode: 'NOT_FOUND', errMsg: '商品不存在' }
		}
		if (product.data[0].user_id !== uniCloud.getCurrentUserInfo().uid) {
			return { errCode: 'FORBIDDEN', errMsg: '无权删除此商品' }
		}
		await productCol.doc(id).remove()
		return { errCode: 0, errMsg: '删除成功' }
	},

	async toggleOnShelf({ id, status }) {
		if (!id) return { errCode: 'PARAM_IS_NULL', errMsg: '商品ID不能为空' }
		if (status === undefined) return { errCode: 'PARAM_IS_NULL', errMsg: '状态不能为空' }
		const tokenExpired = uniCloud.getCurrentUserInfo().tokenExpired
		if (tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		await productCol.doc(id).update({
			article_status: status ? 1 : 0,
			last_modify_date: this.timestamp
		})
		return { errCode: 0, errMsg: status ? '上架成功' : '下架成功' }
	},


}
