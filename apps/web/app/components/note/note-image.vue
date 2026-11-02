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
	<span v-if="source && !hidden" class="inline-block max-w-full" @click.stop>
		<ProseImg
			:src="source"
			:alt="alt ?? ''"
			:width="width"
			:height="height"
			class="w-auto max-w-full rounded-lg"
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
		/>
	</span>
</template>
