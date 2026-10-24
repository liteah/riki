<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { LazyNoteSpaceFormModal, LazyNoteViewFormModal } from '#components'
import { noteStatus } from '#shared/types/note'
import type { ListNotesResponse, NoteListItem } from '#shared/types/note'
import type { CommandPaletteScope } from '~/utils/command-palette'
import { noteQueryFromFilter } from '~/utils/note-query'

// Keep this modal mounted after close so its child form overlays are created once.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
	scope?: CommandPaletteScope
	query?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
	close: []
}>()

const { t } = useI18n()
const appConfig = useAppConfig()
const overlay = useOverlay()
const session = useAuth().useSession()
const noteStore = useNoteStore()
const { notes, explicitFilter } = storeToRefs(noteStore)

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
		if (isOpen && props.scope) applyScope(props.scope)
		searchTerm.value = props.query ?? ''
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

const noteGroup = computed<CommandPaletteGroup | null>(() => {
	if (!signedIn.value || !searchTerm.value.trim() || !noteResults.value.length) return null
	return {
		id: 'notes',
		label: t('commandPalette.notes'),
		ignoreFilter: true,
		items: noteResults.value.map(noteItem),
	}
})

function applyScope(scope: CommandPaletteScope) {
	if (scope.kind === 'space') noteStore.explicitFilter = { spaceIds: [scope.id] }
	else if (scope.kind === 'tag') noteStore.explicitFilter = { tagIds: [scope.id] }
	else noteStore.explicitFilter = { viewIds: [scope.id] }
}

function createNote() {
	close()
	openComposer()
}

function createSpace() {
	close()
	spaceFormModal.open({ space: null })
}

function saveView() {
	const filter = { ...noteStore.activeFilter }
	close()
	viewFormModal.open({ view: null, filter, nameOnly: true })
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
			icon: appConfig.ui.icons.folder,
			onSelect: createSpace,
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
	const navigation: CommandPaletteItem[] = [
		navItem(t('note.library'), appConfig.ui.icons.note, '/'),
		navItem(t('note.inbox'), appConfig.ui.icons.inbox, '/inbox'),
	]
	rows.push({
		id: 'navigate',
		label: t('commandPalette.navigate'),
		items: navigation,
	})
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

watch([debouncedSearchTerm, viewerId, explicitFilter], async ([value]) => {
	const term = value.trim()
	const id = ++searchId
	if (!term || !signedIn.value) {
		if (id === searchId) searching.value = false
		return
	}
	searching.value = true
	try {
		const data = await $fetch<ListNotesResponse>('/api/notes', {
			query: { limit: 8, ...noteQueryFromFilter({ ...explicitFilter.value, q: term }) },
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
				preserve-group-order
				class="h-96 max-h-[calc(100dvh-4rem)]"
				@update:open="onOpenChange"
			>
				<template #close>
					<div class="flex items-center gap-1">
						<NoteFilterMenu
							v-if="signedIn"
							:model-value="explicitFilter"
							@update:model-value="noteStore.explicitFilter = $event"
							@create-space="createSpace"
							@save-view="saveView"
						/>
						<UButton
							:icon="appConfig.ui.icons.close"
							color="neutral"
							variant="ghost"
							size="sm"
							:aria-label="t('common.close')"
							@click="close"
						/>
					</div>
				</template>
				<template #empty>
					{{ t('common.noMatch') }}
				</template>
			</UCommandPalette>
		</template>
	</UModal>
</template>
