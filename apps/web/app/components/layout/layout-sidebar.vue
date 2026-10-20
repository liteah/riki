<script setup lang="ts">
import type { SidebarProps } from '@nuxt/ui'

const appConfig = useAppConfig()

const { sidebarOpen } = storeToRefs(useViewStore())

withDefaults(
	defineProps<{
		collapsible?: 'offcanvas' | 'icon' | 'none'
		ui?: SidebarProps['ui']
	}>(),
	{
		collapsible: 'offcanvas',
	},
)
</script>

<template>
	<USidebar rail v-model:open="sidebarOpen" :collapsible="collapsible" :ui="ui">
		<template #header v-if="!isTauri">
			<UButton
				v-if="$route.path.startsWith('/settings')"
				:label="$t('common.back')"
				:icon="appConfig.ui.icons.arrowLeft"
				to="/"
				color="neutral"
				variant="ghost"
				class="w-full px-2"
				:ui="{ label: 'text-toned' }"
			/>
			<div v-else class="flex w-full flex-col gap-0.5">
				<div class="flex items-center justify-between">
					<LayoutDropdownMenu />
					<UTooltip :text="$t('header.closeSidebar')">
						<UButton
							class="shrink-0 max-lg:hidden"
							:icon="appConfig.ui.icons.sidebar"
							color="neutral"
							variant="ghost"
							@click="sidebarOpen = false"
						/>
					</UTooltip>
				</div>
				<NoteNewButton variant="menu" />
			</div>
		</template>
		<slot />
	</USidebar>
</template>
