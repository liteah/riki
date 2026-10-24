import { noteStatus } from '#shared/types/note'
import { viewFilterSchema } from '#shared/types/view'
import type { ViewFilter } from '#shared/types/view'

export function normalizeViewFilter(filter: unknown): ViewFilter {
	const value = (filter ?? {}) as ViewFilter & { pinnedOnly?: boolean }
	return viewFilterSchema.parse(
		value.pinnedOnly && !value.status ? { ...value, status: [noteStatus.pinned] } : value,
	)
}
