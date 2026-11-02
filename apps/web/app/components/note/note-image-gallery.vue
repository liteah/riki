<script setup lang="ts">
import type { NoteImageSource } from '#shared/utils/note-content'

const props = defineProps<{ images: NoteImageSource[] }>()

const visible = computed(() => props.images.slice(0, 4))
const hiddenCount = computed(() => Math.max(0, props.images.length - visible.value.length))
const gridClass = computed(() => (visible.value.length === 1 ? 'grid-cols-1' : 'grid-cols-2'))

function tileClass(index: number) {
	if (visible.value.length === 1) return 'aspect-video'
	if (visible.value.length === 3 && index === 0) return 'col-span-2 aspect-video'
	return 'aspect-square'
}
</script>

<template>
	<div class="overflow-hidden rounded-lg bg-muted">
		<div class="grid gap-0.5" :class="gridClass">
			<div
				v-for="(image, index) in visible"
				:key="image.src"
				class="relative overflow-hidden"
				:class="tileClass(index)"
				@click.stop
			>
				<ProseImg
					:src="image.src"
					:alt="image.alt ?? ''"
					class="size-full rounded-none object-cover"
					loading="lazy"
					decoding="async"
					referrerpolicy="no-referrer"
				/>
				<div
					v-if="index === 3 && hiddenCount"
					class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-semibold text-white"
				>
					+{{ hiddenCount }}
				</div>
			</div>
		</div>
	</div>
</template>
