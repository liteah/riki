import { db } from '#server/utils/db'
import { noteTags, notes, user } from '#server/db/schemas'
import { noteStatus } from '#shared/types/note'
import { requireUser } from '#server/utils/session'
import { readQueryZod } from '#server/utils/validation'
import { and, eq, getColumns, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

defineRouteMeta({
	openAPI: {
		tags: ['Notes'],
		description:
			'Returns a random sample of your own non-archived notes (normal, later, pinned), suitable for a daily review.',
		parameters: [
			{
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 24, default: 12 },
				description: 'Number of notes to return.',
			},
		],
		responses: {
			200: {
				description: 'Random notes for review.',
				content: {
					'application/json': { schema: { $ref: '#/components/schemas/ListNotesResponse' } },
				},
			},
			400: {
				description: 'The query failed validation.',
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
	const currentUser = await requireUser(event)
	const query = await readQueryZod(
		event,
		z.object({
			limit: z.coerce.number().int().min(1).max(24).default(12),
		}),
	)

	const where = and(
		eq(notes.userId, currentUser.id),
		inArray(notes.status, [noteStatus.normal, noteStatus.later, noteStatus.pinned]),
		eq(user.banned, false),
	)

	const rows = await db
		.select({
			...getColumns(notes),
		})
		.from(notes)
		.innerJoin(user, eq(user.id, notes.userId))
		.where(where)
		.orderBy(sql`random()`)
		.limit(query.limit)

	const tagRows = rows.length
		? await db
				.select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
				.from(noteTags)
				.where(
					inArray(
						noteTags.noteId,
						rows.map((row) => row.id),
					),
				)
		: []

	const tagIdsByNote = new Map<string, string[]>()
	for (const row of tagRows) {
		const list = tagIdsByNote.get(row.noteId)
		if (list) list.push(row.tagId)
		else tagIdsByNote.set(row.noteId, [row.tagId])
	}

	const items = rows.map((row) => ({
		...row,
		tagIds: tagIdsByNote.get(row.id) ?? [],
	}))

	return {
		items,
		nextCursor: null,
		total: items.length,
	}
})
