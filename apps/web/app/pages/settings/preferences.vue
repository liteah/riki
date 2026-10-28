<script setup lang="ts">
definePageMeta({ title: 'settings.preferences.label' })

const settingsStore = useSettingsStore()
const { state } = storeToRefs(settingsStore)

const appConfig = useAppConfig()

const linkPreviewModeItems = computed(() => [
	{ code: 'never' as const, name: $t('common.never') },
	{ code: 'landscape' as const, name: $t('settings.preferences.linkPreviewLandscape') },
	{ code: 'portrait' as const, name: $t('settings.preferences.linkPreviewPortrait') },
])
</script>

<template>
	<SettingsItemGroup :label="$t('settings.preferences.general')">
		<SettingsItem :label="$t('settings.preferences.language')" :icon="appConfig.ui.icons.language">
			<SettingsLocaleSelect v-model="state.locale" />
		</SettingsItem>
	</SettingsItemGroup>
	<SettingsItemGroup :label="$t('settings.preferences.appearance')">
		<SettingsItem
			:label="$t('settings.preferences.colorMode')"
			:icon="appConfig.ui.icons.colorMode"
		>
			<SettingsColorModeTabs v-model="state.colorMode" />
		</SettingsItem>
	</SettingsItemGroup>
	<SettingsItemGroup :label="$t('settings.preferences.noteBrowsingAndEditor')">
		<SettingsItem
			:label="$t('settings.preferences.linkPreview')"
			:description="$t('settings.preferences.linkPreviewDescription')"
			:icon="appConfig.ui.icons.link"
		>
			<USelectMenu
				v-model="state.linkPreviewMode"
				:items="linkPreviewModeItems"
				label-key="name"
				value-key="code"
				:search-input="false"
			/>
		</SettingsItem>
		<SettingsItem
			:label="$t('settings.preferences.linkPreviewHover')"
			:description="$t('settings.preferences.linkPreviewHoverDescription')"
			:icon="appConfig.ui.icons.eye"
		>
			<USwitch v-model="state.linkPreviewHover" />
		</SettingsItem>
	</SettingsItemGroup>
	<SettingsItemGroup :label="$t('settings.preferences.format')">
		<SettingsItem :label="$t('settings.preferences.timeZone')" :icon="appConfig.ui.icons.timeZone">
			<SettingsTimezoneSelect v-model="state.timeZone" />
		</SettingsItem>
		<SettingsItem
			:label="$t('settings.preferences.timeFormat')"
			:icon="appConfig.ui.icons.timeFormat"
		>
			<SettingsTimeFormatSelect v-model="state.timeFormat" />
		</SettingsItem>
	</SettingsItemGroup>
</template>
