<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import { defineComarkPlugin } from '@comark/nuxt/parse'
import { tv } from 'tailwind-variants'
import { LazyDialogModal, LazyNoteSpaceFormModal, NoteLink, NoteTag } from '#components'
import { noteStatus, noteVisibility } from '#shared/types/note'
import type { LinkPreview, LinkPreviewSource } from '#shared/types/link-preview'
import type { NoteStatus, NoteViewItem } from '#shared/types/note'
import { createFallbackLinkPreview, isLinkPreviewUrlBlocked } from '#shared/utils/link-preview'
import { planNoteContent } from '#shared/utils/note-content'
import type { NoteContentPlan } from '#shared/utils/note-content'
import { noteLinkPreviewsKey } from '~/utils/link-preview-context'
import { suppressedLinkPreviewsKey } from '~/utils/link-preview-suppression'
import { eventToShortcut } from '~/utils/shortcuts'
import type { NoteViewShortcutId } from '~/utils/shortcuts'

const props = defineProps<{
	note: NoteViewItem
	giveActions?: boolean
	actionsMenu?: boolean
	selected?: boolean
	readonly?: boolean
	detail?: boolean
}>()

const emit = defineEmits<{
	select: [note: NoteViewItem]
}>()

const card = tv({
	base: 'group/note-item-card flex w-full flex-col rounded-2xl p-1 outline-none select-text',
	variants: {
		detail: {
			true: '',
			false: 'bg-muted dark:bg-muted/50',
		},
	},
	defaultVariants: {
		detail: false,
	},
})

const article = tv({
	base: 'h-full rounded-xl p-2 py-1',
	variants: {
		detail: {
			true: '',
			false: 'bg-default',
		},
	},
	defaultVariants: {
		detail: false,
	},
})

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
const isPublic = computed(() => props.note.visibility === noteVisibility.public)

const spaceStore = useSpaceStore()
const spaceForm = overlay.create(LazyNoteSpaceFormModal)
const { forNote } = useEntityIcon()

const noteSpaceName = computed(
	() =>
		props.note.spaceName ??
		spaceStore.spaces.find((space) => space.id === props.note.spaceId)?.name ??
		null,
)
const noteSpaceIcon = computed(() => forNote(props.note))

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

async function copyLink() {
	const url = new URL(`/note/${encodeURIComponent(props.note.id)}`, window.location.origin).href
	try {
		await navigator.clipboard.writeText(url)
		toast.add({ title: t('common.copied'), color: 'success' })
	} catch {
		toast.add({
			title: t('common.actionFailed', { action: t('note.copyLink') }),
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
	icon: appConfig.ui.icons.space,
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
	return [laterAction.value, archiveAction.value]
})

const showInlineSpace = computed(() => props.giveActions && !props.actionsMenu)

const shortcutActions = computed<NoteAction[]>(() =>
	!props.readonly && isOwn.value
		? [spaceAction.value, laterAction.value, archiveAction.value, destroyAction.value]
		: [],
)

const cardEl = useTemplateRef<HTMLElement>('card')

const collapsedHeight = 500
const contentEl = useTemplateRef<HTMLElement>('content')
const { height: contentHeight } = useElementSize(contentEl)
const isLongNote = computed(() => contentHeight.value > collapsedHeight)
const isCollapsible = computed(() => !props.readonly && isOwn.value)
const showCollapse = computed(() => isCollapsible.value && isLongNote.value)

const showActions = computed(() => !props.readonly && props.giveActions && actions.value.length > 0)

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
	icon: appConfig.ui.icons.space,
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

const copyLinkItem = computed<ContextMenuItem>(() => ({
	label: t('note.copyLink'),
	icon: appConfig.ui.icons.link,
	onSelect: copyLink,
}))

const contextMenuItems = computed<ContextMenuItem[][]>(() => {
	if (props.readonly || !isOwn.value) return []
	const rows: ContextMenuItem[][] = [
		[contextSpaceItem.value, laterItem.value, pinItem.value, archiveItem.value],
	]
	if (isPublic.value) rows.push([copyLinkItem.value])
	rows.push([deleteItem.value])
	return rows
})

const menuItems = computed<ContextMenuItem[][]>(() => {
	if (props.readonly || !isOwn.value) return []
	const rows: ContextMenuItem[][] = [
		[spaceSearchItem.value, laterItem.value, pinItem.value, archiveItem.value],
	]
	if (isPublic.value) rows.push([copyLinkItem.value])
	rows.push([deleteItem.value])
	return rows
})

const dropdownItems = computed<ContextMenuItem[][]>(() =>
	menuSpaceMode.value ? spaceMenu.items.value : menuItems.value,
)

const markdownComponents = { a: NoteLink, tag: NoteTag }

const isUnsynced = computed(() => noteStore.isPending(props.note.id))
const draftScope = computed(() => draftStore.scopeFor(props.note.id))
const hasDraft = computed(
	() => !props.readonly && isOwn.value && draftStore.isDirty(draftScope.value, props.note.content),
)

function onSelect() {
	if (!props.readonly && isOwn.value) emit('select', props.note)
}

function onRetry() {
	void noteStore.retryNote(props.note.id)
}

const { locale } = useI18n()
const settingsStore = useSettingsStore()
const { state: settings } = storeToRefs(settingsStore)
const linkPreviewStore = useLinkPreviewStore()

const notePlan = shallowRef<NoteContentPlan>({ sources: [], hasTitle: false })
const linkPreviewPlugin = defineComarkPlugin(() => ({
	name: 'link-preview-plan',
	post(state) {
		notePlan.value = planNoteContent(state.tree)
	},
}))()
const markdownPlugins = [linkPreviewPlugin]

const linkSources = computed(() =>
	notePlan.value.sources.filter((source) => !isLinkPreviewUrlBlocked(source.url)),
)

function previewFor(source: LinkPreviewSource): LinkPreview {
	return linkPreviewStore.cached(source.url) ?? createFallbackLinkPreview(source.url, source.label)
}

const cardSources = computed(() => {
	if (settings.value.linkPreviewMode === 'never') return []
	const explicit = linkSources.value.filter((source) => source.preview === true)
	if (explicit.length > 0) return explicit
	const auto = linkSources.value[0]
	if (!notePlan.value.hasTitle && linkSources.value.length === 1 && auto?.preview !== false) {
		return linkSources.value
	}
	return []
})

const cardPreviews = computed(() =>
	cardSources.value.map((source) => ({ source, preview: previewFor(source) })),
)

const suppressedLinks = computed(
	() =>
		new Map(
			cardSources.value.map((source) => [
				source.url,
				source.label && source.label !== source.url ? ('text' as const) : ('hide' as const),
			]),
		),
)
provide(suppressedLinkPreviewsKey, suppressedLinks)

const portraitPreview = computed<LinkPreview | null>(() => {
	if (settings.value.linkPreviewMode !== 'portrait' || cardPreviews.value.length !== 1) {
		return null
	}
	return cardPreviews.value[0]?.preview ?? null
})

const landscapePreviews = computed(() =>
	portraitPreview.value ? [] : cardPreviews.value.map((item) => item.preview),
)

const cardSourceKey = computed(() => cardSources.value.map((source) => source.url).join('|'))

watch(
	() =>
		[settings.value.linkPreviewMode, cardSourceKey.value, session.value.data?.user?.id] as const,
	([mode, key, userId]) => {
		if (mode === 'never' || !key || !userId) return
		for (const source of cardSources.value) void linkPreviewStore.load(source.url)
	},
	{ immediate: true },
)

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
			:class="[
				card({ detail }),
				!readonly && isOwn && 'cursor-pointer',
				props.selected && 'ring-2 ring-accented',
			]"
			@click="onSelect"
		>
			<article :class="article({ detail })">
				<div class="relative">
					<div
						:class="isCollapsible && 'overflow-hidden'"
						:style="isCollapsible ? { maxHeight: `${collapsedHeight}px` } : undefined"
					>
						<div ref="content" class="flow-root">
							<Markdown
								:value="props.note.content"
								:components="markdownComponents"
								:plugins="markdownPlugins"
							/>
						</div>
					</div>
					<div
						v-if="showCollapse"
						class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center bg-linear-to-t from-default to-transparent px-2 pt-8 pb-2"
					>
						<UTooltip :text="t('note.openNote')">
							<UButton
								:icon="appConfig.ui.icons.chevronDown"
								:aria-label="t('note.openNote')"
								color="neutral"
								variant="ghost"
								size="sm"
								square
								class="pointer-events-auto"
								@click.stop="onSelect"
							/>
						</UTooltip>
					</div>
				</div>
			</article>
			<div v-if="portraitPreview || landscapePreviews.length" class="flex flex-col gap-2 py-1">
				<NoteLinkPreview
					v-if="portraitPreview"
					:preview="portraitPreview"
					variant="portrait"
					flush
				/>
				<NoteLinkPreview
					v-for="preview in landscapePreviews"
					:key="preview.url"
					:preview="preview"
					flush
				/>
			</div>
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
					<div v-if="noteSpaceName" class="flex shrink-0 items-center gap-1">
						<UIcon :name="noteSpaceIcon" class="size-3.5 shrink-0" />
						<span class="max-w-24 truncate">{{ noteSpaceName }}</span>
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
