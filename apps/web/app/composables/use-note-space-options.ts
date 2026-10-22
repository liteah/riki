import type { DropdownMenuItem } from '@nuxt/ui'

export function useNoteSpaceOptions(
	spaceId: () => string | null,
	onSelect: (spaceId: string | null) => void,
	onCreate: () => void,
) {
	const { t } = useI18n()
	const appConfig = useAppConfig()
	const spaceStore = useSpaceStore()

	const items = computed<DropdownMenuItem[][]>(() => {
		const groups: DropdownMenuItem[][] = []

		if (spaceStore.spaces.length) {
			groups.push(
				spaceStore.spaces.map((space) => ({
					label: space.name,
					icon: spaceStore.iconForSpace(space),
					onSelect: () => onSelect(space.id),
				})),
			)
		} else {
			groups.push([{ label: t('space.new'), icon: appConfig.ui.icons.plus, onSelect: onCreate }])
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

		return groups
	})

	return { items }
}
