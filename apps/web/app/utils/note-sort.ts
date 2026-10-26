import { noteSort, noteStatus } from '#shared/types/note'
import type { NoteListItem, NoteSort } from '#shared/types/note'
import { toEpoch } from '~/utils/time'

export function compareNotes(a: NoteListItem, b: NoteListItem, sort: NoteSort) {
	const pinned = Number(b.status === noteStatus.pinned) - Number(a.status === noteStatus.pinned)
	if (pinned) return pinned

	const byUpdated = sort === noteSort.updatedDesc || sort === noteSort.updatedAsc
	const ascending = sort === noteSort.createdAsc || sort === noteSort.updatedAsc
	const left = toEpoch(byUpdated ? a.updatedAt : a.createdAt)
	const right = toEpoch(byUpdated ? b.updatedAt : b.createdAt)
	const byTime = ascending ? left - right : right - left
	if (byTime) return byTime

	return ascending
		? a.id < b.id
			? -1
			: a.id > b.id
				? 1
				: 0
		: a.id < b.id
			? 1
			: a.id > b.id
				? -1
				: 0
}
