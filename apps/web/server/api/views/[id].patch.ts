import { db } from '#server/utils/db'
import { views } from '#server/db/schemas'
import { updateViewBodySchema } from '#shared/types/view'
import { requireUser } from '#server/utils/session'
import { readBodyZod } from '#server/utils/validation'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Views'],
		description:
			'Updates a saved view. All fields are optional; the stored filter is returned as-is (not normalized).',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'View id.',
			},
		],
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/ViewUpdateRequest' },
				},
			},
		},
		responses: {
			200: {
				description: 'The updated view.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/View' } } },
			},
			400: {
				description: 'The id or body failed validation.',
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

	const body = await readBodyZod(event, updateViewBodySchema)

	const [updated] = await db
		.update(views)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.icon !== undefined && { icon: body.icon }),
			...(body.filter !== undefined && { filter: body.filter }),
		})
		.where(and(eq(views.id, id), eq(views.userId, user.id)))
		.returning()

	if (!updated) throw createError({ statusCode: 404, statusMessage: 'View not found' })
	return updated
})
