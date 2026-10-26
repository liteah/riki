<script setup lang="ts">
import { builtinView, sidebarKind } from '#shared/types/view'
import { resolveNoteColumnLanes } from '~/utils/note-columns'

const { t } = useI18n()
const noteStore = useNoteStore()
const { visibleNotes } = storeToRefs(noteStore)
const viewStore = useViewStore()
const { noteColumnMode } = storeToRefs(viewStore)
const spaceStore = useSpaceStore()
const tagStore = useTagStore()

const title = computed(() => {
	const target = viewStore.target
	if (target.kind === sidebarKind.view) {
		return viewStore.views.find((view) => view.id === target.id)?.name ?? t('note.library')
	}
	if (target.kind === sidebarKind.space) {
		return spaceStore.spaces.find((space) => space.id === target.id)?.name ?? t('note.library')
	}
	if (target.kind === sidebarKind.tag) {
		return tagStore.tags.find((tag) => tag.id === target.id)?.name ?? t('note.library')
	}
	return t('note.library')
})

const label = computed(() =>
	viewStore.target.kind === builtinView.library && noteStore.loaded ? noteStore.total : undefined,
)

const scrollArea = useTemplateRef<{
	$el: HTMLElement
	virtualizer?: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void }
}>('scrollArea')

const { width: listWidth } = useElementSize(() => scrollArea.value?.$el)
const lanes = computed(() =>
	resolveNoteColumnLanes(noteColumnMode.value, Math.max(0, listWidth.value - 16)),
)
const listUi = computed(() => {
	if (noteColumnMode.value === 'single') return { viewport: 'mx-auto max-w-2xl' }
	if (noteColumnMode.value === 'double') return { viewport: 'mx-auto max-w-4xl' }
})

function scrollToTop() {
	scrollArea.value?.virtualizer?.scrollToIndex(0, { align: 'start' })
}

function scrollToIndex(index: number) {
	scrollArea.value?.virtualizer?.scrollToIndex(index, { align: 'auto' })
}

const { selectedId } = useNoteListShortcuts(visibleNotes, scrollToIndex, openComposer)

noteStore.start()

onMounted(() => {
	useInfiniteScroll(
		() => scrollArea.value?.$el,
		() => void noteStore.loadMore(),
		{ distance: 200 },
	)
})

watch(() => visibleNotes.value[0]?.id, scrollToTop)
</script>

<template>
	<NoteSidebar />
	<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
		<LayoutPageHeader :title="title" :label="label">
			<template #right>
				<NoteLibraryMenu />
			</template>
		</LayoutPageHeader>
		<UScrollArea
			v-if="visibleNotes.length"
			ref="scrollArea"
			v-slot="{ item }"
			:items="visibleNotes"
			shadow
			:virtualize="{ gap: 8, lanes, estimateSize: 200 }"
			:ui="listUi"
			class="size-full p-2"
		>
			<NoteListItem
				:note="item"
				give-actions
				actions-menu
				:selected="selectedId === item.id"
				@select="openComposer"
			/>
		</UScrollArea>
		<NoteEmptyState
			v-else-if="noteStore.loaded"
			class="flex min-h-0 flex-1 items-center justify-center p-6"
		/>
		<div class="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
			<NoteNewButton />
		</div>
	</div>
	<ChatSidebar />
</template>
