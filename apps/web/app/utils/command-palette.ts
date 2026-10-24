import { LazyLayoutCommandPalette } from '#components'

export interface CommandPaletteScope {
	kind: 'view' | 'space' | 'tag'
	id: string
}

export interface CommandPaletteOptions {
	scope?: CommandPaletteScope
	query?: string
}

// The palette stays mounted between opens, so its form overlays are created once.
let openCommandPaletteModal: ((options: CommandPaletteOptions) => void) | undefined

export function openCommandPalette(options: CommandPaletteOptions = {}) {
	if (!openCommandPaletteModal) {
		const commandPalette = useOverlay().create(LazyLayoutCommandPalette)
		openCommandPaletteModal = (next) => {
			commandPalette.open(next)
		}
	}
	openCommandPaletteModal(options)
}
