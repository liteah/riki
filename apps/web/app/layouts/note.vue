<script setup lang="ts">
defineProps<{
	title?: string
	label?: string | number
}>()
</script>

<template>
	<div class="flex h-full min-h-0 flex-1">
		<NoteSidebar />
		<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
			<LayoutPageHeader v-if="$slots.header" :title="title" :label="label">
				<slot name="header" />
				<template #right>
					<slot name="header-actions" />
				</template>
			</LayoutPageHeader>
			<LayoutPageHeader v-else :title="title" :label="label">
				<template #right>
					<slot name="header-actions" />
				</template>
			</LayoutPageHeader>
			<div class="min-h-0 w-full flex-1">
				<slot />
			</div>
			<div class="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
				<NoteNewButton />
			</div>
		</div>
		<ChatSidebar />
	</div>
</template>
