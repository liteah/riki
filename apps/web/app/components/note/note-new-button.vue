<script setup lang="ts">
const appConfig = useAppConfig()
const session = useAuth().useSession()
const shortcutStore = useShortcutStore()

const signedIn = computed(() => Boolean(session.value.data?.user?.id))

withDefaults(
	defineProps<{
		variant?: 'full' | 'ghost' | 'menu'
	}>(),
	{
		variant: 'full',
	},
)
</script>

<template>
	<template v-if="signedIn">
		<UButton
			v-if="variant === 'full'"
			:icon="appConfig.ui.icons.plus"
			:label="$t('note.newNote')"
			color="neutral"
			variant="soft"
			size="lg"
			class="rounded-full"
			@click="() => openComposer()"
		/>
		<UButton
			v-else-if="variant === 'menu'"
			:icon="appConfig.ui.icons.notePen"
			:label="$t('note.newNote')"
			color="neutral"
			variant="ghost"
			block
			class="group justify-start px-2 text-muted hover:bg-elevated/50 hover:text-highlighted"
			:ui="{
				leadingIcon: 'text-dimmed transition-colors group-hover:text-default',
			}"
			@click="() => openComposer()"
		/>
		<UTooltip v-else :text="$t('note.newNote')" :kbds="shortcutStore.kbds('newNote')">
			<UButton
				:icon="appConfig.ui.icons.notePen"
				color="neutral"
				variant="ghost"
				class="px-2"
				@click="() => openComposer()"
			/>
		</UTooltip>
	</template>
</template>
