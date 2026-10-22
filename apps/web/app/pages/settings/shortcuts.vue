<script setup lang="ts">
import { shortcutActions } from '~/utils/shortcuts'
import type { ShortcutId } from '~/utils/shortcuts'

definePageMeta({ layout: false, title: 'settings.shortcuts.label' })

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const shortcutStore = useShortcutStore()

const icons: Record<ShortcutId, string> = {
	toggleSidebar: appConfig.ui.icons.sidebar,
	commandPalette: appConfig.ui.icons.search,
	preferences: appConfig.ui.icons.settings,
	newNote: appConfig.ui.icons.notePen,
}

function actionLabel(id: ShortcutId) {
	const action = shortcutActions.find((item) => item.id === id)
	return action ? t(action.labelKey) : ''
}

function notifyInvalid() {
	toast.add({
		title: t('settings.shortcuts.invalid'),
		description: t('settings.shortcuts.invalidDescription'),
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
		<SettingsItemGroup>
			<SettingsItem
				v-for="action in shortcutActions"
				:key="action.id"
				:label="$t(action.labelKey)"
				:icon="icons[action.id]"
			>
				<SettingsShortcutInput
					:model-value="shortcutStore.bindings[action.id]"
					@capture="(combo) => setShortcut(action.id, combo)"
					@invalid="notifyInvalid"
				/>
			</SettingsItem>
		</SettingsItemGroup>
	</NuxtLayout>
</template>
