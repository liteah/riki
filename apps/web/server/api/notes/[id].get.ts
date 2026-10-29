import { db } from '#server/utils/db'
import { notes, user } from '#server/db/schemas'
import { noteStatus, noteVisibility } from '#shared/types/note'
import { requireUser } from '#server/utils/session'
import { and, eq, getColumns, inArray, ne, or } from 'drizzle-orm'

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
