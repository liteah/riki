import { LazyLayoutCommandPalette } from '#components'

// The palette stays mounted between opens, so its form overlays are created once.
let openCommandPaletteModal: (() => void) | undefined

export function openCommandPalette() {
	if (!openCommandPaletteModal) {
		const commandPalette = useOverlay().create(LazyLayoutCommandPalette)
		openCommandPaletteModal = () => commandPalette.open()
	}
	openCommandPaletteModal()
}
