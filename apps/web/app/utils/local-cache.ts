const PREFIX = 'riki'

export const localKeys = {
	notes: `${PREFIX}.notes`,
	notesCursor: `${PREFIX}.notes.cursor.v2`,
	outbox: `${PREFIX}.outbox`,
	review: `${PREFIX}.review`,
	drafts: `${PREFIX}.drafts`,
	sidebarOpen: `${PREFIX}.sidebarOpen`,
	noteColumns: `${PREFIX}.noteColumns`,
	noteSort: `${PREFIX}.noteSort`,
	shortcuts: `${PREFIX}.shortcuts`,
} as const
