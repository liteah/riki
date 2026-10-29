import { defaultSpaceIcon, defaultViewIcon } from '#shared/types/icon'
import type { EntityIcon } from '#shared/types/icon'
import type { NoteViewItem } from '#shared/types/note'
import type { SpaceListItem } from '#shared/types/space'
import type { View } from '#shared/types/view'
import { resolveEntityIcon } from '~/utils/entity-icon'

export function useEntityIcon() {
	const icons = useAppConfig().ui.icons
	const spaceStore = useSpaceStore()

	function resolve(icon: EntityIcon | null | undefined, fallback: EntityIcon) {
		return resolveEntityIcon(icons, icon, fallback)
	}

	function forSpace(space: Pick<SpaceListItem, 'icon'> | null | undefined) {
		return resolve(space?.icon, defaultSpaceIcon)
	}

	function forView(view: Pick<View, 'icon'> | null | undefined) {
		return resolve(view?.icon, defaultViewIcon)
	}

	function forNote(note: Pick<NoteViewItem, 'spaceId' | 'spaceIcon'>) {
		const space = spaceStore.spaces.find((item) => item.id === note.spaceId)
		return resolve(space?.icon ?? note.spaceIcon, defaultSpaceIcon)
	}

	return { resolve, forSpace, forView, forNote }
}
