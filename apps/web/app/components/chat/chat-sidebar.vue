<script setup lang="ts">
const open = ref(false)
</script>

<template>
	<USidebar
		v-model:open="open"
		title="AI Chat"
		side="right"
		collapsible="offcanvas"
		close
		:ui="{ container: 'h-full' }"
	>
		TODO
	</USidebar>
</template>
