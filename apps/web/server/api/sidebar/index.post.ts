import { db } from '#server/utils/db'
import { sidebar } from '#server/db/schemas'
import { pinSidebarBodySchema } from '#shared/types/view'
import { requireUser } from '#server/utils/session'
import { readBodyZod } from '#server/utils/validation'
import { asc, eq, sql } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Sidebar'],
		description:
			'Pins a view, space, or tag to the bottom of your sidebar. Duplicate pins are ignored.',
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/SidebarPinRequest' },
				},
			},
		},
		responses: {
			200: {
				description: 'The full sidebar after the pin is added.',
				content: {
					'application/json': {
						schema: { type: 'array', items: { $ref: '#/components/schemas/SidebarEntry' } },
					},
				},
			},
			400: {
				description: 'The body failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
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
	const body = await readBodyZod(event, pinSidebarBodySchema)

	const [max] = await db
		.select({ position: sql<number | null>`max(${sidebar.position})` })
		.from(sidebar)
		.where(eq(sidebar.userId, user.id))

	await db
		.insert(sidebar)
		.values({
			userId: user.id,
			kind: body.kind,
			targetId: body.targetId,
			position: (max?.position ?? -1) + 1,
		})
		.onConflictDoNothing()

	return db.select().from(sidebar).where(eq(sidebar.userId, user.id)).orderBy(asc(sidebar.position))
})
