import { skipHydrate } from 'pinia'
import { noteInbox, noteStatus, noteVisibility } from '#shared/types/note'
import { localKeys } from '~/utils/local-cache'
import { mergeFilters } from '~/utils/note-filter'
import { noteQueryFromFilter } from '~/utils/note-query'
import { compareNotes } from '~/utils/note-sort'
import { toEpoch } from '~/utils/time'
import type {
	CreateNoteInput,
	ListNotesResponse,
	NoteListItem,
	NoteStatus,
	NoteWithTags,
	UpdateNoteBody,
} from '#shared/types/note'
import type { NoteInbox } from '#shared/types/note'
import type { ViewFilter } from '#shared/types/view'
import { newId } from '#shared/utils/id'

type NoteVisibilityValue = (typeof noteVisibility)[keyof typeof noteVisibility]
type NoteStatusValue = (typeof noteStatus)[keyof typeof noteStatus]

interface InboxScope extends ViewFilter {
	noTags?: boolean
}

interface OutboxPayload {
	content: string
	spaceId: string | null
	tagNames?: string[]
	visibility: NoteVisibilityValue
	status: NoteStatusValue
}

type OutboxState = 'pending' | 'syncing' | 'failed'

interface OutboxRow {
	noteId: string
	kind: 'create' | 'update'
	payload: OutboxPayload
	updatedAt: number
	state: OutboxState
	attempts: number
	nextRetryAt: number
	lastError?: string
	lastStatus?: number
}

const MAX_ATTEMPTS = 8
const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60_000
const PAGE_SIZE = 20
const OUTBOX_CONCURRENCY = 4

function statusOf(error: unknown) {
	if (error && typeof error === 'object' && 'statusCode' in error) {
		const { statusCode } = error as { statusCode?: unknown }
		if (typeof statusCode === 'number') return statusCode
	}
	return 0
}

function backoffDelay(attempts: number) {
	const exponential = Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_MAX_MS)
	return Math.round(exponential * (0.5 + Math.random() * 0.5))
}

export const useNoteStore = defineStore('note', () => {
	const authClient = useAuth()
	const session = authClient.useSession()
	const spaceStore = useSpaceStore()
	const tagStore = useTagStore()
	const online = useOnline()

	const viewStore = useViewStore()

	const explicitFilter = ref<ViewFilter>({})

	const activeFilter = computed<ViewFilter>(() =>
		mergeFilters(viewStore.baseFilter, explicitFilter.value),
	)

	const inbox = ref<NoteInbox>(noteInbox.unassigned)

	const inInbox = computed(() => viewStore.target.kind === 'inbox')

	const inboxFilter = computed<InboxScope>(() => {
		switch (inbox.value) {
			// A deferred note stays in the later tab after it is filed into a space.
			case noteInbox.later:
				return {
					status: [noteStatus.later],
					spaceId: undefined,
					spaceIds: undefined,
					notSpaceIds: undefined,
					viewIds: undefined,
					notViewIds: undefined,
					tagIds: undefined,
					notTagIds: undefined,
					notStatus: undefined,
					notVisibility: undefined,
				}
			default:
				// The inbox triage queue: nothing assigned anywhere. Tags count as
				// assignment too, so an untagged note held in a space is not pending.
				// Deferred notes are not pending either: they live in the later tab.
				return { noTags: true }
		}
	})

	const inboxScope = computed<InboxScope>(() =>
		inInbox.value ? { ...activeFilter.value, ...inboxFilter.value } : activeFilter.value,
	)

	function matchesViewFilter(note: NoteListItem, filter: ViewFilter, depth = 0): boolean {
		const statuses = filter.status?.length
			? filter.status
			: [noteStatus.normal, noteStatus.later, noteStatus.pinned]
		if (!statuses.includes(note.status)) return false
		if (filter.notStatus?.includes(note.status)) return false
		if (filter.spaceIds?.length || filter.spaceId !== undefined) {
			const inIds = Boolean(note.spaceId && filter.spaceIds?.includes(note.spaceId))
			const matchesSpaceId = filter.spaceId !== undefined && note.spaceId === filter.spaceId
			if (!inIds && !matchesSpaceId) return false
		}
		if (
			filter.notSpaceIds?.length &&
			(!note.spaceId || filter.notSpaceIds.includes(note.spaceId))
		) {
			return false
		}
		const tags = note.tagIds ?? []
		if (filter.tagIds?.length && !filter.tagIds.every((id) => tags.includes(id))) return false
		if (filter.notTagIds?.length && filter.notTagIds.some((id) => tags.includes(id))) return false
		if (filter.visibility?.length && !filter.visibility.includes(note.visibility)) return false
		if (filter.notVisibility?.includes(note.visibility)) return false
		if (filter.q && !note.content.toLowerCase().includes(filter.q.toLowerCase())) return false
		if (filter.viewIds?.length && depth < 3) {
			const nested = filter.viewIds
				.map((id) => viewStore.views.find((view) => view.id === id)?.filter)
				.filter((item): item is ViewFilter => Boolean(item))
			if (!nested.length || !nested.some((item) => matchesViewFilter(note, item, depth + 1))) {
				return false
			}
		}
		if (filter.notViewIds?.length && depth < 3) {
			const nested = filter.notViewIds
				.map((id) => viewStore.views.find((view) => view.id === id)?.filter)
				.filter((item): item is ViewFilter => Boolean(item))
			if (nested.some((item) => matchesViewFilter(note, item, depth + 1))) return false
		}
		return true
	}

	const visibleNotes = computed(() => {
		const scope = inboxScope.value
		const q = scope.q?.toLowerCase()
		const viewerId = session.value.data?.user?.id ?? null
		const statuses: NoteStatus[] | null = scope.status?.length ? scope.status : null
		const excludeArchived = !scope.viewIds?.length || Boolean(scope.noTags)
		const viewFilters = scope.viewIds
			?.map((id) => viewStore.views.find((view) => view.id === id)?.filter)
			.filter((item): item is ViewFilter => Boolean(item))
		const merged = new Map<string, NoteListItem>()
		for (const note of notes.value) merged.set(note.id, note)
		for (const note of foreignNotes.value) merged.set(note.id, note)
		return [...merged.values()]
			.filter((note) => {
				if (statuses) {
					if (!statuses.includes(note.status)) return false
				} else if (excludeArchived && note.status === noteStatus.archived) {
					return false
				}
				if (scope.noTags && ((note.tagIds?.length ?? 0) > 0 || note.status === noteStatus.later)) {
					return false
				}
				if (viewerId && note.userId && note.userId !== viewerId) {
					if (!scope.visibility?.length) return false
					if (note.visibility === noteVisibility.private) return false
				}
				if (q && !note.content.toLowerCase().includes(q)) return false
				if (scope.notStatus?.includes(note.status)) return false
				if (scope.spaceIds?.length || scope.spaceId !== undefined) {
					const inIds = Boolean(note.spaceId && scope.spaceIds?.includes(note.spaceId))
					const matchesSpaceId = scope.spaceId !== undefined && note.spaceId === scope.spaceId
					if (!inIds && !matchesSpaceId) return false
				}
				if (
					scope.notSpaceIds?.length &&
					(!note.spaceId || scope.notSpaceIds.includes(note.spaceId))
				) {
					return false
				}
				if (scope.viewIds?.length) {
					if (
						!viewFilters?.length ||
						!viewFilters.some((filter) => matchesViewFilter(note, filter))
					) {
						return false
					}
				}
				if (scope.notViewIds?.length) {
					const excluded = scope.notViewIds
						.map((id) => viewStore.views.find((view) => view.id === id)?.filter)
						.filter((item): item is ViewFilter => Boolean(item))
					if (excluded.some((filter) => matchesViewFilter(note, filter))) return false
				}
				const tags = note.tagIds ?? []
				if (scope.tagIds?.length && !scope.tagIds.every((id) => tags.includes(id))) return false
				if (scope.notTagIds?.length && scope.notTagIds.some((id) => tags.includes(id))) {
					return false
				}
				if (scope.visibility?.length && !scope.visibility.includes(note.visibility)) return false
				if (scope.notVisibility?.includes(note.visibility)) return false
				return true
			})
			.sort((a, b) => compareNotes(a, b, viewStore.noteSort))
	})

	function resetFilter() {
		explicitFilter.value = {}
	}

	function removeTagFromFilter(tagId: string) {
		const current = explicitFilter.value
		const tagIds = current.tagIds?.filter((id) => id !== tagId)
		const notTagIds = current.notTagIds?.filter((id) => id !== tagId)
		if (
			tagIds?.length === current.tagIds?.length &&
			notTagIds?.length === current.notTagIds?.length
		) {
			return
		}
		explicitFilter.value = {
			...current,
			tagIds: tagIds?.length ? tagIds : undefined,
			notTagIds: notTagIds?.length ? notTagIds : undefined,
		}
	}

	const notes = skipHydrate(useLocalStorage<NoteListItem[]>(localKeys.notes, []))
	const foreignNotes = ref<NoteListItem[]>([])
	const outbox = skipHydrate(useLocalStorage<OutboxRow[]>(localKeys.outbox, []))
	const nextCursor = skipHydrate(useLocalStorage<string | null>(localKeys.notesCursor, null))
	const pending = ref(false)
	const syncing = ref(false)
	const paginationDone = ref(false)
	const loaded = ref(false)
	const total = ref(0)
	let started = false

	const unsyncedIds = computed(() => {
		if (!online.value) return new Set(outbox.value.map((row) => row.noteId))
		return new Set(
			outbox.value
				.filter((row) => row.attempts > 0 || row.state === 'failed')
				.map((row) => row.noteId),
		)
	})

	function indexOf(id: string) {
		return notes.value.findIndex((note) => note.id === id)
	}

	function spaceNameOf(spaceId: string | null) {
		if (!spaceId) return null
		return spaceStore.spaces.find((space) => space.id === spaceId)?.name ?? null
	}

	function spaceIconOf(spaceId: string | null) {
		if (!spaceId) return null
		return spaceStore.spaces.find((space) => space.id === spaceId)?.icon ?? null
	}

	function resolvedTagIds(tagNames?: string[]): string[] {
		if (!tagNames?.length) return []
		const byName = new Map(tagStore.tags.map((tag) => [tag.name.toLowerCase(), tag.id]))
		return tagNames
			.map((name) => byName.get(name.toLowerCase()))
			.filter((id): id is string => id !== undefined)
	}

	function mergeRows(rows: NoteListItem[], incoming: NoteListItem[]) {
		if (!incoming.length) return rows
		const byId = new Map(rows.map((note) => [note.id, note]))
		let changed = false
		for (const note of incoming) {
			if (note.status === noteStatus.archived) continue
			const local = byId.get(note.id)
			if (local && toEpoch(local.updatedAt) > toEpoch(note.updatedAt)) continue
			byId.set(note.id, note)
			changed = true
		}
		if (!changed) return rows
		return [...byId.values()].sort((a, b) => compareNotes(a, b, viewStore.noteSort))
	}

	function mergeIncoming(incoming: NoteListItem[]) {
		if (!incoming.length) return
		const viewerId = session.value.data?.user?.id ?? null
		const mine: NoteListItem[] = []
		const foreign: NoteListItem[] = []
		for (const note of incoming) {
			if (!viewerId || (note.userId && note.userId !== viewerId)) foreign.push(note)
			else mine.push(note)
		}
		if (mine.length) notes.value = mergeRows(notes.value, mine)
		if (foreign.length) foreignNotes.value = mergeRows(foreignNotes.value, foreign)
	}

	function remember(note: NoteListItem) {
		mergeIncoming([note])
	}

	// A space rename never bumps the notes' updatedAt, so cached names would go
	// stale. Skipped while spaces are empty so offline use keeps them.
	watch(
		() => spaceStore.spaces,
		() => {
			if (!spaceStore.spaces.length) return
			notes.value = notes.value.map((note) => {
				const spaceName = spaceNameOf(note.spaceId)
				const spaceIcon = spaceIconOf(note.spaceId)
				return spaceName === note.spaceName && spaceIcon === note.spaceIcon
					? note
					: { ...note, spaceName, spaceIcon }
			})
		},
		{ immediate: true },
	)

	function enqueue(row: OutboxRow) {
		outbox.value = [...outbox.value.filter((item) => item.noteId !== row.noteId), row]
	}

	function enqueueFor(note: NoteListItem, kind: OutboxRow['kind'], tagNames?: string[]) {
		enqueue({
			noteId: note.id,
			kind,
			payload: {
				content: note.content,
				spaceId: note.spaceId,
				...(tagNames ? { tagNames } : {}),
				visibility: note.visibility,
				status: note.status,
			},
			updatedAt: toEpoch(note.updatedAt),
			state: 'pending',
			attempts: 0,
			nextRetryAt: 0,
		})
	}

	function settle(noteId: string) {
		outbox.value = outbox.value.filter((row) => row.noteId !== noteId)
	}

	async function push(row: OutboxRow) {
		const body = {
			content: row.payload.content,
			spaceId: row.payload.spaceId,
			...(row.payload.tagNames ? { tagNames: row.payload.tagNames } : {}),
			visibility: row.payload.visibility,
			status: row.payload.status,
			updatedAt: row.updatedAt,
		}
		if (row.kind === 'create') {
			await $fetch<NoteWithTags>('/api/notes', {
				method: 'POST',
				body: { id: row.noteId, ...body },
			})
			return
		}
		const winner = await $fetch<NoteWithTags>(`/api/notes/${row.noteId}`, { method: 'PATCH', body })
		const author = session.value.data?.user
		mergeIncoming([
			{
				...winner,
				spaceName: spaceNameOf(winner.spaceId),
				spaceIcon: spaceIconOf(winner.spaceId),
				authorName: author?.name ?? null,
				authorImage: author?.image ?? null,
			},
		])
	}

	async function flush() {
		if (syncing.value || !online.value) return
		const now = Date.now()
		const due = outbox.value.filter((row) => row.state !== 'failed' && row.nextRetryAt <= now)
		if (!due.length) return

		syncing.value = true
		let rejected: unknown
		try {
			for (let start = 0; start < due.length; start += OUTBOX_CONCURRENCY) {
				const batch = due.slice(start, start + OUTBOX_CONCURRENCY)
				const results = await Promise.all(
					batch.map(async (row) => {
						try {
							await push(row)
							return { row, ok: true as const }
						} catch (error) {
							return { row, ok: false as const, error }
						}
					}),
				)
				for (const outcome of results) {
					if (outcome.ok) {
						settle(outcome.row.noteId)
						continue
					}
					const status = statusOf(outcome.error)
					if (status >= 400 && status < 500) {
						outbox.value = outbox.value.map((item) =>
							item.noteId === outcome.row.noteId
								? {
										...item,
										state: 'failed' as const,
										attempts: item.attempts + 1,
										nextRetryAt: Date.now() + RETRY_MAX_MS,
										lastError:
											outcome.error instanceof Error
												? outcome.error.message
												: String(outcome.error),
										lastStatus: status,
									}
								: item,
						)
						rejected ??= outcome.error
						continue
					}
					const attempts = outcome.row.attempts + 1
					outbox.value = outbox.value.map((item) =>
						item.noteId === outcome.row.noteId
							? {
									...item,
									state: attempts >= MAX_ATTEMPTS ? ('failed' as const) : ('pending' as const),
									attempts,
									nextRetryAt: Date.now() + backoffDelay(attempts),
									lastError:
										outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
								}
							: item,
					)
				}
			}
		} finally {
			syncing.value = false
		}
		return rejected
	}

	async function loadMore() {
		if (pending.value || !online.value) return
		if (paginationDone.value) return
		const filter = inboxScope.value
		pending.value = true
		const data = await $fetch<ListNotesResponse>('/api/notes', {
			query: {
				limit: PAGE_SIZE,
				sort: viewStore.noteSort,
				...(nextCursor.value ? { cursor: nextCursor.value } : {}),
				...noteQueryFromFilter(filter),
			},
		}).catch(() => null)
		if (data) {
			mergeIncoming(data.items)
			nextCursor.value = data.nextCursor
			total.value = data.total
			if (data.nextCursor === null) paginationDone.value = true
		}
		loaded.value = true
		pending.value = false
	}

	watch(
		() =>
			[
				session.value.isPending ? undefined : (session.value.data?.user?.id ?? 'anonymous'),
			] as const,
		(key, previous) => {
			if (import.meta.server || key === previous) return
			foreignNotes.value = []
			if (typeof key === 'string' && key !== 'anonymous') {
				notes.value = notes.value.filter((note) => !note.userId || note.userId === key)
			}
			nextCursor.value = null
			paginationDone.value = false
			void loadMore()
		},
		{ immediate: true },
	)

	watch(
		() =>
			`${inInbox.value ? inbox.value : ''}|${JSON.stringify(inboxScope.value)}|${viewStore.noteSort}`,
		(key, previous) => {
			if (import.meta.server || key === previous) return
			nextCursor.value = null
			paginationDone.value = false
			void loadMore()
		},
	)

	async function retryNote(id: string) {
		const row = outbox.value.find((item) => item.noteId === id)
		if (!row) return
		const recreate = row.kind === 'update' && row.lastStatus === 404
		outbox.value = outbox.value.map((item) =>
			item.noteId === id
				? {
						...item,
						kind: recreate ? ('create' as const) : item.kind,
						state: 'pending' as const,
						attempts: 0,
						nextRetryAt: 0,
						lastError: undefined,
						lastStatus: undefined,
					}
				: item,
		)
		await flush()
	}

	async function create(input: CreateNoteInput) {
		const now = new Date()
		const spaceId = input.spaceId ?? null
		const author = session.value.data?.user
		const note: NoteListItem = {
			id: newId(),
			userId: author?.id ?? '',
			content: input.content,
			spaceId,
			spaceName: spaceNameOf(spaceId),
			spaceIcon: spaceIconOf(spaceId),
			authorName: author?.name ?? null,
			authorImage: author?.image ?? null,
			tagIds: resolvedTagIds(input.tagNames),
			visibility: input.visibility ?? noteVisibility.private,
			status: input.status ?? noteStatus.normal,
			createdAt: now,
			updatedAt: now,
		}
		notes.value = [note, ...notes.value]
		enqueueFor(note, 'create', input.tagNames)
		const rejected = await flush()
		if (rejected) throw rejected
		return note
	}

	async function update(id: string, body: UpdateNoteBody) {
		const index = indexOf(id)
		const previous = notes.value[index]
		if (!previous) throw new Error(`Cannot update unknown note ${id}`)

		const next: NoteListItem = {
			...previous,
			content: body.content ?? previous.content,
			spaceId: body.spaceId === undefined ? previous.spaceId : body.spaceId,
			spaceName: body.spaceId === undefined ? previous.spaceName : spaceNameOf(body.spaceId),
			spaceIcon: body.spaceId === undefined ? previous.spaceIcon : spaceIconOf(body.spaceId),
			tagIds: body.tagNames ? resolvedTagIds(body.tagNames) : previous.tagIds,
			visibility: body.visibility ?? previous.visibility,
			status: body.status ?? previous.status,
			updatedAt: new Date(),
		}
		notes.value[index] = next

		enqueueFor(next, 'update', body.tagNames)
		const rejected = await flush()
		if (rejected) throw rejected
		return next
	}

	function setStatus(id: string, status: NoteStatus) {
		return update(id, { status })
	}

	function remove(id: string) {
		const index = indexOf(id)
		const previous = notes.value[index]
		if (!previous) return
		notes.value.splice(index, 1)
		enqueueFor({ ...previous, status: noteStatus.archived, updatedAt: new Date() }, 'update')
		void flush()
	}

	async function destroy(id: string) {
		settle(id)
		await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
		notes.value = notes.value.filter((note) => note.id !== id)
		foreignNotes.value = foreignNotes.value.filter((note) => note.id !== id)
	}

	function isPending(id: string) {
		return unsyncedIds.value.has(id)
	}

	function start() {
		if (import.meta.server || started) return
		started = true
		useEventListener(window, 'online', () => void flush())
	}

	return {
		notes,
		visibleNotes,
		explicitFilter,
		activeFilter,
		inbox,
		pending,
		loaded,
		total,
		syncing,
		resetFilter,
		removeTagFromFilter,
		loadMore,
		start,
		flush,
		retryNote,
		isPending,
		remember,
		create,
		update,
		setStatus,
		remove,
		destroy,
	}
})
