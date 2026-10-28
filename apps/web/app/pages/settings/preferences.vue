<script setup lang="ts">
definePageMeta({ title: 'settings.preferences.label' })

const settingsStore = useSettingsStore()
const { state } = storeToRefs(settingsStore)

const appConfig = useAppConfig()
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
		<SettingsItem :label="$t('settings.preferences.linkPreviews')" :icon="appConfig.ui.icons.link">
			<USwitch v-model="state.linkPreviews" size="sm" />
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
