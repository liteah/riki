<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const title = computed(() =>
	typeof route.meta.title === 'string' ? t(route.meta.title) : undefined,
)
</script>

<template>
	<div class="flex h-full min-h-0 flex-1">
		<SettingsSidebar />
		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<LayoutPageHeader :title="title">
				<template #right>
					<slot name="header-actions" />
				</template>
			</LayoutPageHeader>
			<div class="min-h-0 flex-1 overflow-y-auto p-4">
				<div class="mx-auto w-full max-w-2xl">
					<slot />
				</div>
			</div>
		</div>
	</div>
</template>
