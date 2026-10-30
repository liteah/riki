<script setup lang="ts">
import type { NoteViewItem } from '#shared/types/note'

const props = defineProps<{
	notes: NoteViewItem[]
	selectedId?: string | null
	loaded?: boolean
	giveActions?: boolean
	actionsMenu?: boolean
	lanes?: number
	ui?: { viewport?: string }
}>()

const emit = defineEmits<{
	select: [note: NoteViewItem]
	loadMore: []
}>()

const scrollArea = useTemplateRef<{
	$el: HTMLElement
	virtualizer?: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void }
}>('scrollArea')

const virtualize = computed(() =>
	props.lanes
		? {
				gap: 8,
				estimateSize: 200,
				lanes: props.lanes,
				laneAssignmentMode: 'measured' as const,
			}
		: { gap: 8, estimateSize: 200 },
)

function scrollToTop() {
	scrollArea.value?.virtualizer?.scrollToIndex(0, { align: 'start' })
}

function scrollToIndex(index: number) {
	scrollArea.value?.virtualizer?.scrollToIndex(index, { align: 'auto' })
}

function getElement() {
	return scrollArea.value?.$el
}

onMounted(() => {
	useInfiniteScroll(
		() => scrollArea.value?.$el,
		() => emit('loadMore'),
		{ distance: 200 },
	)
})

defineExpose({ scrollToTop, scrollToIndex, getElement })
</script>

<template>
	<UScrollArea
		v-if="notes.length"
		ref="scrollArea"
		v-slot="{ item }"
		:items="notes"
		shadow
		:virtualize="virtualize"
		:ui="ui"
		class="size-full p-2"
	>
		<NoteListItem
			:note="item"
			:give-actions="giveActions"
			:actions-menu="actionsMenu"
			:selected="selectedId === item.id"
			@select="emit('select', $event)"
		/>
	</UScrollArea>
	<div v-else-if="loaded" class="flex min-h-0 flex-1 items-center justify-center p-6">
		<slot name="empty" />
	</div>
</template>
