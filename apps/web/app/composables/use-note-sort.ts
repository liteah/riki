import type { DropdownMenuItem } from '@nuxt/ui'
import { noteSortValues } from '#shared/types/note'
import type { NoteSort } from '#shared/types/note'

export function useNoteSortMenu() {
	const viewStore = useViewStore()
	const { t } = useI18n()
	const appConfig = useAppConfig()

	const labels = computed<Record<NoteSort, string>>(() => ({
		'created-desc': t('note.sortCreatedDesc'),
		'created-asc': t('note.sortCreatedAsc'),
		'updated-desc': t('note.sortUpdatedDesc'),
		'updated-asc': t('note.sortUpdatedAsc'),
	}))

	const items = computed<DropdownMenuItem[]>(() =>
		noteSortValues.map((sort) => ({
			type: 'checkbox' as const,
			label: labels.value[sort],
			checked: viewStore.noteSort === sort,
			onSelect: (event: Event) => {
				event.preventDefault()
				viewStore.noteSort = sort
			},
		})),
	)

	const item = computed<DropdownMenuItem>(() => ({
		label: t('note.sort'),
		icon: appConfig.ui.icons.sort,
		children: items.value,
	}))

	return { item, items }
}
