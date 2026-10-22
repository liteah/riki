<script setup lang="ts">
import { openCommandPalette } from '~/utils/command-palette'

const appConfig = useAppConfig()
const shortcutStore = useShortcutStore()
</script>

<template>
	<UTooltip :text="$t('common.search')" :kbds="shortcutStore.kbds('commandPalette')">
		<UButton
			:icon="appConfig.ui.icons.search"
			color="neutral"
			variant="ghost"
			:aria-label="$t('common.search')"
			@click="openCommandPalette"
		/>
	</UTooltip>
</template>
