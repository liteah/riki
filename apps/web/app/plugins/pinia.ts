import type { Pinia } from 'pinia'
import { TauriPluginPinia } from '@tauri-store/pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

export default defineNuxtPlugin((nuxtApp) => {
	const pinia = nuxtApp.$pinia as Pinia
	let storageReady = false
	const storage = import.meta.client
		? {
				getItem: (key: string) => (storageReady ? window.localStorage.getItem(key) : null),
				setItem: (key: string, value: string) => {
					if (storageReady) window.localStorage.setItem(key, value)
				},
			}
		: { getItem: () => null, setItem: () => {} }

	if (isTauri) pinia.use(TauriPluginPinia())
	pinia.use(createPersistedState({ storage }))

	if (import.meta.client) {
		nuxtApp.hook('app:mounted', () => {
			storageReady = true
			const settings = pinia._s.get('settings') as { $hydrate?: () => void } | undefined
			settings?.$hydrate?.()
		})
	}
})
