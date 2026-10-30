<script setup lang="ts">
import { builtinView, sidebarKind } from '#shared/types/view'
import { resolveNoteColumnLanes } from '~/utils/note-columns'

definePageMeta({ layout: false })

const { t } = useI18n()
const noteStore = useNoteStore()
const { visibleNotes } = storeToRefs(noteStore)
const viewStore = useViewStore()
const spaceStore = useSpaceStore()
const tagStore = useTagStore()
const { noteColumnMode } = storeToRefs(viewStore)

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

const noteList = useTemplateRef<{
	getElement: () => HTMLElement | undefined
	scrollToTop: () => void
	scrollToIndex: (index: number) => void
}>('noteList')

const { width: listWidth } = useElementSize(() => noteList.value?.getElement())
const lanes = computed(() =>
	resolveNoteColumnLanes(noteColumnMode.value, Math.max(0, listWidth.value - 16)),
)
const listUi = computed(() => {
	if (noteColumnMode.value === 'single') return { viewport: 'mx-auto max-w-2xl' }
	if (noteColumnMode.value === 'double') return { viewport: 'mx-auto max-w-4xl' }
})

const { selectedId } = useNoteListShortcuts(
	visibleNotes,
	(index) => noteList.value?.scrollToIndex(index),
	openComposer,
)

noteStore.start()

watch(
	() => visibleNotes.value[0]?.id,
	() => noteList.value?.scrollToTop(),
)
</script>

<template>
	<NuxtLayout name="note" :title="title" :label="label">
		<template #header-actions>
			<NoteLibraryMenu />
		</template>
		<NoteList
			ref="noteList"
			:notes="visibleNotes"
			:selected-id="selectedId"
			:loaded="noteStore.loaded"
			:lanes="lanes"
			:ui="listUi"
			give-actions
			actions-menu
			@select="openComposer"
			@load-more="noteStore.loadMore()"
		>
			<template #empty>
				<NoteEmptyState />
			</template>
		</NoteList>
	</NuxtLayout>
</template>
