<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const appConfig = useAppConfig()

const items = computed<NavigationMenuItem[]>(() => [
	{
		label: $t('settings.preferences.label'),
		icon: appConfig.ui.icons.settings,
		to: appConfig.routes.settings.preferences,
	},
])
</script>

<template>
	<LayoutSidebar>
		<UNavigationMenu :items="items" orientation="vertical" />
	</LayoutSidebar>
</template>
