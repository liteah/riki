import type { ViewFilter } from '#shared/types/view'

export interface NoteQueryFilter extends ViewFilter {
	noTags?: boolean
}

export function noteQueryFromFilter(filter: NoteQueryFilter) {
	const spaceId = filter.spaceId === undefined ? undefined : (filter.spaceId ?? null)
	return {
		...(filter.status?.length && { status: filter.status }),
		...(filter.notStatus?.length && { notStatus: filter.notStatus }),
		...(filter.spaceIds?.length && { spaceIds: filter.spaceIds }),
		...(filter.notSpaceIds?.length && { notSpaceIds: filter.notSpaceIds }),
		...(filter.viewIds?.length && { viewIds: filter.viewIds }),
		...(filter.notViewIds?.length && { notViewIds: filter.notViewIds }),
		...(spaceId === null ? { noSpace: true } : spaceId ? { spaceId } : {}),
		...(filter.noTags ? { noTags: true } : {}),
		...(filter.tagIds?.length ? { tagIds: filter.tagIds } : {}),
		...(filter.notTagIds?.length && { notTagIds: filter.notTagIds }),
		...(filter.visibility?.length ? { visibility: filter.visibility } : {}),
		...(filter.notVisibility?.length && { notVisibility: filter.notVisibility }),
		...(filter.q ? { q: filter.q } : {}),
	}
}
