import { openCommandPalette } from '~/utils/command-palette'
import { openComposer } from '~/utils/open-composer'
import { globalShortcutActions } from '~/utils/shortcuts'
import type { GlobalShortcutId } from '~/utils/shortcuts'

export function useGlobalShortcuts() {
	const appConfig = useAppConfig()
	const viewStore = useViewStore()
	const shortcutStore = useShortcutStore()
	const session = useAuth().useSession()
	const overlay = useOverlay()

	function hasOpenOverlay() {
		return overlay.overlays.some((item) => item.isOpen)
	}

	const handlers: Record<GlobalShortcutId, () => void> = {
		toggleSidebar: () => {
			viewStore.sidebarOpen = !viewStore.sidebarOpen
		},
		commandPalette: openCommandPalette,
		preferences: () => {
			if (hasOpenOverlay()) return
			void navigateTo(appConfig.routes.settings.preferences)
		},
		newNote: () => {
			if (!session.value.data?.user || hasOpenOverlay()) return
			openComposer()
		},
	}

	const config = computed(() =>
		Object.fromEntries(
			globalShortcutActions.map((action) => [
				shortcutStore.bindings[action.id],
				{
					usingInput: action.usingInput,
					handler: (event?: KeyboardEvent) => {
						if (!event?.repeat) handlers[action.id]()
					},
				},
			]),
		),
	)

	defineShortcuts(config)
}
