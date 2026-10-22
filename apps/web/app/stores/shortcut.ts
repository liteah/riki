import { skipHydrate } from 'pinia'
import { shortcutActions, shortcutDefaults, shortcutParts } from '~/utils/shortcuts'
import type { ShortcutBindings, ShortcutId } from '~/utils/shortcuts'

export const useShortcutStore = defineStore('shortcut', () => {
	const bindings = skipHydrate(
		useLocalStorage<ShortcutBindings>(
			localKeys.shortcuts,
			{ ...shortcutDefaults },
			{ mergeDefaults: true },
		),
	)

	const allDefault = computed(() =>
		shortcutActions.every((action) => bindings.value[action.id] === shortcutDefaults[action.id]),
	)

	function setBinding(id: ShortcutId, combo: string) {
		const conflict = shortcutActions.find(
			(action) => action.id !== id && bindings.value[action.id] === combo,
		)
		if (conflict) return conflict.id
		bindings.value = { ...bindings.value, [id]: combo }
		return null
	}

	function resetAll() {
		bindings.value = { ...shortcutDefaults }
	}

	function kbds(id: ShortcutId) {
		return shortcutParts(bindings.value[id])
	}

	return { bindings, allDefault, setBinding, resetAll, kbds }
})
