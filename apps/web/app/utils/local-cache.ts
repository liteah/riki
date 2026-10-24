const PREFIX = 'riki'

export const localKeys = {
	notes: `${PREFIX}.notes`,
	notesCursor: `${PREFIX}.notes.cursor.v2`,
	outbox: `${PREFIX}.outbox`,
	drafts: `${PREFIX}.drafts`,
	sidebarOpen: `${PREFIX}.sidebarOpen`,
	shortcuts: `${PREFIX}.shortcuts`,
} as const
