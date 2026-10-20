<script setup lang="ts">
import type { ContextMenuItem, DropdownMenuItem } from '@nuxt/ui'
import { LazyDialogModal, LazyNoteSpaceFormModal, NoteLink, NoteTag } from '#components'
import { noteStatus } from '#shared/types/note'
import type { NoteListItem, NoteStatus } from '#shared/types/note'

const props = defineProps<{
	note: NoteListItem
	giveActions?: boolean
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
const session = useAuth().useSession()

const confirmDialog = overlay.create(LazyDialogModal)

const isOwn = computed(() => props.note.userId === session.value.data?.user?.id)

const isPinned = computed(() => props.note.status === noteStatus.pinned)
const isArchived = computed(() => props.note.status === noteStatus.archived)
const isLater = computed(() => props.note.status === noteStatus.later)

const spaceStore = useSpaceStore()
const spaceItems = computed<DropdownMenuItem[][]>(() => {
	if (!spaceStore.spaces.length) {
		return [[{ label: t('space.new'), icon: appConfig.ui.icons.plus, onSelect: openNewSpace }]]
	}
	return [
		spaceStore.spaces.map((space) => ({
			label: space.name,
			icon: spaceStore.iconForSpace(space),
			onSelect: () => void changeSpace(space.id),
		})),
		...(props.note.spaceId
			? [
					[
						{
							label: t('note.removeFromSpace'),
							icon: appConfig.ui.icons.inbox,
							onSelect: () => void changeSpace(null),
						},
					],
				]
			: []),
	]
})

const spaceForm = overlay.create(LazyNoteSpaceFormModal)

function openNewSpace() {
	spaceForm.open()
}

const spaceTrigger = useTemplateRef<{ $el?: HTMLElement }[]>('spaceTrigger')

function openSpaceMenu() {
	void spaceStore.load()
	spaceTrigger.value?.[0]?.$el?.click()
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
		await noteStore.remove(props.note.id)
		draftStore.discard(draftStore.scopeFor(props.note.id))
	})
}

type NoteAction = {
	id: 'space' | 'later' | 'archive' | 'unarchive' | 'destroy'
	label: string
	icon: string
	kbd: string
	menu?: DropdownMenuItem[][]
	onSelect: () => void
}

const actions = computed<NoteAction[]>(() => {
	if (!props.giveActions || !isOwn.value) return []
	if (isArchived.value) {
		return [
			{
				id: 'unarchive',
				label: t('note.unarchive'),
				icon: appConfig.ui.icons.archive,
				kbd: 'U',
				onSelect: () => void toggleStatus(noteStatus.normal, t('note.unarchive')),
			},
			{
				id: 'destroy',
				label: t('common.delete'),
				icon: appConfig.ui.icons.trash,
				kbd: 'D',
				onSelect: () => confirmDestructive(handleDestroy),
			},
		]
	}
	return [
		{
			id: 'space',
			label: t('note.addToSpace'),
			icon: appConfig.ui.icons.folderOpen,
			kbd: 'S',
			menu: spaceItems.value,
			onSelect: openSpaceMenu,
		},
		{
			id: 'later',
			label: isLater.value ? t('note.unlater') : t('note.later'),
			icon: appConfig.ui.icons.later,
			kbd: 'L',
			onSelect: toggleLater,
		},
		{
			id: 'archive',
			label: t('note.archive'),
			icon: appConfig.ui.icons.archive,
			kbd: 'E',
			onSelect: () => void toggleStatus(noteStatus.archived, t('note.archive')),
		},
	]
})

const cardEl = useTemplateRef<HTMLElement>('card')

const shortcuts = computed(
	() => new Map(actions.value.map((action) => [action.kbd.toLowerCase(), action.onSelect])),
)

onKeyStroke(
	(event) =>
		props.selected === true &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		shortcuts.value.has(event.key.toLowerCase()),
	(event) => {
		event.preventDefault()
		shortcuts.value.get(event.key.toLowerCase())?.()
	},
	{ target: cardEl },
)

// Keys reach only a focused card, so the selected card takes focus.
watch(
	() => props.selected,
	(selected) => {
		if (selected) cardEl.value?.focus()
	},
)

const menuItems = computed<ContextMenuItem[][]>(() =>
	isOwn.value
		? [
				[
					{
						label: isPinned.value ? t('note.unpin') : t('note.pin'),
						icon: appConfig.ui.icons.pin,
						onSelect: () =>
							toggleStatus(
								isPinned.value ? noteStatus.normal : noteStatus.pinned,
								isPinned.value ? t('note.unpin') : t('note.pin'),
							),
					},
					{
						label: isArchived.value ? t('note.unarchive') : t('note.archive'),
						icon: appConfig.ui.icons.archive,
						onSelect: () =>
							toggleStatus(
								isArchived.value ? noteStatus.normal : noteStatus.archived,
								isArchived.value ? t('note.unarchive') : t('note.archive'),
							),
					},
				],
				[
					{
						label: t('common.delete'),
						icon: appConfig.ui.icons.trash,
						color: 'error' as const,
						onSelect: handleDelete,
					},
				],
			]
		: [],
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
	const createdAt = $t('note.createdAt', {
		time: formatAbsoluteTime(props.note.createdAt, locale.value, timeZone),
	})
	const createdSecond = Math.floor(new Date(props.note.createdAt).getTime() / 1000)
	const updatedSecond = Math.floor(new Date(props.note.updatedAt).getTime() / 1000)
	if (updatedSecond === createdSecond) return createdAt
	return `${createdAt}\n${$t('note.updatedAt', { time: formatAbsoluteTime(props.note.updatedAt, locale.value, timeZone) })}`
})
</script>

<template>
	<UContextMenu :items="menuItems">
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
					<UIcon v-if="isPinned" :name="appConfig.ui.icons.pin" class="size-3.5 shrink-0" />
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
				<div v-if="actions.length" class="ms-auto flex shrink-0 items-center gap-1">
					<template v-for="action in actions" :key="action.id">
						<UDropdownMenu v-if="action.menu" :items="action.menu" :content="{ align: 'end' }">
							<UTooltip :text="action.label" :kbds="[action.kbd]">
								<UButton
									ref="spaceTrigger"
									:label="action.label"
									:icon="action.icon"
									color="neutral"
									variant="ghost"
									size="xs"
									@click.stop
								>
									<UKbd :value="action.kbd" size="sm" variant="subtle" />
								</UButton>
							</UTooltip>
						</UDropdownMenu>
						<UTooltip v-else :text="action.label" :kbds="[action.kbd]">
							<UButton
								:label="action.label"
								:icon="action.icon"
								color="neutral"
								variant="ghost"
								size="xs"
								@click.stop="action.onSelect()"
							>
								<UKbd :value="action.kbd" size="sm" variant="subtle" />
							</UButton>
						</UTooltip>
					</template>
				</div>
			</div>
		</div>
	</UContextMenu>
</template>
