<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { LazyDialogModal, LazyNoteSpaceFormModal, LazyNoteViewFormModal } from '#components'
import type { SpaceListItem } from '#shared/types/space'
import type { TagListItem } from '#shared/types/tag'
import { sidebarKind } from '#shared/types/view'
import type { SidebarKind, View } from '#shared/types/view'
import type { CommandPaletteScope } from '~/utils/command-palette'
import { openCommandPalette } from '~/utils/command-palette'

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const overlay = useOverlay()
const viewStore = useViewStore()
const spaceStore = useSpaceStore()
const tagStore = useTagStore()
const { item: columnItem } = useNoteColumnMenu()
const { target } = storeToRefs(viewStore)

const spaceFormModal = overlay.create(LazyNoteSpaceFormModal)
const viewFormModal = overlay.create(LazyNoteViewFormModal)
const confirmDialog = overlay.create(LazyDialogModal)

const currentView = computed<View | null>(() => {
	const current = target.value
	return current.kind === sidebarKind.view
		? (viewStore.views.find((view) => view.id === current.id) ?? null)
		: null
})

const currentSpace = computed<SpaceListItem | null>(() => {
	const current = target.value
	return current.kind === sidebarKind.space
		? (spaceStore.spaces.find((space) => space.id === current.id) ?? null)
		: null
})

const currentTag = computed<TagListItem | null>(() => {
	const current = target.value
	return current.kind === sidebarKind.tag
		? (tagStore.tags.find((tag) => tag.id === current.id) ?? null)
		: null
})

const scope = computed<CommandPaletteScope | null>(() => {
	if (currentView.value) {
		return { kind: sidebarKind.view, id: currentView.value.id }
	}
	if (currentSpace.value) {
		return { kind: sidebarKind.space, id: currentSpace.value.id }
	}
	if (currentTag.value) {
		return { kind: sidebarKind.tag, id: currentTag.value.id }
	}
	return null
})

const targetEntry = computed<{ kind: SidebarKind; id: string } | null>(() => {
	const current = target.value
	if (current.kind === 'library' || current.kind === 'inbox') return null
	return { kind: current.kind, id: current.id }
})

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

function editCurrent() {
	if (currentView.value) {
		viewFormModal.open({ view: currentView.value, filter: currentView.value.filter })
		return
	}
	if (currentSpace.value) spaceFormModal.open({ space: currentSpace.value })
}

function searchInTarget() {
	if (!scope.value) return
	openCommandPalette({ scope: scope.value })
}

function pinAction(kind: SidebarKind, id: string): DropdownMenuItem {
	const entry = viewStore.pinned.find((item) => item.kind === kind && item.targetId === id)
	return entry
		? {
				label: t('common.unpin'),
				icon: appConfig.ui.icons.pinOff,
				onSelect: () => void attempt(t('common.unpin'), () => viewStore.unpin(entry.id)),
			}
		: {
				label: t('common.pin'),
				icon: appConfig.ui.icons.pin,
				onSelect: () => void attempt(t('common.pin'), () => viewStore.pin(kind, id)),
			}
}

function deleteCurrent() {
	if (currentView.value) {
		const view = currentView.value
		confirmDialog.open({
			title: t('view.deleteTitle'),
			description: t('view.deleteDescription', { name: view.name }),
			destructive: true,
			onConfirm: () => void attempt(t('common.delete'), () => viewStore.deleteView(view.id)),
		})
		return
	}
	if (currentSpace.value) {
		const space = currentSpace.value
		confirmDialog.open({
			title: t('space.deleteTitle'),
			description: t('space.deleteDescription'),
			destructive: true,
			onConfirm: () => void spaceStore.deleteSpace(space.id),
		})
		return
	}
	if (currentTag.value) {
		const tag = currentTag.value
		confirmDialog.open({
			title: t('tag.deleteTitle'),
			description: t('tag.deleteDescription', { name: tag.name }),
			destructive: true,
			onConfirm: () => void tagStore.deleteTag(tag.id),
		})
	}
}

const items = computed<DropdownMenuItem[][]>(() => {
	const current = targetEntry.value
	if (!current) return [[columnItem.value]]
	const actions: DropdownMenuItem[] = []
	if (currentView.value || currentSpace.value) {
		actions.push({
			label: t('common.edit'),
			icon: appConfig.ui.icons.edit,
			onSelect: editCurrent,
		})
	}
	actions.push({
		label: t('common.search'),
		icon: appConfig.ui.icons.search,
		onSelect: searchInTarget,
	})
	const rows: DropdownMenuItem[][] = [
		actions,
		[columnItem.value],
		[pinAction(current.kind, current.id)],
	]
	if (currentView.value || currentSpace.value || currentTag.value) {
		rows.push([
			{
				label: t('common.delete'),
				icon: appConfig.ui.icons.trash,
				color: 'error' as const,
				onSelect: deleteCurrent,
			},
		])
	}
	return rows
})
</script>

<template>
	<UDropdownMenu :items="items" :content="{ align: 'end' }">
		<UTooltip :text="t('common.more')">
			<UButton
				:icon="appConfig.ui.icons.ellipsis"
				color="neutral"
				variant="ghost"
				:aria-label="t('common.more')"
			/>
		</UTooltip>
	</UDropdownMenu>
</template>
