import { db } from '#server/utils/db'
import { noteTags, notes } from '#server/db/schemas'
import { requireUser } from '#server/utils/session'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Notes'],
		description:
			'Permanently deletes a note you own, along with its tag links. This is not idempotent: a second call returns 404.',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Note id.',
			},
		],
		responses: {
			200: {
				description: 'The note was deleted.',
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
				description: 'The note is missing or not yours.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)

	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Validation failed' })

	const existing = await db
		.select({ id: notes.id })
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, user.id)))
		.limit(1)
	if (!existing.length) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

	await db.batch([
		db.delete(noteTags).where(eq(noteTags.noteId, id)),
		db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, user.id))),
	])

	return { id }
})
