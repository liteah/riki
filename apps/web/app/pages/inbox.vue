<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import { noteInbox } from '#shared/types/note'
import type { NoteInbox } from '#shared/types/note'

const route = useRoute()
const router = useRouter()
const noteStore = useNoteStore()
const { visibleNotes } = storeToRefs(noteStore)
const appConfig = useAppConfig()
const { t } = useI18n()

const scrollArea = useTemplateRef<{
	$el: HTMLElement
	virtualizer?: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void }
}>('scrollArea')

function scrollToIndex(index: number) {
	scrollArea.value?.virtualizer?.scrollToIndex(index, { align: 'auto' })
}

const { selectedId } = useNoteListShortcuts(visibleNotes, scrollToIndex, openComposer)

noteStore.start()

function isInboxTab(value: unknown): value is NoteInbox {
	return typeof value === 'string' && (Object.values(noteInbox) as string[]).includes(value)
}

const inbox = ref<NoteInbox>(isInboxTab(route.query.tab) ? route.query.tab : noteInbox.unassigned)

const tabs = computed<NavigationMenuItem[]>(() => {
	const items: NavigationMenuItem[] = [
		{ label: t('inbox.unassigned'), value: noteInbox.unassigned },
		{ label: t('inbox.later'), value: noteInbox.later },
		{ label: t('inbox.review'), value: 'review', disabled: true },
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

onMounted(() => {
	useInfiniteScroll(
		() => scrollArea.value?.$el,
		() => void noteStore.loadMore(),
		{ distance: 200 },
	)
})
</script>

<template>
	<NoteSidebar />
	<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
		<LayoutPageHeader>
			<UNavigationMenu
				:ui="{ root: 'justify-center', item: 'py-0', link: 'py-1' }"
				orientation="horizontal"
				color="neutral"
				variant="link"
				:items="tabs"
			/>
		</LayoutPageHeader>
		<UScrollArea
			v-if="visibleNotes.length"
			ref="scrollArea"
			v-slot="{ item }"
			:items="visibleNotes"
			shadow
			:virtualize="{ gap: 8, estimateSize: 200 }"
			class="size-full p-2"
		>
			<div class="mx-auto w-full max-w-2xl">
				<NoteListItem
					:note="item"
					give-actions
					:selected="selectedId === item.id"
					@select="openComposer"
				/>
			</div>
		</UScrollArea>
		<UEmpty
			v-else-if="noteStore.loaded"
			variant="naked"
			:icon="appConfig.ui.icons.note"
			:title="$t('inbox.emptyTitle')"
			class="flex min-h-0 flex-1 items-center justify-center p-6"
		/>
		<div class="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
			<NoteNewButton />
		</div>
	</div>
	<ChatSidebar />
</template>
