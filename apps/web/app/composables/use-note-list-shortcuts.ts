import type { Ref } from 'vue'
import type { NoteListItem } from '#shared/types/note'
import { eventToShortcut } from '~/utils/shortcuts'

export function useNoteListShortcuts(
	notes: Ref<NoteListItem[]>,
	scrollToIndex: (index: number) => void,
	open: (note: NoteListItem) => void,
) {
	const shortcutStore = useShortcutStore()
	const session = useAuthSession()
	const selectedId = ref<string | null>(null)

	const viewerId = computed(() => session.value.data?.user?.id ?? null)

	function currentIndex() {
		return selectedId.value ? notes.value.findIndex((note) => note.id === selectedId.value) : -1
	}

	function selectAt(index: number) {
		const note = notes.value[index]
		if (!note) return
		selectedId.value = note.id
		scrollToIndex(index)
	}

	function move(offset: number) {
		if (!notes.value.length) return
		const index = currentIndex()
		const next = offset > 0 ? Math.min(index + 1, notes.value.length - 1) : Math.max(index - 1, 0)
		if (next !== index) selectAt(next)
	}

	function overlaysOpen() {
		return Boolean(document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]'))
	}

	function targetIsInteractive(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false
		return Boolean(
			target.closest(
				'input, textarea, select, button, a, [contenteditable="true"], [role="menuitem"], [role="option"]',
			),
		)
	}

	useEventListener('keydown', (event) => {
		if (overlaysOpen() || targetIsInteractive(event.target)) return

		if (
			event.key === 'Escape' &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey
		) {
			if (!selectedId.value) return
			event.preventDefault()
			selectedId.value = null
			return
		}

		const shortcut = eventToShortcut(event, true)
		if (!shortcut) return

		if (shortcut === shortcutStore.bindings.previousNote) {
			event.preventDefault()
			move(-1)
			return
		}

		if (shortcut === shortcutStore.bindings.nextNote) {
			event.preventDefault()
			move(1)
			return
		}

		if (shortcut === shortcutStore.bindings.openNote) {
			if (event.repeat) return
			const note = notes.value[currentIndex()]
			if (!note || note.userId !== viewerId.value) return
			event.preventDefault()
			open(note)
		}
	})

	watch(notes, (list, previous) => {
		if (!selectedId.value) return
		if (list.some((note) => note.id === selectedId.value)) return
		const index = previous?.findIndex((note) => note.id === selectedId.value) ?? -1
		selectedId.value = null
		if (index === -1 || !list.length) return
		void nextTick(() => selectAt(Math.min(index, list.length - 1)))
	})

	return { selectedId }
}
