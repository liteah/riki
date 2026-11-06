import { db } from '#server/utils/db'
import { views } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { normalizeViewFilter } from '#server/utils/view-filter'
import { asc, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Views'],
		description:
			'Lists your saved views in sidebar order. Filters are normalized before being returned.',
		responses: {
			200: {
				description: 'Your views.',
				content: {
					'application/json': {
						schema: { type: 'array', items: { $ref: '#/components/schemas/View' } },
					},
				},
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

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
