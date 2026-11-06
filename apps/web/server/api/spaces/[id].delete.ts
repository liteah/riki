import { db } from '#server/utils/db'
import { notes, spaces } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Spaces'],
		description: 'Deletes a space. Your notes in the space are kept and become unassigned.',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Space id.',
			},
		],
		responses: {
			200: {
				description: 'The space was deleted.',
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
				description: 'The space is missing or not yours.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Validation failed' })

	const scope = and(eq(spaces.id, id), eq(spaces.userId, user.id))

	const [existing] = await db.select({ id: spaces.id }).from(spaces).where(scope).limit(1)
	if (!existing) throw createError({ statusCode: 404, statusMessage: 'Space not found' })

	await db.batch([
		db
			.update(notes)
			.set({ spaceId: null })
			.where(and(eq(notes.spaceId, id), eq(notes.userId, user.id))),
		db.delete(spaces).where(scope),
	])

	return { id }
})
