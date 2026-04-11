export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}
