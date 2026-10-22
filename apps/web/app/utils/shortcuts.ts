export const shortcutActions = [
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
		id: 'preferences',
		defaultKey: 'meta_,',
		labelKey: 'settings.shortcuts.openSettings',
		usingInput: true,
	},
	{
		id: 'newNote',
		defaultKey: 'meta_e',
		labelKey: 'note.newNote',
		usingInput: false,
	},
] as const

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

function keyFromEvent(event: KeyboardEvent) {
	if (event.altKey) {
		if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase()
		if (/^Digit\d$/.test(event.code)) return event.code.slice(5)
		if (/^F\d{1,2}$/.test(event.code)) return event.code.toLowerCase()
		return altCodeKeys[event.code] ?? null
	}
	if (event.key.length === 0 || event.key === ' ' || event.key === '_') return null
	const key = event.key.toLowerCase()
	if (key.length > 1 && !namedKeys.has(key) && !/^f\d{1,2}$/.test(key)) return null
	return key
}

export function eventToShortcut(event: KeyboardEvent): string | null {
	if (!event.ctrlKey && !event.metaKey && !event.altKey) return null
	const key = keyFromEvent(event)
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
