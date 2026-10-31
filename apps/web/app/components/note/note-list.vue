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

const settingsStore = useSettingsStore()
const { state: settings } = storeToRefs(settingsStore)

const SSR_LIST_WIDTH = 1024
const CHARS_PER_LINE = 44
const LINE_HEIGHT = 24
const MAX_CONTENT_HEIGHT = 500
const PREVIEW_HEIGHT = 104

function estimateNoteHeight(note: NoteViewItem, linkPreviews: boolean) {
	const lines = note.content.split('\n').reduce((total, line) => {
		return total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE))
	}, 0)
	const hasPreview = linkPreviews && Object.keys(note.linkPreviews ?? {}).length > 0
	return 96 + Math.min(MAX_CONTENT_HEIGHT, lines * LINE_HEIGHT) + (hasPreview ? PREVIEW_HEIGHT : 0)
}

const { width: listWidth } = useElementSize(() => scrollArea.value?.$el)
const lanes = computed(() =>
	resolveNoteColumnLanes(props.columns, Math.max(0, (listWidth.value || SSR_LIST_WIDTH) - 16)),
)

function noteKey(index: number) {
	return props.notes[index]?.id ?? index
}

// ScrollArea captures the object once; keep it unconditional or measured mode is lost.
const virtualize = computed(() => ({
	gap: 8,
	overscan: 4,
	estimateSize: (index: number) => {
		const note = props.notes[index]
		return note ? estimateNoteHeight(note, settings.value.linkPreviewEnabled) : 200
	},
	lanes: lanes.value,
	laneAssignmentMode: 'measured' as const,
	getItemKey: noteKey,
	initialRect: { width: 0, height: 800 },
}))

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
