<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import { LazyDialogModal, LazyNoteSpaceFormModal, NoteLink, NoteTag } from '#components'
import { noteStatus } from '#shared/types/note'
import type { NoteListItem, NoteStatus } from '#shared/types/note'
import { eventToShortcut } from '~/utils/shortcuts'
import type { NoteViewShortcutId } from '~/utils/shortcuts'

const props = defineProps<{
	note: NoteListItem
	giveActions?: boolean
	actionsMenu?: boolean
	selected?: boolean
}>()

const emit = defineEmits<{
	select: [note: NoteListItem]
}>()

const { t } = useI18n()
const toast = useToast()
const overlay = useOverlay()
const appConfig = useAppConfig()
const noteStore = useNoteStore()
const draftStore = useDraftStore()
const shortcutStore = useShortcutStore()
const session = useAuth().useSession()

const confirmDialog = overlay.create(LazyDialogModal)

const isOwn = computed(() => props.note.userId === session.value.data?.user?.id)

const isPinned = computed(() => props.note.status === noteStatus.pinned)
const isArchived = computed(() => props.note.status === noteStatus.archived)
const isLater = computed(() => props.note.status === noteStatus.later)

const spaceStore = useSpaceStore()
const spaceForm = overlay.create(LazyNoteSpaceFormModal)

function openNewSpace() {
	spaceForm.open()
}

const menuOpen = ref(false)
const menuSpaceMode = ref(false)
const menuSearch = ref('')
const pendingSpaceMenu = ref(false)

const spaceSearchFilter = computed(() => ({
	placeholder: t('space.searchPlaceholder'),
}))

const spaceFilter = computed(() => (menuSpaceMode.value ? spaceSearchFilter.value : false))

function prepareSpaceMenu() {
	void spaceStore.load()
	menuSpaceMode.value = true
}

function openSpaceMenu(event?: Event) {
	event?.preventDefault()
	prepareSpaceMenu()
	if (event) return
	menuOpen.value = true
}

function onMenuOpen(open: boolean) {
	menuOpen.value = open
	if (open) return
	menuSpaceMode.value = false
	menuSearch.value = ''
}

function openPendingSpaceMenu() {
	if (!pendingSpaceMenu.value) return
	pendingSpaceMenu.value = false
	menuOpen.value = true
}

function onContextOpen(open: boolean) {
	if (open) {
		pendingSpaceMenu.value = false
		return
	}
	if (!pendingSpaceMenu.value) return
	setTimeout(openPendingSpaceMenu, 250)
}

function onContextCloseAutoFocus(event: Event) {
	if (!pendingSpaceMenu.value) return
	event.preventDefault()
	openPendingSpaceMenu()
}

async function attempt(action: string, run: () => Promise<unknown>) {
	try {
		await run()
	} catch (error) {
		toast.add({
			title: t('common.actionFailed', { action }),
			description: error instanceof Error ? error.message : undefined,
			color: 'error',
		})
	}
}

function changeSpace(spaceId: string | null) {
	return attempt(t('note.addToSpace'), () => noteStore.update(props.note.id, { spaceId }))
}

const spaceMenu = useNoteSpaceOptions(() => props.note.spaceId, changeSpace, openNewSpace)

function toggleStatus(status: NoteStatus, action: string) {
	return attempt(action, () => noteStore.setStatus(props.note.id, status))
}

function toggleLater() {
	void toggleStatus(
		isLater.value ? noteStatus.normal : noteStatus.later,
		isLater.value ? t('note.unlater') : t('note.later'),
	)
}

function confirmDestructive(onConfirm: () => void) {
	confirmDialog.open({
		title: t('note.deleteTitle'),
		description: t('note.deleteDescription'),
		icon: appConfig.ui.icons.trash,
		destructive: true,
		onConfirm,
	})
}

function handleDestroy() {
	void attempt(t('common.delete'), async () => {
		await noteStore.destroy(props.note.id)
		draftStore.discard(draftStore.scopeFor(props.note.id))
	})
}

function handleDelete() {
	void attempt(t('common.delete'), async () => {
		noteStore.remove(props.note.id)
		draftStore.discard(draftStore.scopeFor(props.note.id))
	})
}

type NoteAction = {
	id: 'space' | 'later' | 'archive' | 'unarchive' | 'destroy'
	shortcut: NoteViewShortcutId
	label: string
	icon: string
	onSelect: () => void
}

function togglePin() {
	void toggleStatus(
		isPinned.value ? noteStatus.normal : noteStatus.pinned,
		isPinned.value ? t('common.unpin') : t('common.pin'),
	)
}

function toggleArchive() {
	void toggleStatus(
		isArchived.value ? noteStatus.normal : noteStatus.archived,
		isArchived.value ? t('note.unarchive') : t('note.archive'),
	)
}

const spaceAction = computed<NoteAction>(() => ({
	id: 'space',
	shortcut: 'addToSpace',
	label: t('note.addToSpace'),
	icon: appConfig.ui.icons.folderOpen,
	onSelect: openSpaceMenu,
}))

const laterAction = computed<NoteAction>(() => ({
	id: 'later',
	shortcut: 'toggleLater',
	label: isLater.value ? t('note.unlater') : t('note.later'),
	icon: appConfig.ui.icons.later,
	onSelect: toggleLater,
}))

const archiveAction = computed<NoteAction>(() => ({
	id: isArchived.value ? 'unarchive' : 'archive',
	shortcut: 'archiveNote',
	label: isArchived.value ? t('note.unarchive') : t('note.archive'),
	icon: appConfig.ui.icons.archive,
	onSelect: toggleArchive,
}))

const destroyAction = computed<NoteAction>(() => ({
	id: 'destroy',
	shortcut: 'destroyNote',
	label: t('common.delete'),
	icon: appConfig.ui.icons.trash,
	onSelect: () => confirmDestructive(handleDestroy),
}))

const actions = computed<NoteAction[]>(() => {
	if (!isOwn.value) return []
	return isArchived.value
		? [archiveAction.value, destroyAction.value]
		: [laterAction.value, archiveAction.value]
})

const showInlineSpace = computed(
	() => props.giveActions && !props.actionsMenu && !isLater.value && !isArchived.value,
)

const shortcutActions = computed<NoteAction[]>(() =>
	isOwn.value
		? [spaceAction.value, laterAction.value, archiveAction.value, destroyAction.value]
		: [],
)

const cardEl = useTemplateRef<HTMLElement>('card')

const showActions = computed(() => props.giveActions && actions.value.length > 0)

const actionBarClass = computed(() =>
	props.selected
		? ''
		: 'pointer-events-none opacity-0 transition-opacity group-hover/note-item-card:pointer-events-auto group-hover/note-item-card:opacity-100 has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100',
)

const shortcuts = computed(
	() =>
		new Map(
			shortcutActions.value.map((action) => [
				shortcutStore.bindings[action.shortcut],
				action.onSelect,
			]),
		),
)

onKeyStroke(
	(event) => {
		if (props.selected !== true || event.repeat) return false
		const shortcut = eventToShortcut(event, true)
		return shortcut !== null && shortcuts.value.has(shortcut)
	},
	(event) => {
		const shortcut = eventToShortcut(event, true)
		if (!shortcut) return
		event.preventDefault()
		shortcuts.value.get(shortcut)?.()
	},
	{ target: cardEl },
)

// Keys reach only a focused card, so the selected card takes focus.
watchEffect(() => {
	if (props.selected && cardEl.value) cardEl.value.focus()
})

const spaceSearchItem = computed<ContextMenuItem>(() => ({
	label: t('note.addToSpace'),
	icon: appConfig.ui.icons.folderOpen,
	kbds: shortcutStore.kbds('addToSpace'),
	onSelect: openSpaceMenu,
}))

const contextSpaceItem = computed<ContextMenuItem>(() => ({
	...spaceSearchItem.value,
	onSelect: () => {
		prepareSpaceMenu()
		pendingSpaceMenu.value = true
	},
}))

const laterItem = computed<ContextMenuItem>(() => ({
	label: isLater.value ? t('note.unlater') : t('note.later'),
	icon: appConfig.ui.icons.later,
	kbds: shortcutStore.kbds('toggleLater'),
	onSelect: toggleLater,
}))

const pinItem = computed<ContextMenuItem>(() => ({
	label: isPinned.value ? t('common.unpin') : t('common.pin'),
	icon: appConfig.ui.icons.pin,
	onSelect: togglePin,
}))

const archiveItem = computed<ContextMenuItem>(() => ({
	label: isArchived.value ? t('note.unarchive') : t('note.archive'),
	icon: appConfig.ui.icons.archive,
	kbds: shortcutStore.kbds('archiveNote'),
	onSelect: toggleArchive,
}))

const deleteItem = computed<ContextMenuItem>(() => ({
	label: t('common.delete'),
	icon: appConfig.ui.icons.trash,
	kbds: shortcutStore.kbds('destroyNote'),
	color: 'error',
	onSelect: () => confirmDestructive(handleDelete),
}))

const contextMenuItems = computed<ContextMenuItem[][]>(() =>
	isOwn.value
		? [
				[contextSpaceItem.value, laterItem.value, pinItem.value, archiveItem.value],
				[deleteItem.value],
			]
		: [],
)

const menuItems = computed<ContextMenuItem[][]>(() =>
	isOwn.value
		? [
				[spaceSearchItem.value, laterItem.value, pinItem.value, archiveItem.value],
				[deleteItem.value],
			]
		: [],
)

const dropdownItems = computed<ContextMenuItem[][]>(() =>
	menuSpaceMode.value ? spaceMenu.items.value : menuItems.value,
)

const markdownComponents = { a: NoteLink, tag: NoteTag }

const isUnsynced = computed(() => noteStore.isPending(props.note.id))
const draftScope = computed(() => draftStore.scopeFor(props.note.id))
const hasDraft = computed(
	() => isOwn.value && draftStore.isDirty(draftScope.value, props.note.content),
)

function onSelect() {
	if (isOwn.value) emit('select', props.note)
}

function onRetry() {
	void noteStore.retryNote(props.note.id)
}

const { locale } = useI18n()
const settingsStore = useSettingsStore()
const { state: settings } = storeToRefs(settingsStore)

const noteTime = computed(() =>
	formatTime(
		props.note.createdAt,
		settings.value.timeFormat,
		locale.value,
		resolveTimeZone(settings.value.timeZone),
	),
)

const absoluteHint = computed(() => {
	const timeZone = resolveTimeZone(settings.value.timeZone)
	const createdAt = $t('common.createdAt', {
		time: formatAbsoluteTime(props.note.createdAt, locale.value, timeZone),
	})
	const createdSecond = Math.floor(new Date(props.note.createdAt).getTime() / 1000)
	const updatedSecond = Math.floor(new Date(props.note.updatedAt).getTime() / 1000)
	if (updatedSecond === createdSecond) return createdAt
	return `${createdAt}\n${$t('note.updatedAt', { time: formatAbsoluteTime(props.note.updatedAt, locale.value, timeZone) })}`
})
</script>

<template>
	<UContextMenu
		:items="contextMenuItems"
		:content="{ onCloseAutoFocus: onContextCloseAutoFocus }"
		@update:open="onContextOpen"
	>
		<div
			ref="card"
			tabindex="-1"
			class="group/note-item-card flex w-full flex-col rounded-2xl bg-muted p-1 outline-none select-text dark:bg-muted/50"
			:class="[isOwn && 'cursor-pointer', props.selected && 'ring-2 ring-accented']"
			@click="onSelect"
		>
			<article class="h-full rounded-xl bg-default p-2 py-1">
				<Markdown :value="props.note.content" :components="markdownComponents" />
			</article>
			<div class="flex flex-wrap items-center gap-2 pl-2 text-xs text-muted sm:py-1 sm:text-sm">
				<div class="flex items-center gap-1 truncate">
					<UTooltip v-if="isPinned" :text="t('common.pinned')">
						<UIcon :name="appConfig.ui.icons.pin" class="size-3.5 shrink-0" />
					</UTooltip>
					<UTooltip v-if="hasDraft" :text="$t('note.draft')">
						<UIcon :name="appConfig.ui.icons.notePen" class="size-3.5 shrink-0 text-warning" />
					</UTooltip>
					<UTooltip v-if="isUnsynced" :text="$t('note.unsynced')">
						<UButton
							color="warning"
							variant="link"
							size="xs"
							class="-my-1 px-1"
							:icon="appConfig.ui.icons.cloudUpload"
							@click.stop="onRetry"
						/>
					</UTooltip>
					<UTooltip :text="absoluteHint" :ui="{ content: 'whitespace-pre-line' }">
						<span>{{ noteTime }}</span>
					</UTooltip>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					<span v-if="!isOwn && props.note.authorName" class="flex min-w-0 items-center gap-1">
						<UIcon :name="appConfig.ui.icons.user" class="size-3.5 shrink-0" />
						<span class="max-w-24 truncate">{{ props.note.authorName }}</span>
					</span>
					<div v-if="props.note.spaceName" class="flex shrink-0 items-center gap-1">
						<UIcon :name="appConfig.ui.icons.folder" class="size-3.5" />
						<span class="max-w-24 truncate">{{ props.note.spaceName }}</span>
					</div>
				</div>
				<div
					v-if="showActions"
					class="ms-auto flex shrink-0 items-center gap-1"
					:class="actionBarClass"
				>
					<template v-if="!actionsMenu">
						<NoteSpacePicker
							v-if="showInlineSpace"
							:space-id="props.note.spaceId"
							@select="changeSpace"
							@create="openNewSpace"
						>
							<UTooltip :text="spaceAction.label" :kbds="shortcutStore.kbds('addToSpace')">
								<UButton
									:icon="spaceAction.icon"
									:aria-label="spaceAction.label"
									color="neutral"
									variant="ghost"
									size="xs"
									@click.stop
								/>
							</UTooltip>
						</NoteSpacePicker>
						<UTooltip
							v-for="action in actions"
							:key="action.id"
							:text="action.label"
							:kbds="shortcutStore.kbds(action.shortcut)"
						>
							<UButton
								:icon="action.icon"
								:aria-label="action.label"
								color="neutral"
								variant="ghost"
								size="xs"
								@click.stop="action.onSelect()"
							/>
						</UTooltip>
					</template>
					<UDropdownMenu
						v-model:search-term="menuSearch"
						:open="menuOpen"
						:items="dropdownItems"
						:filter="spaceFilter"
						:filter-fields="['label']"
						:content="{ align: 'end' }"
						:modal="false"
						@update:open="onMenuOpen"
					>
						<UButton
							:icon="appConfig.ui.icons.ellipsis"
							color="neutral"
							variant="ghost"
							size="xs"
							:tabindex="selected ? undefined : -1"
							@click.stop
						/>
					</UDropdownMenu>
				</div>
			</div>
		</div>
	</UContextMenu>
</template>
