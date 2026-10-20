import { db } from '#server/utils/db'
import { noteTags, notes, spaces, user } from '#server/db/schemas'
import { listNotesQuerySchema, noteStatus, noteVisibility } from '#shared/types/note'
import { getSessionUser } from '#server/utils/session'
import { readQueryZod } from '#server/utils/validation'
import {
	and,
	count,
	desc,
	eq,
	exists,
	getColumns,
	inArray,
	isNull,
	like,
	lt,
	ne,
	notExists,
	or,
	sql,
} from 'drizzle-orm'

export function encodeNoteCursor(createdAt: Date, id: string, pinned: boolean): string {
	return `${createdAt.getTime()}:${id}:${pinned ? 1 : 0}`
}

export default defineEventHandler(async (event) => {
	const query = await readQueryZod(event, listNotesQuerySchema)
	const viewerId = (await getSessionUser(event))?.id ?? null

	const pinnedFlag = sql<number>`case when ${notes.status} = ${noteStatus.pinned} then 1 else 0 end`

	const cursorFilter = query.cursor
		? or(
				lt(pinnedFlag, query.cursor.pinned ? 1 : 0),
				and(
					eq(pinnedFlag, query.cursor.pinned ? 1 : 0),
					or(
						lt(notes.createdAt, query.cursor.createdAt),
						and(eq(notes.createdAt, query.cursor.createdAt), lt(notes.id, query.cursor.id)),
					),
				),
			)
		: undefined

	const readable = query.explore
		? viewerId
			? and(ne(notes.userId, viewerId), eq(notes.visibility, noteVisibility.public))
			: eq(notes.visibility, noteVisibility.public)
		: viewerId
			? query.visibility?.length
				? or(
						eq(notes.userId, viewerId),
						and(ne(notes.userId, viewerId), ne(notes.visibility, noteVisibility.private)),
					)
				: eq(notes.userId, viewerId)
			: eq(notes.visibility, noteVisibility.public)

	// The untagged inbox feed is the triage queue: a deferred note belongs to the later feed.
	const defaultStatuses = query.noTags
		? [noteStatus.normal, noteStatus.pinned]
		: [noteStatus.normal, noteStatus.later, noteStatus.pinned]

	const statusFilter = query.pinnedOnly
		? eq(notes.status, noteStatus.pinned)
		: query.status
			? eq(notes.status, query.status)
			: inArray(notes.status, defaultStatuses)

	const where = and(
		readable,
		statusFilter,
		eq(user.banned, false),
		query.noSpace ? isNull(notes.spaceId) : undefined,
		query.noTags
			? notExists(
					db
						.select({ one: sql`1` })
						.from(noteTags)
						.where(eq(noteTags.noteId, notes.id)),
				)
			: undefined,
		query.spaceId ? eq(notes.spaceId, query.spaceId) : undefined,
		query.username ? eq(user.username, query.username.toLowerCase()) : undefined,
		query.visibility?.length ? inArray(notes.visibility, query.visibility) : undefined,
		query.q ? like(notes.content, `%${query.q.replace(/[%_]/g, '')}%`) : undefined,
		query.tagIds?.length
			? and(
					...query.tagIds.map((tagId) =>
						exists(
							db
								.select({ one: sql`1` })
								.from(noteTags)
								.where(and(eq(noteTags.noteId, notes.id), eq(noteTags.tagId, tagId))),
						),
					),
				)
			: undefined,
	)

	const [rows, [totalRow]] = await Promise.all([
		db
			.select({
				...getColumns(notes),
				spaceName: spaces.name,
				authorName: user.name,
				authorImage: user.image,
			})
			.from(notes)
			.leftJoin(spaces, eq(spaces.id, notes.spaceId))
			.innerJoin(user, eq(user.id, notes.userId))
			.where(and(cursorFilter, where))
			.orderBy(desc(pinnedFlag), desc(notes.createdAt), desc(notes.id))
			.limit(query.limit + 1),
		db
			.select({ count: count() })
			.from(notes)
			.innerJoin(user, eq(user.id, notes.userId))
			.where(where),
	])

	const page = rows.slice(0, query.limit)
	const tagRows = page.length
		? await db
				.select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
				.from(noteTags)
				.where(
					inArray(
						noteTags.noteId,
						page.map((row) => row.id),
					),
				)
		: []
	const tagIdsByNote = new Map<string, string[]>()
	for (const row of tagRows) {
		const list = tagIdsByNote.get(row.noteId)
		if (list) list.push(row.tagId)
		else tagIdsByNote.set(row.noteId, [row.tagId])
	}
	const items = page.map((row) => ({
		...row,
		spaceName: row.userId === viewerId ? row.spaceName : null,
		tagIds: tagIdsByNote.get(row.id) ?? [],
	}))
	const last = items[items.length - 1]
	return {
		items,
		nextCursor:
			rows.length > query.limit && last
				? encodeNoteCursor(last.createdAt, last.id, last.status === noteStatus.pinned)
				: null,
		total: totalRow?.count ?? 0,
	}
})
