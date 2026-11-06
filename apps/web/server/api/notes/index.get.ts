import { db } from '#server/utils/db'
import { noteTags, notes, user, views } from '#server/db/schemas'
import { listNotesQuerySchema, noteSort, noteStatus, noteVisibility } from '#shared/types/note'
import type { NoteSort } from '#shared/types/note'
import type { ViewFilter } from '#shared/types/view'
import { getSessionUser } from '#server/utils/session'
import { normalizeViewFilter } from '#server/utils/view-filter'
import { readQueryZod } from '#server/utils/validation'
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	getColumns,
	gt,
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

defineRouteMeta({
	openAPI: {
		tags: ['Notes'],
		description:
			'Lists notes visible to the caller. Anonymous callers only see public notes from non-banned users; signed-in callers see their own notes, unless a visibility filter widens the result to non-private notes from other users. Archived notes are never served.',
		parameters: [
			{
				name: 'sort',
				in: 'query',
				schema: {
					type: 'string',
					enum: ['created-desc', 'created-asc', 'updated-desc', 'updated-asc'],
					default: 'created-desc',
				},
				description: 'Sort order. Cursors are only valid for the same sort.',
			},
			{
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
				description: 'Page size.',
			},
			{
				name: 'cursor',
				in: 'query',
				schema: { type: 'string' },
				description:
					'Opaque pagination cursor from a previous response. Pattern: sort:value:id:pinned (created-desc omits the sort prefix).',
			},
			{
				name: 'status',
				in: 'query',
				explode: true,
				style: 'form',
				schema: {
					type: 'array',
					items: { type: 'string', enum: ['normal', 'later', 'pinned', 'archived'] },
				},
				description: 'Limit to these statuses. Repeat for multiple values.',
			},
			{
				name: 'notStatus',
				in: 'query',
				explode: true,
				style: 'form',
				schema: {
					type: 'array',
					items: { type: 'string', enum: ['normal', 'later', 'pinned', 'archived'] },
				},
				description: 'Exclude these statuses.',
			},
			{
				name: 'spaceId',
				in: 'query',
				schema: { type: 'string' },
				description: 'Only this space, which must be owned by the signed-in user.',
			},
			{
				name: 'spaceIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description: 'Limit to these spaces (owned by the signed-in user).',
			},
			{
				name: 'notSpaceIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description: 'Exclude these spaces.',
			},
			{
				name: 'noSpace',
				in: 'query',
				schema: { type: 'boolean' },
				description: 'Only unassigned notes.',
			},
			{
				name: 'tagIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description: 'Require all of these tag IDs.',
			},
			{
				name: 'notTagIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description: 'Exclude notes having any of these tag IDs.',
			},
			{
				name: 'noTags',
				in: 'query',
				schema: { type: 'boolean' },
				description: 'Only notes without tags. Excludes deferred notes.',
			},
			{
				name: 'viewIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description:
					"Combine the viewer's views (OR). Nested view filters are resolved to depth 3.",
			},
			{
				name: 'notViewIds',
				in: 'query',
				explode: true,
				style: 'form',
				schema: { type: 'array', items: { type: 'string' } },
				description: 'Exclude notes matching any of these views.',
			},
			{
				name: 'visibility',
				in: 'query',
				explode: true,
				style: 'form',
				schema: {
					type: 'array',
					items: { type: 'string', enum: ['private', 'protected', 'public'] },
				},
				description:
					"Limit to these visibilities. Signed-in callers may also include others' public/protected notes.",
			},
			{
				name: 'notVisibility',
				in: 'query',
				explode: true,
				style: 'form',
				schema: {
					type: 'array',
					items: { type: 'string', enum: ['private', 'protected', 'public'] },
				},
				description: 'Exclude these visibilities.',
			},
			{
				name: 'username',
				in: 'query',
				schema: { type: 'string' },
				description: 'Only notes by this username (case-insensitive).',
			},
			{
				name: 'q',
				in: 'query',
				schema: { type: 'string' },
				description: 'Substring match against note content.',
			},
		],
		responses: {
			200: {
				description: 'A page of notes.',
				content: {
					'application/json': {
						schema: { $ref: '#/components/schemas/ListNotesResponse' },
					},
				},
			},
			400: {
				description: 'The query failed validation.',
				content: {
					'application/json': {
						schema: { $ref: '#/components/schemas/Error' },
					},
				},
			},
		},
		$global: {
			components: {
				schemas: {
					NoteVisibility: { type: 'string', enum: ['private', 'protected', 'public'] },
					NoteStatus: { type: 'string', enum: ['normal', 'later', 'pinned', 'archived'] },
					LinkPreview: {
						type: 'object',
						required: ['url', 'type', 'title'],
						properties: {
							url: { type: 'string' },
							type: {
								type: 'string',
								enum: [
									'website',
									'article',
									'book',
									'video',
									'audio',
									'music',
									'podcast',
									'tweet',
									'github',
								],
							},
							ogType: { type: 'string' },
							title: { type: 'string' },
							description: { type: 'string' },
							image: { type: 'string' },
							imageWidth: { type: 'integer' },
							imageHeight: { type: 'integer' },
							imageAlt: { type: 'string' },
							icon: { type: 'string' },
							siteName: { type: 'string' },
							author: { type: 'string' },
							publishedAt: { type: 'string' },
							meta: { type: 'object', additionalProperties: true },
						},
					},
					Note: {
						type: 'object',
						required: [
							'id',
							'content',
							'linkPreviews',
							'userId',
							'spaceId',
							'visibility',
							'status',
							'createdAt',
							'updatedAt',
						],
						properties: {
							id: { type: 'string' },
							content: { type: 'string' },
							linkPreviews: {
								type: 'object',
								additionalProperties: { $ref: '#/components/schemas/LinkPreview' },
							},
							userId: { type: 'string' },
							spaceId: { type: ['string', 'null'] },
							visibility: { $ref: '#/components/schemas/NoteVisibility' },
							status: { $ref: '#/components/schemas/NoteStatus' },
							createdAt: { type: 'string', format: 'date-time' },
							updatedAt: { type: 'string', format: 'date-time' },
						},
					},
					NoteListItem: {
						type: 'object',
						allOf: [
							{ $ref: '#/components/schemas/Note' },
							{
								type: 'object',
								required: ['tagIds'],
								properties: { tagIds: { type: 'array', items: { type: 'string' } } },
							},
						],
					},
					ListNotesResponse: {
						type: 'object',
						required: ['items', 'nextCursor', 'total'],
						properties: {
							items: { type: 'array', items: { $ref: '#/components/schemas/NoteListItem' } },
							nextCursor: { type: ['string', 'null'] },
							total: { type: 'integer', minimum: 0 },
						},
					},
					CreateNoteRequest: {
						type: 'object',
						required: ['content'],
						properties: {
							id: { type: 'string', description: 'Client-minted id for idempotent creates.' },
							content: { type: 'string' },
							spaceId: {
								type: ['string', 'null'],
								description: 'Space to assign to the note, or null for unassigned.',
							},
							tagNames: { type: 'array', items: { type: 'string' } },
							visibility: { $ref: '#/components/schemas/NoteVisibility', default: 'private' },
							status: { $ref: '#/components/schemas/NoteStatus', default: 'normal' },
						},
					},
					UpdateNoteRequest: {
						type: 'object',
						description:
							'At least one of content, spaceId, tagNames, status, or visibility must be present. updatedAt alone is not enough.',
						properties: {
							content: { type: 'string' },
							spaceId: { type: ['string', 'null'] },
							tagNames: { type: 'array', items: { type: 'string' } },
							visibility: { $ref: '#/components/schemas/NoteVisibility' },
							status: { $ref: '#/components/schemas/NoteStatus' },
							updatedAt: {
								type: 'integer',
								minimum: 1,
								description: 'Client-side ms timestamp used for last-write-wins.',
							},
						},
					},
					Space: {
						type: 'object',
						required: ['id', 'name', 'icon', 'userId', 'createdAt', 'updatedAt'],
						properties: {
							id: { type: 'string' },
							name: { type: 'string' },
							icon: { type: 'string', description: 'Entity icon name.' },
							userId: { type: 'string' },
							createdAt: { type: 'string', format: 'date-time' },
							updatedAt: { type: 'string', format: 'date-time' },
						},
					},
					SpaceListItem: {
						type: 'object',
						required: ['id', 'name', 'icon', 'noteCount'],
						properties: {
							id: { type: 'string' },
							name: { type: 'string' },
							icon: { type: 'string' },
							noteCount: { type: 'integer', minimum: 0 },
						},
					},
					SpaceCreateRequest: {
						type: 'object',
						required: ['name'],
						properties: {
							name: { type: 'string' },
							icon: { type: 'string', default: 'space' },
						},
					},
					SpaceUpdateRequest: {
						type: 'object',
						required: ['name'],
						properties: {
							name: { type: 'string' },
							icon: { type: 'string' },
						},
					},
					TagListItem: {
						type: 'object',
						required: ['id', 'name', 'usageCount'],
						properties: {
							id: { type: 'string' },
							name: { type: 'string' },
							usageCount: { type: 'integer', minimum: 0 },
						},
					},
					ViewFilter: {
						type: 'object',
						additionalProperties: true,
						description: 'View filter AST. See shared/types/view.ts for the exact shape.',
					},
					View: {
						type: 'object',
						required: [
							'id',
							'name',
							'icon',
							'filter',
							'position',
							'userId',
							'createdAt',
							'updatedAt',
						],
						properties: {
							id: { type: 'string' },
							name: { type: 'string' },
							icon: { type: 'string' },
							filter: { $ref: '#/components/schemas/ViewFilter' },
							position: { type: 'integer', minimum: 0 },
							userId: { type: 'string' },
							createdAt: { type: 'string', format: 'date-time' },
							updatedAt: { type: 'string', format: 'date-time' },
						},
					},
					ViewCreateRequest: {
						type: 'object',
						required: ['name'],
						properties: {
							name: { type: 'string' },
							icon: { type: 'string', default: 'view' },
							filter: { $ref: '#/components/schemas/ViewFilter', default: {} },
						},
					},
					ViewUpdateRequest: {
						type: 'object',
						description:
							'All fields are optional. An empty object is accepted and leaves the view unchanged.',
						properties: {
							name: { type: 'string' },
							icon: { type: 'string' },
							filter: { $ref: '#/components/schemas/ViewFilter' },
						},
					},
					SidebarEntry: {
						type: 'object',
						required: ['id', 'kind', 'targetId', 'position', 'userId', 'createdAt', 'updatedAt'],
						properties: {
							id: { type: 'string' },
							kind: { type: 'string', enum: ['view', 'space', 'tag'] },
							targetId: { type: 'string' },
							position: { type: 'integer', minimum: 0 },
							userId: { type: 'string' },
							createdAt: { type: 'string', format: 'date-time' },
							updatedAt: { type: 'string', format: 'date-time' },
						},
					},
					SidebarPinRequest: {
						type: 'object',
						required: ['kind', 'targetId'],
						properties: {
							kind: { type: 'string', enum: ['view', 'space', 'tag'] },
							targetId: { type: 'string' },
						},
					},
					SidebarReorderRequest: {
						type: 'object',
						required: ['position'],
						properties: {
							position: { type: 'integer', minimum: 0 },
						},
					},
					UploadRequest: {
						type: 'object',
						required: ['contentType'],
						properties: {
							contentType: { type: 'string' },
							filename: { type: 'string' },
						},
					},
					UploadTarget: {
						type: 'object',
						required: ['uploadUrl', 'url'],
						properties: {
							uploadUrl: { type: 'string', format: 'uri' },
							url: { type: 'string', format: 'uri' },
						},
					},
					PublicUser: {
						type: 'object',
						required: ['id', 'name', 'createdAt'],
						properties: {
							id: { type: 'string' },
							name: { type: 'string' },
							username: { type: ['string', 'null'] },
							displayUsername: { type: ['string', 'null'] },
							image: { type: ['string', 'null'] },
							createdAt: { type: 'string', format: 'date-time' },
						},
					},
					Error: {
						type: 'object',
						required: ['statusCode', 'statusMessage'],
						properties: {
							statusCode: { type: 'integer' },
							statusMessage: { type: 'string' },
							message: { type: 'string' },
							data: { type: 'object', additionalProperties: true },
						},
					},
				},
			},
		},
	},
})

export function encodeNoteCursor(sort: NoteSort, value: Date, id: string, pinned: boolean): string {
	const position = `${value.getTime()}:${id}:${pinned ? 1 : 0}`
	return sort === noteSort.createdDesc ? position : `${sort}:${position}`
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
	const sortByUpdated = query.sort === noteSort.updatedDesc || query.sort === noteSort.updatedAsc
	const sortAscending = query.sort === noteSort.createdAsc || query.sort === noteSort.updatedAsc
	const sortValue = sortByUpdated ? notes.updatedAt : notes.createdAt

	const cursorFilter =
		query.cursor && query.cursor.sort === query.sort
			? or(
					lt(pinnedFlag, query.cursor.pinned ? 1 : 0),
					and(
						eq(pinnedFlag, query.cursor.pinned ? 1 : 0),
						sortAscending
							? or(
									gt(sortValue, query.cursor.value),
									and(eq(sortValue, query.cursor.value), gt(notes.id, query.cursor.id)),
								)
							: or(
									lt(sortValue, query.cursor.value),
									and(eq(sortValue, query.cursor.value), lt(notes.id, query.cursor.id)),
								),
					),
				)
			: undefined

	const readable = viewerId
		? query.visibility?.length
			? or(
					eq(notes.userId, viewerId),
					and(ne(notes.userId, viewerId), ne(notes.visibility, noteVisibility.private)),
				)
			: eq(notes.userId, viewerId)
		: eq(notes.visibility, noteVisibility.public)

	// The untagged inbox is the triage queue: a deferred note belongs to the later tab.
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
			})
			.from(notes)
			.innerJoin(user, eq(user.id, notes.userId))
			.where(and(cursorFilter, where))
			.orderBy(
				desc(pinnedFlag),
				sortAscending ? asc(sortValue) : desc(sortValue),
				sortAscending ? asc(notes.id) : desc(notes.id),
			)
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
		tagIds: tagIdsByNote.get(row.id) ?? [],
	}))
	const last = items[items.length - 1]
	return {
		items,
		nextCursor:
			rows.length > query.limit && last
				? encodeNoteCursor(
						query.sort,
						sortByUpdated ? last.updatedAt : last.createdAt,
						last.id,
						last.status === noteStatus.pinned,
					)
				: null,
		total: totalRow?.count ?? 0,
	}
})
