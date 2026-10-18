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

const sidebarOpen = ref(true)

const scrollArea = useTemplateRef<{
	$el: HTMLElement
	virtualizer?: { scrollToIndex: (index: number, options?: Record<string, unknown>) => void }
}>('scrollArea')

noteStore.start()

function isFeed(value: unknown): value is NoteFeed {
	return typeof value === 'string' && (Object.values(noteFeed) as string[]).includes(value)
}

const feed = ref<NoteFeed>(isFeed(route.query.tab) ? route.query.tab : noteFeed.unassigned)

const selectedId = ref<string | null>(null)

const tabs = computed<NavigationMenuItem[]>(() => {
	const items: NavigationMenuItem[] = [
		{ label: t('inbox.unassigned'), value: noteFeed.unassigned },
		{ label: t('inbox.later'), value: noteFeed.later },
		{ label: t('inbox.review'), value: 'review', disabled: true },
		{ label: t('inbox.archived'), value: noteFeed.archived },
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

watch(visibleNotes, (notes, previous) => {
	if (!selectedId.value) return
	if (notes.some((note) => note.id === selectedId.value)) return
	const index = previous?.findIndex((note) => note.id === selectedId.value) ?? -1
	selectedId.value = null
	if (index === -1 || !notes.length) return
	void nextTick(() => selectAt(Math.min(index, notes.length - 1)))
})

function currentIndex() {
	return selectedId.value
		? visibleNotes.value.findIndex((note) => note.id === selectedId.value)
		: -1
}

function selectAt(index: number) {
	const note = visibleNotes.value[index]
	if (!note) return
	selectedId.value = note.id
	scrollArea.value?.virtualizer?.scrollToIndex(index, { align: 'auto' })
}

onKeyStroke(
	(event) =>
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		['j', 'k', 'enter', 'escape'].includes(event.key.toLowerCase()),
	(event) => {
		const target = event.target
		const el = target instanceof HTMLElement ? target : undefined
		if (
			(el &&
				(el.closest('input, textarea, select, [contenteditable="true"]') ||
					el.isContentEditable)) ||
			document.querySelector('[role="dialog"]') ||
			!visibleNotes.value.length
		) {
			return
		}
		const key = event.key.toLowerCase()
		if (key === 'j') {
			event.preventDefault()
			selectAt(Math.min(currentIndex() + 1, visibleNotes.value.length - 1))
		} else if (key === 'k') {
			event.preventDefault()
			selectAt(Math.max(currentIndex() - 1, 0))
		} else if (key === 'enter' && selectedId.value) {
			const note = visibleNotes.value[currentIndex()]
			if (note) {
				event.preventDefault()
				openComposer(note)
			}
		} else if (key === 'escape') {
			selectedId.value = null
		}
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
	<NoteSidebar v-model:open="sidebarOpen" />
	<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
		<div class="flex min-h-(--ui-header-height) w-full max-w-2xl items-center gap-1 px-2">
			<UButton
				class="lg:hidden"
				:icon="appConfig.ui.icons.menu"
				color="neutral"
				variant="ghost"
				:aria-label="$t('header.openSidebar')"
				@click="sidebarOpen = !sidebarOpen"
			/>
			<UNavigationMenu
				class="min-w-0 flex-1"
				:ui="{ root: 'justify-center', item: 'py-0', link: 'py-1' }"
				orientation="horizontal"
				color="neutral"
				variant="link"
				:items="tabs"
			/>
		</div>
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
