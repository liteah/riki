<script setup lang="ts">
import { LazyLayoutCommandPalette } from '#components'

const appConfig = useAppConfig()
// One palette instance across every trigger.
let openCommandPaletteModal: (() => void) | undefined

function openCommandPalette() {
	if (!openCommandPaletteModal) {
		const commandPalette = useOverlay().create(LazyLayoutCommandPalette)
		openCommandPaletteModal = () => commandPalette.open()
	}
	openCommandPaletteModal()
}
</script>

<template>
	<UTooltip :text="$t('common.search')">
		<UButton
			:icon="appConfig.ui.icons.search"
			color="neutral"
			variant="ghost"
			:aria-label="$t('common.search')"
			@click="openCommandPalette"
		/>
	</UTooltip>
</template>
