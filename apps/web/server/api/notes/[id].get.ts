import { db } from '#server/utils/db'
import { notes, user } from '#server/db/schemas'
import { noteStatus, noteVisibility } from '#shared/types/note'
import { requireUser } from '#server/utils/session'
import { and, eq, getColumns, inArray, ne, or } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Notes'],
		description:
			'Fetches one note. Owners always see their note. Others only see non-archived public or protected notes; private notes and missing/foreign notes all return the same 404.',
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
				description: 'The note.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Note' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			404: {
				description: 'The note is missing or not visible to you.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const viewer = await requireUser(event)
	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

	const [note] = await db
		.select(getColumns(notes))
		.from(notes)
		.innerJoin(user, eq(user.id, notes.userId))
		.where(
			and(
				eq(notes.id, id),
				or(
					eq(notes.userId, viewer.id),
					and(
						inArray(notes.visibility, [noteVisibility.public, noteVisibility.protected]),
						ne(notes.status, noteStatus.archived),
					),
				),
				eq(user.banned, false),
			),
		)
		.limit(1)

	if (!note) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

	return note
})
