import type { DropdownMenuItem } from '@nuxt/ui'
import { noteColumnModes } from '~/utils/note-columns'
import type { NoteColumnMode } from '~/utils/note-columns'

export function useNoteColumnMenu() {
	const viewStore = useViewStore()
	const { t } = useI18n()
	const appConfig = useAppConfig()

	const labels = computed<Record<NoteColumnMode, string>>(() => ({
		auto: t('note.columnsAuto'),
		single: t('note.columnsSingle'),
		double: t('note.columnsDouble'),
		triple: t('note.columnsTriple'),
	}))

	const items = computed<DropdownMenuItem[]>(() =>
		noteColumnModes.map((mode) => ({
			type: 'checkbox' as const,
			label: labels.value[mode],
			checked: viewStore.noteColumnMode === mode,
			onSelect: (event: Event) => {
				event.preventDefault()
				viewStore.noteColumnMode = mode
			},
		})),
	)

	const item = computed<DropdownMenuItem>(() => ({
		label: t('note.columns'),
		icon: appConfig.ui.icons.grid,
		children: items.value,
	}))

	return { item, items }
}
