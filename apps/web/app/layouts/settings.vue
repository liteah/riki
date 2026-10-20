<template>
	<div class="flex flex-1">
		<SettingsSidebar />
		<div class="flex min-w-0 flex-1 flex-col items-center overflow-hidden">
			<LayoutPageHeader :title="$t('settings.preferences.label')" />
			<div class="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto p-4">
				<slot />
			</div>
		</div>
	</div>
</template>
