import type { LinkPreviewMode } from '#shared/types/link-preview'
import type { AvailableLocales } from '~~/i18n/locales'
import type { TimeFormat } from '~/utils/time'

export const useSettingsStore = defineStore(
	'settings',
	() => {
		const { $i18n } = useNuxtApp()

		const state = reactive({
			locale: $i18n.locale.value as AvailableLocales,
			colorMode: 'system' as 'light' | 'dark' | 'system',
			timeZone: 'system',
			timeFormat: 'relative' as TimeFormat,
			linkPreviewMode: 'portrait' as LinkPreviewMode,
			linkPreviewHover: true,
		})

		watch(
			() => $i18n.locale.value,
			(v) => {
				state.locale = v as AvailableLocales
			},
		)

		watch(
			() => state.locale,
			(v) => {
				if (v !== $i18n.locale.value) $i18n.setLocale(v)
			},
		)

		return { state }
	},
	{
		persist: {
			pick: ['state.linkPreviewMode', 'state.linkPreviewHover'],
			afterHydrate: ({ store }) => {
				const mode = store.state.linkPreviewMode
				if (mode === 'compact') store.state.linkPreviewMode = 'landscape'
				else if (mode === 'single-large') store.state.linkPreviewMode = 'portrait'
			},
		},
	},
)
