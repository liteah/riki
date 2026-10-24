<script setup lang="ts">
import { globalShortcutActions, noteViewShortcutActions, shortcutActions } from '~/utils/shortcuts'
import type { ShortcutId } from '~/utils/shortcuts'

definePageMeta({ layout: false, title: 'settings.shortcuts.label' })

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const shortcutStore = useShortcutStore()

const icons: Record<ShortcutId, string> = {
	newNote: appConfig.ui.icons.notePen,
	toggleSidebar: appConfig.ui.icons.sidebar,
	commandPalette: appConfig.ui.icons.search,
	preferences: appConfig.ui.icons.settings,
	inbox: appConfig.ui.icons.inbox,
	library: appConfig.ui.icons.note,
	previousNote: appConfig.ui.icons.arrowUp,
	nextNote: appConfig.ui.icons.arrowDown,
	openNote: appConfig.ui.icons.notePen,
	addToSpace: appConfig.ui.icons.space,
	toggleLater: appConfig.ui.icons.later,
	archiveNote: appConfig.ui.icons.archive,
	destroyNote: appConfig.ui.icons.trash,
}

const groups = computed(() => [
	{
		label: t('settings.shortcuts.global'),
		actions: globalShortcutActions,
		allowBare: false,
	},
	{
		label: t('settings.shortcuts.noteView'),
		actions: noteViewShortcutActions,
		allowBare: true,
	},
])

function actionLabel(id: ShortcutId) {
	const action = shortcutActions.find((item) => item.id === id)
	return action ? t(action.labelKey) : ''
}

function notifyInvalid(id: ShortcutId) {
	const global = globalShortcutActions.some((action) => action.id === id)
	toast.add({
		title: t(global ? 'settings.shortcuts.globalInvalid' : 'settings.shortcuts.invalid'),
		description: t(
			global
				? 'settings.shortcuts.globalInvalidDescription'
				: 'settings.shortcuts.invalidDescription',
		),
		color: 'error',
	})
}

function setShortcut(id: ShortcutId, combo: string) {
	const conflict = shortcutStore.setBinding(id, combo)
	if (!conflict) return
	toast.add({
		title: t('settings.shortcuts.conflictTitle'),
		description: t('settings.shortcuts.conflict', { action: actionLabel(conflict) }),
		color: 'error',
	})
}

function resetAll() {
	shortcutStore.resetAll()
	toast.add({ title: t('settings.shortcuts.resetDone'), color: 'success' })
}
</script>

<template>
	<NuxtLayout name="settings">
		<template #header-actions>
			<UButton
				:icon="appConfig.ui.icons.reset"
				:label="$t('settings.shortcuts.resetAll')"
				color="neutral"
				variant="ghost"
				:disabled="shortcutStore.allDefault"
				@click="resetAll"
			/>
		</template>
		<SettingsItemGroup v-for="group in groups" :key="group.label" :label="group.label">
			<SettingsItem
				v-for="action in group.actions"
				:key="action.id"
				:label="$t(action.labelKey)"
				:icon="icons[action.id]"
			>
				<SettingsShortcutInput
					:model-value="shortcutStore.bindings[action.id]"
					:allow-bare="group.allowBare"
					@capture="(combo) => setShortcut(action.id, combo)"
					@invalid="notifyInvalid(action.id)"
				/>
			</SettingsItem>
		</SettingsItemGroup>
	</NuxtLayout>
</template>
