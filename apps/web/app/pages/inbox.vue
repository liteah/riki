<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import { noteInbox } from '#shared/types/note'
import type { NoteInbox } from '#shared/types/note'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const noteStore = useNoteStore()
const { visibleNotes } = storeToRefs(noteStore)
const appConfig = useAppConfig()

const noteList = useTemplateRef<{ scrollToIndex: (index: number) => void }>('noteList')

const { selectedId } = useNoteListShortcuts(
	visibleNotes,
	(index) => noteList.value?.scrollToIndex(index),
	openComposer,
)

noteStore.start()

function isInboxTab(value: unknown): value is NoteInbox {
	return typeof value === 'string' && (Object.values(noteInbox) as string[]).includes(value)
}

const inbox = ref<NoteInbox>(isInboxTab(route.query.tab) ? route.query.tab : noteInbox.unassigned)

const tabs = computed<NavigationMenuItem[]>(() => {
	const items: NavigationMenuItem[] = [
		{ label: $t('inbox.unassigned'), value: noteInbox.unassigned },
		{ label: $t('note.later'), value: noteInbox.later },
		{ label: $t('inbox.review'), value: 'review', disabled: true },
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
		<NoteList
			ref="noteList"
			:notes="visibleNotes"
			:selected-id="selectedId"
			:loaded="noteStore.loaded"
			columns="single"
			show-actions
			@select="openComposer"
			@load-more="noteStore.loadMore()"
		>
			<template #empty>
				<UEmpty variant="naked" :icon="appConfig.ui.icons.note" :title="$t('inbox.emptyTitle')" />
			</template>
		</NoteList>
	</NuxtLayout>
</template>
