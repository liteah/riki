<script setup lang="ts">
import { defaultSpaceIcon } from '#shared/types/icon'
import type { EntityIcon } from '#shared/types/icon'
import type { Space } from '#shared/types/note'

const props = defineProps<{
	space?: Pick<Space, 'id' | 'name' | 'icon'> | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const spaceStore = useSpaceStore()

const name = ref('')
const icon = ref<EntityIcon>(defaultSpaceIcon)
const saving = ref(false)

watch(
	() => open.value,
	(isOpen) => {
		if (!isOpen) return
		name.value = props.space?.name ?? ''
		icon.value = props.space?.icon ?? defaultSpaceIcon
	},
	{ immediate: true },
)

const title = computed(() => (props.space ? t('space.editTitle') : t('space.new')))
const description = computed(() =>
	props.space ? t('space.editDescription') : t('space.newDescription'),
)

async function handleConfirm() {
	const value = name.value.trim()
	if (!value || saving.value) return
	saving.value = true
	try {
		if (props.space) {
			const space = await $fetch<Space>(`/api/spaces/${props.space.id}`, {
				method: 'PATCH',
				body: { name: value, icon: icon.value },
			})
			spaceStore.renameSpace(space)
		} else {
			const space = await $fetch<Space>('/api/spaces', {
				method: 'POST',
				body: { name: value, icon: icon.value },
			})
			spaceStore.addSpace(space)
		}
	} catch (error) {
		toast.add({
			title: t('common.actionFailed', { action: t('common.create') }),
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
	>
		<UFormField :label="t('common.iconAndName')">
			<UFieldGroup class="w-full">
				<IconPicker v-model="icon" />
				<UInput
					v-model="name"
					:placeholder="t('common.placeholder', { label: t('space.name') })"
					class="min-w-0 flex-1"
					maxlength="64"
					@keydown.enter="handleConfirm"
				/>
			</UFieldGroup>
		</UFormField>
	</DialogModal>
</template>
