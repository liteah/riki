import type { ViewFilter } from '#shared/types/view'

export function mergeFilters(base: ViewFilter, explicit: ViewFilter): ViewFilter {
	const viewScoped = Boolean(explicit.viewIds?.length || explicit.notViewIds?.length)
	const source = viewScoped ? {} : base
	const tagIds = [...new Set([...(source.tagIds ?? []), ...(explicit.tagIds ?? [])])]
	const merged: ViewFilter = { ...source }
	if (explicit.spaceId !== undefined) {
		merged.spaceId = explicit.spaceId
		merged.spaceIds = undefined
	}
	if (explicit.spaceIds?.length) {
		merged.spaceId = undefined
		merged.spaceIds = explicit.spaceIds
	}
	if (explicit.notSpaceIds?.length) merged.notSpaceIds = explicit.notSpaceIds
	if (explicit.viewIds?.length) merged.viewIds = explicit.viewIds
	if (explicit.notViewIds?.length) merged.notViewIds = explicit.notViewIds
	if (tagIds.length) merged.tagIds = tagIds
	if (explicit.notTagIds?.length) merged.notTagIds = explicit.notTagIds
	if (explicit.status?.length) merged.status = explicit.status
	if (explicit.notStatus?.length) merged.notStatus = explicit.notStatus
	if (explicit.visibility?.length) merged.visibility = explicit.visibility
	if (explicit.notVisibility?.length) merged.notVisibility = explicit.notVisibility
	if (explicit.q) merged.q = explicit.q
	return merged
}

export function countFilterValues(filter: ViewFilter): number {
	return (
		Number(filter.spaceId !== undefined) +
		(filter.spaceIds?.length ?? 0) +
		(filter.notSpaceIds?.length ?? 0) +
		(filter.viewIds?.length ?? 0) +
		(filter.notViewIds?.length ?? 0) +
		(filter.tagIds?.length ?? 0) +
		(filter.notTagIds?.length ?? 0) +
		(filter.status?.length ?? 0) +
		(filter.notStatus?.length ?? 0) +
		(filter.visibility?.length ?? 0) +
		(filter.notVisibility?.length ?? 0)
	)
}
