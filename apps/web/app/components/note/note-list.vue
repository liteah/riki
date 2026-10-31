<script setup lang="ts">
import type { NoteViewItem } from '#shared/types/note'
import type { NoteColumnMode } from '~/utils/note-columns'
import { resolveNoteColumnLanes } from '~/utils/note-columns'

const props = withDefaults(
	defineProps<{
		notes: NoteViewItem[]
		selectedId?: string | null
		loaded?: boolean
		showActions?: boolean
		actionsMenu?: boolean
		columns?: NoteColumnMode
	}>(),
	{ columns: 'auto' },
)

const emit = defineEmits<{
	select: [note: NoteViewItem]
	loadMore: []
}>()

const scrollArea = useTemplateRef<{
	$el: HTMLElement
	virtualizer?: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void }
}>('scrollArea')

const { width: listWidth } = useElementSize(() => scrollArea.value?.$el)
const lanes = computed(() =>
	resolveNoteColumnLanes(props.columns, Math.max(0, listWidth.value - 16)),
)

const virtualize = computed(() =>
	lanes.value > 1
		? {
				gap: 8,
				estimateSize: 200,
				lanes: lanes.value,
				laneAssignmentMode: 'measured' as const,
			}
		: { gap: 8, estimateSize: 200 },
)

const scrollAreaUi = computed(() => {
	if (props.columns === 'single') return { viewport: 'mx-auto max-w-2xl' }
	if (props.columns === 'double') return { viewport: 'mx-auto max-w-4xl' }
})

function scrollToTop() {
	scrollArea.value?.virtualizer?.scrollToIndex(0, { align: 'start' })
}

function scrollToIndex(index: number) {
	scrollArea.value?.virtualizer?.scrollToIndex(index, { align: 'auto' })
}

onMounted(() => {
	useInfiniteScroll(
		() => scrollArea.value?.$el,
		() => emit('loadMore'),
		{ distance: 200 },
	)
})

defineExpose({ scrollToTop, scrollToIndex })
</script>

<template>
	<UScrollArea
		v-if="notes.length"
		ref="scrollArea"
		v-slot="{ item }"
		:items="notes"
		shadow
		:virtualize="virtualize"
		:ui="scrollAreaUi"
		class="size-full p-2"
	>
		<NoteListItem
			:note="item"
			:show-actions="showActions"
			:actions-menu="actionsMenu"
			:selected="selectedId === item.id"
			@select="emit('select', $event)"
		/>
	</UScrollArea>
	<div v-else-if="loaded" class="flex min-h-0 flex-1 items-center justify-center p-6">
		<slot name="empty" />
	</div>
</template>
