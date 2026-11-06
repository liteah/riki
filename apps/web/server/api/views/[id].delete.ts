import { db } from '#server/utils/db'
import { sidebar, views } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { compactSidebar } from '#server/utils/sidebar'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Views'],
		description: 'Deletes a saved view and removes any of its sidebar pins.',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'View id.',
			},
		],
		responses: {
			200: {
				description: 'The view was deleted.',
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
				description: 'The view is missing or not yours.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)

	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Validation failed' })

	const [view] = await db
		.delete(views)
		.where(and(eq(views.id, id), eq(views.userId, user.id)))
		.returning()
	if (!view) throw createError({ statusCode: 404, statusMessage: 'View not found' })

	await db
		.delete(sidebar)
		.where(and(eq(sidebar.userId, user.id), eq(sidebar.kind, 'view'), eq(sidebar.targetId, id)))
	await compactSidebar(user.id)

	return { id }
})
