<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const appConfig = useAppConfig()

const items = computed<NavigationMenuItem[]>(() => [
	{
		label: $t('settings.preferences.label'),
		icon: appConfig.ui.icons.settings,
		to: appConfig.routes.settings.preferences,
	},
	{
		label: $t('settings.shortcuts.label'),
		icon: appConfig.ui.icons.keyboard,
		to: appConfig.routes.settings.shortcuts,
	},
	{
		label: $t('settings.account.label'),
		icon: appConfig.ui.icons.user,
		to: appConfig.routes.settings.account,
	},
	{
		label: $t('settings.apiKeys.label'),
		icon: appConfig.ui.icons.key,
		to: appConfig.routes.settings.apiKeys,
	},
])
</script>

<template>
	<LayoutSidebar>
		<UNavigationMenu :items="items" orientation="vertical" color="neutral" />
	</LayoutSidebar>
</template>
