<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { LazyNoteSpaceFormModal, LazyNoteViewFormModal } from '#components'
import { noteStatus } from '#shared/types/note'
import type { ListNotesResponse, NoteListItem } from '#shared/types/note'

// Keep this modal mounted after close so its child form overlays are created once.
defineOptions({ inheritAttrs: false })

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
	close: []
}>()

const { t } = useI18n()
const appConfig = useAppConfig()
const overlay = useOverlay()
const session = useAuth().useSession()
const spaceStore = useSpaceStore()
const tagStore = useTagStore()
const viewStore = useViewStore()
const noteStore = useNoteStore()
const { spaces } = storeToRefs(spaceStore)
const { tags } = storeToRefs(tagStore)
const { views } = storeToRefs(viewStore)
const { notes } = storeToRefs(noteStore)

const viewerId = computed(() => session.value.data?.user?.id)
const signedIn = computed(() => Boolean(viewerId.value))

const searchTerm = ref('')
const debouncedSearchTerm = refDebounced(searchTerm, 250)
const searching = ref(false)
const noteResults = ref<NoteListItem[]>([])
let searchId = 0

const spaceFormModal = overlay.create(LazyNoteSpaceFormModal)
const viewFormModal = overlay.create(LazyNoteViewFormModal)

watch(viewerId, () => {
	searchId++
	searching.value = false
	noteResults.value = []
})

watch(
	open,
	(isOpen) => {
		searchId++
		searching.value = false
		noteResults.value = []
		searchTerm.value = ''
		if (!isOpen) return
		void spaceStore.load()
		void tagStore.load()
		void viewStore.load()
	},
	{ immediate: true },
)

function close() {
	open.value = false
	emit('close')
}

function onOpenChange(value: boolean) {
	if (!value) close()
}

function navItem(
	label: string,
	icon: string,
	to: string | { path: string; query: Record<string, string> },
): CommandPaletteItem {
	return {
		label,
		icon,
		onSelect: () => {
			close()
			void navigateTo(to)
		},
	}
}

function noteLabel(note: NoteListItem) {
	const content = note.content.replace(/\s+/g, ' ').trim()
	return content.length > 80 ? `${content.slice(0, 80)}…` : content
}

function openNote(note: NoteListItem) {
	noteStore.remember(note)
	const current = notes.value.find((item) => item.id === note.id)
	if (!current || current.status === noteStatus.archived) return
	close()
	openComposer(current)
}

function noteItem(note: NoteListItem): CommandPaletteItem {
	return {
		label: noteLabel(note),
		suffix: note.spaceName ?? undefined,
		icon: appConfig.ui.icons.note,
		onSelect: () => openNote(note),
	}
}

const recentNotes = computed(() => {
	if (!viewerId.value) return []
	return notes.value
		.filter(
			(note) =>
				(!note.userId || note.userId === viewerId.value) && note.status !== noteStatus.archived,
		)
		.slice(0, 5)
})

const noteGroup = computed<CommandPaletteGroup | null>(() => {
	if (!signedIn.value) return null
	const term = searchTerm.value.trim()
	if (term) {
		if (!noteResults.value.length) return null
		return {
			id: 'notes',
			label: t('commandPalette.notes'),
			ignoreFilter: true,
			items: noteResults.value.map(noteItem),
		}
	}
	if (!recentNotes.value.length) return null
	return {
		id: 'recent-notes',
		label: t('commandPalette.recentNotes'),
		ignoreFilter: true,
		items: recentNotes.value.map(noteItem),
	}
})

function createNote() {
	close()
	openComposer()
}

function createSpace() {
	close()
	spaceFormModal.open({ space: null })
}

function createView() {
	const filter = { ...noteStore.activeFilter }
	close()
	viewFormModal.open({ view: null, filter })
}

const commands = computed<CommandPaletteItem[]>(() => {
	if (!signedIn.value) return []
	return [
		{
			label: t('note.newNote'),
			icon: appConfig.ui.icons.notePen,
			onSelect: createNote,
		},
		{
			label: t('space.new'),
			icon: appConfig.ui.icons.plus,
			onSelect: createSpace,
		},
		{
			label: t('view.new'),
			icon: appConfig.ui.icons.plus,
			onSelect: createView,
		},
	]
})

const groups = computed<CommandPaletteGroup[]>(() => {
	const rows: CommandPaletteGroup[] = []
	if (commands.value.length) {
		rows.push({
			id: 'commands',
			label: t('commandPalette.commands'),
			items: commands.value,
		})
	}
	if (noteGroup.value) rows.push(noteGroup.value)
	rows.push({
		id: 'go-to',
		label: t('commandPalette.goTo'),
		items: [
			navItem(t('note.library'), appConfig.ui.icons.note, '/'),
			navItem(t('note.inbox'), appConfig.ui.icons.inbox, '/inbox'),
		],
	})
	if (views.value.length) {
		rows.push({
			id: 'views',
			label: t('view.label'),
			items: views.value.map((view) =>
				navItem(view.name, appConfig.ui.icons.file, {
					path: '/',
					query: { view: view.id },
				}),
			),
		})
	}
	if (spaces.value.length) {
		rows.push({
			id: 'spaces',
			label: t('space.label'),
			items: spaces.value.map((space) =>
				navItem(space.name, spaceStore.iconForSpace(space), {
					path: '/',
					query: { space: space.id },
				}),
			),
		})
	}
	if (tags.value.length) {
		rows.push({
			id: 'tags',
			label: t('tag.label'),
			items: tags.value.map((tag) =>
				navItem(tag.name, appConfig.ui.icons.hash, {
					path: '/',
					query: { tag: tag.id },
				}),
			),
		})
	}
	rows.push({
		id: 'settings',
		label: t('settings.label'),
		items: [
			navItem(
				t('settings.preferences.label'),
				appConfig.ui.icons.settings,
				appConfig.routes.settings.preferences,
			),
			navItem(
				t('settings.shortcuts.label'),
				appConfig.ui.icons.keyboard,
				appConfig.routes.settings.shortcuts,
			),
			navItem(
				t('settings.account.label'),
				appConfig.ui.icons.user,
				appConfig.routes.settings.account,
			),
			navItem(
				t('settings.apiKeys.label'),
				appConfig.ui.icons.key,
				appConfig.routes.settings.apiKeys,
			),
		],
	})
	return rows
})

watch(searchTerm, (value) => {
	searchId++
	noteResults.value = []
	const term = value.trim()
	searching.value = Boolean(term && signedIn.value)
})

watch([debouncedSearchTerm, viewerId], async ([value]) => {
	const term = value.trim()
	const id = ++searchId
	if (!term || !signedIn.value) {
		if (id === searchId) searching.value = false
		return
	}
	searching.value = true
	try {
		const data = await $fetch<ListNotesResponse>('/api/notes', {
			query: { q: term, limit: 8 },
		})
		if (id !== searchId) return
		noteResults.value = data.items.filter((note) => note.userId === viewerId.value)
	} catch {
		if (id === searchId) noteResults.value = []
	} finally {
		if (id === searchId) searching.value = false
	}
})
</script>

<template>
	<UModal
		v-model:open="open"
		:title="t('commandPalette.label')"
		:ui="{ content: 'max-w-2xl p-0 sm:max-w-2xl' }"
		@update:open="onOpenChange"
	>
		<template #content>
			<UCommandPalette
				v-model:search-term="searchTerm"
				:groups="groups"
				:loading="searching"
				:placeholder="t('commandPalette.placeholder')"
				:close="true"
				:back="false"
				preserve-group-order
				class="h-96 max-h-[calc(100dvh-4rem)]"
				@update:open="onOpenChange"
			>
				<template #empty>
					{{ t('common.noMatch') }}
				</template>
			</UCommandPalette>
		</template>
	</UModal>
</template>
