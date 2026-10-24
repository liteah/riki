import { db } from '#server/utils/db'
import { noteTags, notes, spaces, user, views } from '#server/db/schemas'
import { listNotesQuerySchema, noteStatus, noteVisibility } from '#shared/types/note'
import type { ViewFilter } from '#shared/types/view'
import { getSessionUser } from '#server/utils/session'
import { normalizeViewFilter } from '#server/utils/view-filter'
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
	not,
	notExists,
	notInArray,
	or,
	sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

export function encodeNoteCursor(createdAt: Date, id: string, pinned: boolean): string {
	return `${createdAt.getTime()}:${id}:${pinned ? 1 : 0}`
}

function viewFilterCondition(
	filter: ViewFilter,
	viewsById: Map<string, ViewFilter>,
	depth = 0,
): SQL {
	const statuses = filter.status?.length
		? filter.status
		: [noteStatus.normal, noteStatus.later, noteStatus.pinned]
	const conditions: SQL[] = [inArray(notes.status, statuses)]
	const spaceConditions: SQL[] = []
	if (filter.spaceIds?.length) spaceConditions.push(inArray(notes.spaceId, filter.spaceIds))
	if (filter.spaceId === null) spaceConditions.push(isNull(notes.spaceId))
	else if (filter.spaceId) spaceConditions.push(eq(notes.spaceId, filter.spaceId))
	if (spaceConditions.length) conditions.push(or(...spaceConditions)!)
	if (filter.notSpaceIds?.length) {
		conditions.push(or(isNull(notes.spaceId), notInArray(notes.spaceId, filter.notSpaceIds))!)
	}
	if (filter.notStatus?.length) conditions.push(notInArray(notes.status, filter.notStatus))
	if (filter.tagIds?.length) {
		conditions.push(
			and(
				...filter.tagIds.map((tagId) =>
					exists(
						db
							.select({ one: sql`1` })
							.from(noteTags)
							.where(and(eq(noteTags.noteId, notes.id), eq(noteTags.tagId, tagId))),
					),
				),
			)!,
		)
	}
	if (filter.notTagIds?.length) {
		conditions.push(
			and(
				...filter.notTagIds.map((tagId) =>
					notExists(
						db
							.select({ one: sql`1` })
							.from(noteTags)
							.where(and(eq(noteTags.noteId, notes.id), eq(noteTags.tagId, tagId))),
					),
				),
			)!,
		)
	}
	if (filter.visibility?.length) conditions.push(inArray(notes.visibility, filter.visibility))
	if (filter.notVisibility?.length) {
		conditions.push(notInArray(notes.visibility, filter.notVisibility))
	}
	if (filter.q) conditions.push(like(notes.content, `%${filter.q.replace(/[%_]/g, '')}%`))
	if (filter.viewIds?.length && depth < 3) {
		const nested = filter.viewIds
			.map((id) => viewsById.get(id))
			.filter((item): item is ViewFilter => Boolean(item))
		conditions.push(
			nested.length
				? or(...nested.map((item) => viewFilterCondition(item, viewsById, depth + 1)))!
				: sql`0`,
		)
	}
	if (filter.notViewIds?.length && depth < 3) {
		const nested = filter.notViewIds
			.map((id) => viewsById.get(id))
			.filter((item): item is ViewFilter => Boolean(item))
		if (nested.length) {
			conditions.push(
				not(or(...nested.map((item) => viewFilterCondition(item, viewsById, depth + 1)))!)!,
			)
		}
	}
	return and(...conditions)!
}

export default defineEventHandler(async (event) => {
	const query = await readQueryZod(event, listNotesQuerySchema)
	const viewerId = (await getSessionUser(event))?.id ?? null

	const viewsById = new Map<string, ViewFilter>()
	if ((query.viewIds?.length || query.notViewIds?.length) && viewerId) {
		const rows = await db
			.select({ id: views.id, filter: views.filter })
			.from(views)
			.where(eq(views.userId, viewerId))
		for (const row of rows) viewsById.set(row.id, normalizeViewFilter(row.filter))
	}
	const selectedViewFilters =
		query.viewIds
			?.map((id) => viewsById.get(id))
			.filter((filter): filter is ViewFilter => Boolean(filter)) ?? []
	const viewCondition = query.viewIds?.length
		? selectedViewFilters.length
			? or(...selectedViewFilters.map((filter) => viewFilterCondition(filter, viewsById)))
			: sql`0`
		: undefined
	const excludedViewFilters =
		query.notViewIds
			?.map((id) => viewsById.get(id))
			.filter((filter): filter is ViewFilter => Boolean(filter)) ?? []
	const notViewCondition =
		query.notViewIds?.length && excludedViewFilters.length
			? not(or(...excludedViewFilters.map((filter) => viewFilterCondition(filter, viewsById)))!)
			: undefined

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

	const statusFilter = query.status?.length
		? inArray(notes.status, query.status)
		: query.viewIds?.length && !query.noTags
			? undefined
			: inArray(notes.status, defaultStatuses)

	const where = and(
		readable,
		statusFilter,
		viewCondition,
		notViewCondition,
		eq(user.banned, false),
		query.noSpace || query.spaceIds?.length || query.spaceId
			? or(
					...(query.noSpace ? [isNull(notes.spaceId)] : []),
					...(query.spaceIds?.length ? [inArray(notes.spaceId, query.spaceIds)] : []),
					...(query.spaceId ? [eq(notes.spaceId, query.spaceId)] : []),
				)!
			: undefined,
		query.notSpaceIds?.length
			? or(isNull(notes.spaceId), notInArray(notes.spaceId, query.notSpaceIds))!
			: undefined,
		query.noTags
			? notExists(
					db
						.select({ one: sql`1` })
						.from(noteTags)
						.where(eq(noteTags.noteId, notes.id)),
				)
			: undefined,
		query.username ? eq(user.username, query.username.toLowerCase()) : undefined,
		query.notStatus?.length ? notInArray(notes.status, query.notStatus) : undefined,
		query.visibility?.length ? inArray(notes.visibility, query.visibility) : undefined,
		query.notVisibility?.length ? notInArray(notes.visibility, query.notVisibility) : undefined,
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
		query.notTagIds?.length
			? and(
					...query.notTagIds.map((tagId) =>
						notExists(
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
				spaceIcon: spaces.icon,
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
		spaceIcon: row.userId === viewerId ? row.spaceIcon : null,
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
