<script setup lang="ts">
const appConfig = useAppConfig()
const shortcutStore = useShortcutStore()

const { sidebarOpen } = storeToRefs(useViewStore())

defineProps<{
	title?: string
	label?: string | number
}>()
</script>

<template>
	<div
		class="sticky top-0 z-40 grid h-(--ui-header-height) w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-default px-2"
	>
		<div class="flex min-w-0 items-center gap-1">
			<template v-if="!sidebarOpen">
				<UTooltip v-if="$route.path.startsWith('/settings')" :text="$t('common.back')">
					<UButton
						:icon="appConfig.ui.icons.arrowLeft"
						color="neutral"
						variant="ghost"
						:aria-label="$t('common.back')"
						to="/"
					/>
				</UTooltip>
				<UTooltip :text="$t('header.openSidebar')" :kbds="shortcutStore.kbds('toggleSidebar')">
					<UButton
						:icon="appConfig.ui.icons.sidebar"
						color="neutral"
						variant="ghost"
						:aria-label="$t('header.openSidebar')"
						@click="sidebarOpen = true"
					/>
				</UTooltip>
				<LayoutCommandPaletteButton />
				<div class="max-lg:hidden">
					<NoteNewButton variant="ghost" />
				</div>
			</template>
			<LayoutCommandPaletteButton v-if="isTauri && sidebarOpen" />
			<slot name="left" />
		</div>
		<div class="flex min-w-0 items-center justify-center gap-2">
			<slot>
				<span class="min-w-0 truncate text-sm font-medium">{{ title }}</span>
				<span v-if="label !== undefined" class="shrink-0 text-sm text-muted">{{ label }}</span>
			</slot>
		</div>
		<div class="flex min-w-0 items-center justify-end gap-1">
			<slot name="right" />
		</div>
	</div>
</template>
