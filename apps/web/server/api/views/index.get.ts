import { db } from '#server/utils/db'
import { views } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { normalizeViewFilter } from '#server/utils/view-filter'
import { asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const rows = await db
		.select()
		.from(views)
		.where(eq(views.userId, user.id))
		.orderBy(asc(views.position), asc(views.createdAt))
	return rows.map((view) => ({
		...view,
		filter: normalizeViewFilter(view.filter),
	}))
})
