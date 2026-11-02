<script setup lang="ts">
import { normalizeNoteImageSource } from '#shared/utils/note-content'

const props = defineProps<{
	src?: string
	alt?: string
	width?: string | number
	height?: string | number
	suppressed?: ReadonlySet<string>
}>()

const source = computed(() => (props.src ? normalizeNoteImageSource(props.src) : null))
const hidden = computed(() => Boolean(source.value && props.suppressed?.has(source.value)))
</script>

<template>
	<img
		v-if="source && !hidden"
		:src="source"
		:alt="alt ?? ''"
		:width="width"
		:height="height"
		class="max-w-full rounded-lg"
		loading="lazy"
		decoding="async"
		referrerpolicy="no-referrer"
	/>
</template>
