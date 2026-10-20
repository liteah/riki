<script setup lang="ts">
const appConfig = useAppConfig()

const open = useLocalStorage('sidebar-open', true)

defineProps<{
	title?: string
	label?: string | number
}>()
</script>

<template>
	<div
		class="grid h-(--ui-header-height) w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2"
	>
		<div class="flex min-w-0 items-center gap-1">
			<UButton
				:icon="appConfig.ui.icons.sidebar"
				color="neutral"
				variant="ghost"
				:aria-label="$t('header.openSidebar')"
				@click="open = !open"
			/>
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
