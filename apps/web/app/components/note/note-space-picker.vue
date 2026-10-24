<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		spaceId?: string | null
		modal?: boolean
		align?: 'start' | 'center' | 'end'
	}>(),
	{ modal: false },
)

const emit = defineEmits<{
	select: [spaceId: string | null]
	create: []
}>()

const { t } = useI18n()
const spaceStore = useSpaceStore()
const searchTerm = ref('')

const { items } = useNoteSpaceOptions(
	() => props.spaceId ?? null,
	(spaceId) => emit('select', spaceId),
	() => emit('create'),
)

const filter = computed(() => ({
	placeholder: t('space.searchPlaceholder'),
}))

function onOpen(open: boolean) {
	if (open) void spaceStore.load()
	else searchTerm.value = ''
}
</script>

<template>
	<UDropdownMenu
		v-model:search-term="searchTerm"
		:items="items"
		:filter="filter"
		:filter-fields="['label']"
		:content="{ align: props.align ?? 'end' }"
		:modal="props.modal"
		@update:open="onOpen"
	>
		<slot />
	</UDropdownMenu>
</template>
