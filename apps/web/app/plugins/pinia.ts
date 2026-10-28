import type { Pinia } from 'pinia'
import { TauriPluginPinia } from '@tauri-store/pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

export default defineNuxtPlugin(({ $pinia }) => {
	const pinia = $pinia as Pinia

	if (isTauri) pinia.use(TauriPluginPinia())
	pinia.use(
		createPersistedState({
			storage: import.meta.client
				? window.localStorage
				: { getItem: () => null, setItem: () => {} },
		}),
	)
})
