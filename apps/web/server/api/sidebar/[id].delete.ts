import { db } from '#server/utils/db'
import { sidebar } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { compactSidebar } from '#server/utils/sidebar'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Sidebar'],
		description: 'Removes a sidebar pin and renumbers the remaining entries.',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Sidebar entry id.',
			},
		],
		responses: {
			200: {
				description: 'The sidebar pin was removed.',
				content: {
					'application/json': {
						schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
					},
				},
			},
			400: {
				description: 'The id failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			404: {
				description: 'The sidebar entry is missing or not yours.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)

	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Validation failed' })

	const [removed] = await db
		.delete(sidebar)
		.where(and(eq(sidebar.id, id), eq(sidebar.userId, user.id)))
		.returning()

	if (!removed) throw createError({ statusCode: 404, statusMessage: 'Sidebar item not found' })
	await compactSidebar(user.id)
	return { id }
})
