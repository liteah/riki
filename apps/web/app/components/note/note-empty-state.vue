<script setup lang="ts">
const appConfig = useAppConfig()
const noteStore = useNoteStore()

const filtered = computed(() => countFilterValues(noteStore.explicitFilter) > 0)
</script>

<template>
	<UEmpty
		:icon="filtered ? appConfig.ui.icons.search : appConfig.ui.icons.note"
		:title="filtered ? $t('common.noMatch') : $t('note.emptyTitle')"
		:description="filtered ? undefined : $t('note.emptyDescription')"
		variant="naked"
	>
		<template #actions>
			<UButton
				v-if="filtered"
				:icon="appConfig.ui.icons.close"
				:label="$t('view.clearFilter')"
				color="neutral"
				variant="soft"
				@click="noteStore.resetFilter()"
			/>
		</template>
	</UEmpty>
</template>
