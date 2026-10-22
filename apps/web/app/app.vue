<script setup lang="ts">
useGlobalShortcuts()
</script>

<template>
	<AppTheme>
		<LayoutHeader v-if="isTauri" />
		<main :class="isTauri ? 'h-[calc(100vh-var(--ui-header-height))]' : 'h-svh'">
			<NuxtLayout>
				<NuxtPage />
			</NuxtLayout>
		</main>
	</AppTheme>
</template>
