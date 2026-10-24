<script setup lang="ts">
import { LazyNoteSpaceFormModal } from '#components'
import { defaultViewIcon } from '#shared/types/icon'
import type { EntityIcon } from '#shared/types/icon'
import type { View } from '#shared/types/view'
import type { ViewFilter } from '#shared/types/view'

const props = defineProps<{
	view?: View | null
	filter?: ViewFilter
	nameOnly?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const overlay = useOverlay()
const viewStore = useViewStore()
const noteStore = useNoteStore()

const spaceFormModal = overlay.create(LazyNoteSpaceFormModal)

const name = ref('')
const icon = ref<EntityIcon>(defaultViewIcon)
const saving = ref(false)
const draftFilter = ref<ViewFilter>({})

const isEditing = computed(() => Boolean(props.view))
const title = computed(() => {
	if (props.nameOnly) return t('view.saveFilter')
	return isEditing.value ? t('view.editTitle') : t('view.new')
})
const description = computed(() => {
	if (props.nameOnly) return t('view.saveFilterDescription')
	return isEditing.value ? t('view.editDescription') : t('view.newDescription')
})

watch(
	() => open.value,
	(isOpen) => {
		if (!isOpen) return
		name.value = props.view?.name ?? ''
		icon.value = props.view?.icon ?? defaultViewIcon
		draftFilter.value = { ...(props.view?.filter ?? props.filter) }
	},
	{ immediate: true },
)

function openNewSpace() {
	spaceFormModal.open({ space: null })
}

async function handleConfirm() {
	const value = name.value.trim()
	if (!value || saving.value) return
	saving.value = true
	try {
		const payload = { ...draftFilter.value }
		if (props.view) await viewStore.saveView(props.view.id, value, icon.value, payload)
		else {
			await viewStore.createView(value, icon.value, payload)
			noteStore.resetFilter()
		}
		open.value = false
	} catch (error) {
		toast.add({
			title: t('common.actionFailed', { action: title.value }),
			description: error instanceof Error ? error.message : undefined,
			color: 'error',
		})
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<DialogModal
		v-model:open="open"
		:title="title"
		:description="description"
		:on-confirm="handleConfirm"
		@close="open = false"
	>
		<div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
			<UFormField :label="t('common.iconAndName')">
				<UFieldGroup class="w-full">
					<IconPicker v-model="icon" />
					<UInput
						v-model="name"
						:placeholder="t('common.placeholder', { label: t('view.name') })"
						class="min-w-0 flex-1"
						maxlength="64"
						@keydown.enter="handleConfirm"
					/>
				</UFieldGroup>
			</UFormField>

			<NoteFilterMenu v-if="!nameOnly" v-model="draftFilter" embedded @create-space="openNewSpace">
				<template #default="{ activeCount }">
					<UButton
						:icon="appConfig.ui.icons.filter"
						:label="activeCount ? `${t('view.filter')} (${activeCount})` : t('view.filter')"
						:color="activeCount ? 'primary' : 'neutral'"
						:variant="activeCount ? 'soft' : 'outline'"
						:trailing-icon="appConfig.ui.icons.chevronDown"
						class="shrink-0"
					/>
				</template>
			</NoteFilterMenu>
		</div>
	</DialogModal>
</template>
