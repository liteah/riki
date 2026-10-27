export const noteColumnModes = ['auto', 'single', 'double'] as const

export type NoteColumnMode = (typeof noteColumnModes)[number]

const minColumnWidth = 320
const columnGap = 8

export function resolveNoteColumnLanes(mode: NoteColumnMode, width: number) {
	if (mode === 'single') return 1
	if (mode === 'double') return 2
	return Math.min(4, Math.max(1, Math.floor((width + columnGap) / (minColumnWidth + columnGap))))
}
