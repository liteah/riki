<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import { noteInbox } from '#shared/types/note'
import type { ListNotesResponse, NoteInbox } from '#shared/types/note'
import { noteQueryFromFilter } from '~/utils/note-query'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const noteStore = useNoteStore()
const { visibleNotes, reviewNotes } = storeToRefs(noteStore)
const viewStore = useViewStore()
const appConfig = useAppConfig()
const session = useAuthSession()
const requestFetch = useRequestFetch()
const reviewPending = ref(false)
const reviewMounted = ref(false)

const noteList = useTemplateRef<{ scrollToIndex: (index: number) => void }>('noteList')

const { selectedId } = useNoteListShortcuts(
	visibleNotes,
	(index) => noteList.value?.scrollToIndex(index),
	openComposer,
)

noteStore.start()

async function refreshReview(force = false) {
	reviewPending.value = true
	try {
		await noteStore.loadReview(force)
	} finally {
		reviewPending.value = false
	}
}

function isInboxTab(value: unknown): value is NoteInbox {
	return typeof value === 'string' && (Object.values(noteInbox) as string[]).includes(value)
}

const inbox = ref<NoteInbox>(isInboxTab(route.query.tab) ? route.query.tab : noteInbox.unassigned)
const notesReady = inbox.value === noteInbox.review ? undefined : useNoteListReady()

const tabs = computed<NavigationMenuItem[]>(() => {
	const items: NavigationMenuItem[] = [
		{ label: $t('inbox.unassigned'), value: noteInbox.unassigned },
		{ label: $t('note.later'), value: noteInbox.later },
		{
			label: $t('inbox.review'),
			value: noteInbox.review,
			disabled: !session.value.data?.user,
		},
	]
	return items.map((tab) => ({
		...tab,
		active: inbox.value === tab.value,
		onSelect: () => {
			if (tab.disabled || !isInboxTab(tab.value)) return
			inbox.value = tab.value
		},
	}))
})

watch(
	inbox,
	(value) => {
		selectedId.value = null
		if (value === noteInbox.review) {
			if (route.query.tab !== value) router.replace({ query: { ...route.query, tab: value } })
			if (reviewMounted.value) void refreshReview()
			return
		}
		noteStore.inbox = value
		if (route.query.tab === value) return
		const query: LocationQueryRaw = { ...route.query }
		if (value === noteInbox.unassigned) delete query.tab
		else query.tab = value
		router.replace({ query })
	},
	{ immediate: true },
)

watch(
	() => route.query.tab,
	(value) => {
		if (isInboxTab(value) && value !== inbox.value) inbox.value = value
	},
)

onMounted(() => {
	reviewMounted.value = true
	if (inbox.value === noteInbox.review) void refreshReview()
})

const { data: initialNotes } = await useAsyncData(`inbox:${route.fullPath}`, async () => {
	if (import.meta.client || !session.value.data?.user || inbox.value === noteInbox.review)
		return null
	return requestFetch<ListNotesResponse>('/api/notes', {
		query: {
			limit: noteStore.pageSize,
			sort: viewStore.noteSort,
			...noteQueryFromFilter(noteStore.inboxScope),
		},
	}).catch(() => null)
})
if (initialNotes.value) noteStore.hydrate(initialNotes.value)
</script>

<template>
	<NuxtLayout name="note" :title="$t('note.inbox')">
		<template #header>
			<UNavigationMenu
				:ui="{ root: 'justify-center', item: 'py-0', link: 'py-1' }"
				orientation="horizontal"
				color="neutral"
				variant="link"
				:items="tabs"
			/>
		</template>
		<template #header-actions>
			<UTooltip v-if="inbox === noteInbox.review" :text="$t('inbox.shuffle')">
				<UButton
					:icon="appConfig.ui.icons.refresh"
					:aria-label="$t('inbox.shuffle')"
					color="neutral"
					variant="ghost"
					size="sm"
					square
					:disabled="reviewPending"
					@click="refreshReview(true)"
				/>
			</UTooltip>
		</template>
		<NoteList
			v-if="inbox === noteInbox.review"
			:notes="reviewNotes"
			:loaded="!reviewPending"
			columns="single"
			show-actions
			@select="openComposer"
		>
			<template #empty>
				<UEmpty variant="naked" :icon="appConfig.ui.icons.note" :title="$t('inbox.emptyTitle')" />
			</template>
		</NoteList>
		<Suspense v-else>
			<NoteList
				ref="noteList"
				:notes="visibleNotes"
				:selected-id="selectedId"
				:loaded="noteStore.loaded"
				columns="single"
				:ready="notesReady"
				show-actions
				@select="openComposer"
				@load-more="noteStore.loadMore()"
			>
				<template #empty>
					<UEmpty variant="naked" :icon="appConfig.ui.icons.note" :title="$t('inbox.emptyTitle')" />
				</template>
			</NoteList>
			<template #fallback>
				<NoteListSkeleton columns="single" />
			</template>
		</Suspense>
	</NuxtLayout>
</template>
