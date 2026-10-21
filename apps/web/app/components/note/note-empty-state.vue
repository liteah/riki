<script setup lang="ts">
const appConfig = useAppConfig()
const noteStore = useNoteStore()
const { keyword, visibilityFilter, tagFilter, pinnedOnly } = storeToRefs(noteStore)

const filtered = computed(
	() =>
		Boolean(keyword.value.trim()) ||
		visibilityFilter.value.length > 0 ||
		tagFilter.value.length > 0 ||
		pinnedOnly.value,
)
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
