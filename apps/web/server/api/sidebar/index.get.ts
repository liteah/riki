import { db } from '#server/utils/db'
import { sidebar } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { asc, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Sidebar'],
		description: 'Lists your pinned sidebar entries (views, spaces, and tags) in order.',
		responses: {
			200: {
				description: 'Your sidebar entries.',
				content: {
					'application/json': {
						schema: { type: 'array', items: { $ref: '#/components/schemas/SidebarEntry' } },
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
	return db.select().from(sidebar).where(eq(sidebar.userId, user.id)).orderBy(asc(sidebar.position))
})
