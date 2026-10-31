<script setup lang="ts">
import { builtinView, sidebarKind } from '#shared/types/view'
import type { ListNotesResponse } from '#shared/types/note'
import { noteQueryFromFilter } from '~/utils/note-query'

definePageMeta({ layout: false })

const noteStore = useNoteStore()
const { visibleNotes } = storeToRefs(noteStore)
const viewStore = useViewStore()
const spaceStore = useSpaceStore()
const tagStore = useTagStore()
const { noteColumnMode } = storeToRefs(viewStore)
const session = useAuthSession()
const route = useRoute()
const requestFetch = useRequestFetch()

const { data: initialNotes } = await useAsyncData(`notes:${route.fullPath}`, async () => {
	if (import.meta.client || !session.value.data?.user || route.query.view) return null
	return requestFetch<ListNotesResponse>('/api/notes', {
		query: {
			limit: noteStore.pageSize,
			sort: viewStore.noteSort,
			...noteQueryFromFilter(noteStore.inboxScope),
		},
	}).catch(() => null)
})
if (initialNotes.value) noteStore.hydrate(initialNotes.value)

const title = computed(() => {
	const target = viewStore.target
	if (target.kind === sidebarKind.view) {
		return viewStore.views.find((view) => view.id === target.id)?.name ?? $t('note.library')
	}
	if (target.kind === sidebarKind.space) {
		return spaceStore.spaces.find((space) => space.id === target.id)?.name ?? $t('note.library')
	}
	if (target.kind === sidebarKind.tag) {
		return tagStore.tags.find((tag) => tag.id === target.id)?.name ?? $t('note.library')
	}
	return $t('note.library')
})

const label = computed(() =>
	viewStore.target.kind === builtinView.library && noteStore.loaded ? noteStore.total : undefined,
)

const noteList = useTemplateRef<{
	scrollToTop: () => void
	scrollToIndex: (index: number) => void
}>('noteList')

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
			:columns="noteColumnMode"
			show-actions
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
