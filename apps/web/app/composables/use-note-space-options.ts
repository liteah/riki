import type { DropdownMenuItem } from '@nuxt/ui'

export function useNoteSpaceFilterOptions(
	selectedIds: () => string[],
	onToggle: (spaceId: string) => void,
	onCreate: () => void,
) {
	const { t } = useI18n()
	const appConfig = useAppConfig()
	const spaceStore = useSpaceStore()
	const { forSpace } = useEntityIcon()

	const items = computed<DropdownMenuItem[][]>(() => {
		const groups: DropdownMenuItem[][] = []
		if (spaceStore.spaces.length) {
			groups.push(
				spaceStore.spaces.map((space) => ({
					type: 'checkbox' as const,
					label: space.name,
					icon: forSpace(space),
					checked: selectedIds().includes(space.id),
					onSelect: (event: Event) => {
						event.preventDefault()
						onToggle(space.id)
					},
				})),
			)
		}
		groups.push([{ label: t('space.new'), icon: appConfig.ui.icons.plus, onSelect: onCreate }])
		return groups
	})

	return { items }
}

export function useNoteSpaceOptions(
	spaceId: () => string | null,
	onSelect: (spaceId: string | null) => void,
	onCreate: () => void,
) {
	const { t } = useI18n()
	const appConfig = useAppConfig()
	const spaceStore = useSpaceStore()
	const { forSpace } = useEntityIcon()

	const items = computed<DropdownMenuItem[][]>(() => {
		const groups: DropdownMenuItem[][] = []

		if (spaceStore.spaces.length) {
			groups.push(
				spaceStore.spaces.map((space) => ({
					label: space.name,
					icon: forSpace(space),
					onSelect: () => onSelect(space.id),
				})),
			)
		}

		if (spaceId()) {
			groups.push([
				{
					label: t('note.removeFromSpace'),
					icon: appConfig.ui.icons.inbox,
					onSelect: () => onSelect(null),
				},
			])
		}

		groups.push([{ label: t('space.new'), icon: appConfig.ui.icons.plus, onSelect: onCreate }])

		return groups
	})

	return { items }
}
