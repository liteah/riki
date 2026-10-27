export const globalShortcutActions = [
	{
		id: 'newNote',
		defaultKey: 'meta_e',
		labelKey: 'note.newNote',
		usingInput: false,
	},
	{
		id: 'toggleSidebar',
		defaultKey: 'meta_b',
		labelKey: 'settings.shortcuts.toggleSidebar',
		usingInput: false,
	},
	{
		id: 'commandPalette',
		defaultKey: 'meta_k',
		labelKey: 'settings.shortcuts.openCommandPalette',
		usingInput: true,
	},
	{
		id: 'library',
		defaultKey: 'meta_l',
		labelKey: 'settings.shortcuts.library',
		usingInput: false,
	},
	{
		id: 'inbox',
		defaultKey: 'meta_i',
		labelKey: 'settings.shortcuts.inbox',
		usingInput: false,
	},
	{
		id: 'preferences',
		defaultKey: 'meta_,',
		labelKey: 'settings.shortcuts.openSettings',
		usingInput: true,
	},
] as const

export const noteViewShortcutActions = [
	{
		id: 'previousNote',
		defaultKey: 'k',
		labelKey: 'settings.shortcuts.previousNote',
	},
	{
		id: 'nextNote',
		defaultKey: 'j',
		labelKey: 'settings.shortcuts.nextNote',
	},
	{
		id: 'openNote',
		defaultKey: 'enter',
		labelKey: 'note.openNote',
	},
	{
		id: 'addToSpace',
		defaultKey: 's',
		labelKey: 'note.addToSpace',
	},
	{
		id: 'toggleLater',
		defaultKey: 'l',
		labelKey: 'note.later',
	},
	{
		id: 'archiveNote',
		defaultKey: 'e',
		labelKey: 'note.archive',
	},
	{
		id: 'destroyNote',
		defaultKey: 'd',
		labelKey: 'common.delete',
	},
] as const

export const shortcutActions = [...globalShortcutActions, ...noteViewShortcutActions] as const

export type GlobalShortcutId = (typeof globalShortcutActions)[number]['id']
export type NoteViewShortcutId = (typeof noteViewShortcutActions)[number]['id']
export type ShortcutId = (typeof shortcutActions)[number]['id']
export type ShortcutBindings = Record<ShortcutId, string>

export const shortcutDefaults = Object.fromEntries(
	shortcutActions.map((action) => [action.id, action.defaultKey]),
) as ShortcutBindings

const modifierKeys = new Set(['Alt', 'AltGraph', 'Control', 'Meta', 'Shift'])
const namedKeys = new Set([
	'enter',
	'escape',
	'tab',
	'backspace',
	'delete',
	'arrowup',
	'arrowdown',
	'arrowleft',
	'arrowright',
	'home',
	'end',
	'pageup',
	'pagedown',
	'insert',
])
const altCodeKeys: Record<string, string> = {
	Space: 'space',
	Enter: 'enter',
	Escape: 'escape',
	Tab: 'tab',
	Backspace: 'backspace',
	Delete: 'delete',
	ArrowUp: 'arrowup',
	ArrowDown: 'arrowdown',
	ArrowLeft: 'arrowleft',
	ArrowRight: 'arrowright',
}

export function isModifierKey(key: string) {
	return modifierKeys.has(key)
}

function keyFromEvent(event: KeyboardEvent, allowBare: boolean) {
	if (event.altKey) {
		if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase()
		if (/^Digit\d$/.test(event.code)) return event.code.slice(5)
		if (/^F\d{1,2}$/.test(event.code)) return event.code.toLowerCase()
		return altCodeKeys[event.code] ?? null
	}
	if (event.key === ' ') {
		return allowBare || event.ctrlKey || event.metaKey ? 'space' : null
	}
	if (event.key.length === 0 || event.key === '_') return null
	const key = event.key.toLowerCase()
	if (key.length > 1 && !namedKeys.has(key) && !/^f\d{1,2}$/.test(key)) return null
	return key
}

export function eventToShortcut(event: KeyboardEvent, allowBare = false): string | null {
	const hasModifier = event.ctrlKey || event.metaKey || event.altKey
	if (!hasModifier && !allowBare) return null
	const key = keyFromEvent(event, allowBare)
	if (!key) return null
	const parts: string[] = []
	if (event.ctrlKey || event.metaKey) parts.push('meta')
	if (event.altKey) parts.push('alt')
	if (event.shiftKey) parts.push('shift')
	parts.push(key)
	return parts.join('_')
}

export function shortcutParts(shortcut: string) {
	return shortcut.split('_')
}
