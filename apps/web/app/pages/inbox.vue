<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { LocationQueryRaw } from 'vue-router'
import { noteFeed } from '#shared/types/note'
import type { NoteFeed } from '#shared/types/note'

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

function isFeed(value: unknown): value is NoteFeed {
	return typeof value === 'string' && (Object.values(noteFeed) as string[]).includes(value)
}

const feed = ref<NoteFeed>(isFeed(route.query.tab) ? route.query.tab : noteFeed.unassigned)

const tabs = computed<NavigationMenuItem[]>(() => {
	const items: NavigationMenuItem[] = [
		{ label: t('inbox.unassigned'), value: noteFeed.unassigned },
		{ label: t('inbox.later'), value: noteFeed.later },
		{ label: t('inbox.review'), value: 'review', disabled: true },
		{ label: t('note.statusArchived'), value: noteFeed.archived },
		{ label: t('inbox.explore'), value: noteFeed.explore },
	]
	return items.map((tab) => ({
		...tab,
		active: feed.value === tab.value,
		onSelect: () => {
			if (tab.disabled || !isFeed(tab.value)) return
			feed.value = tab.value
		},
	}))
})

const emptyStateClass = 'flex min-h-0 flex-1 items-center justify-center p-6'

const emptyState = computed(() => {
	switch (feed.value) {
		case noteFeed.later:
			return { icon: appConfig.ui.icons.later, title: t('note.laterEmptyTitle') }
		case noteFeed.archived:
			return { icon: appConfig.ui.icons.archive, title: t('note.archivedEmptyTitle') }
		case noteFeed.explore:
			return { icon: appConfig.ui.icons.globe, title: t('note.exploreEmptyTitle') }
		default:
			return null
	}
})

watch(
	feed,
	(value) => {
		selectedId.value = null
		noteStore.feed = value
		if (route.query.tab === value) return
		const query: LocationQueryRaw = { ...route.query }
		if (value === noteFeed.unassigned) delete query.tab
		else query.tab = value
		router.replace({ query })
	},
	{ immediate: true },
)

watch(
	() => route.query.tab,
	(value) => {
		if (isFeed(value) && value !== feed.value) feed.value = value
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
		<template v-else-if="noteStore.loaded">
			<NoteEmptyState v-if="!emptyState" :class="emptyStateClass" />
			<UEmpty
				v-else
				variant="naked"
				:icon="emptyState.icon"
				:title="emptyState.title"
				:class="emptyStateClass"
			/>
		</template>
		<div class="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 sm:hidden">
			<NoteNewButton />
		</div>
	</div>
	<ChatSidebar />
</template>
