<script setup lang="ts">
import * as z from 'zod'

const props = defineProps<{
	onSaved?: (username: string) => void
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const authClient = useAuth()

const session = authClient.useSession()
const user = computed(() => session.value.data?.user ?? null)

const nameLabel = t('auth.name')
const usernameLabel = t('auth.username')

const schema = z.object({
	name: z
		.string(t('common.required', { label: nameLabel }))
		.trim()
		.min(1, t('common.required', { label: nameLabel }))
		.max(64, t('common.lengthBetween', { label: nameLabel, min: 1, max: 64 })),
	username: z
		.string(t('common.required', { label: usernameLabel }))
		.trim()
		.min(3, t('common.lengthBetween', { label: usernameLabel, min: 3, max: 30 }))
		.max(30, t('common.lengthBetween', { label: usernameLabel, min: 3, max: 30 }))
		.regex(/^[a-zA-Z0-9_.]+$/, t('common.invalid', { label: usernameLabel })),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({ name: '', username: '' })
const saving = ref(false)

watch(
	() => open.value,
	(isOpen) => {
		if (!isOpen) return
		state.name = user.value?.name ?? ''
		state.username = user.value?.displayUsername ?? user.value?.username ?? ''
	},
	{ immediate: true },
)

async function handleSave() {
	if (saving.value) return false
	const result = schema.safeParse(state)
	if (!result.success) {
		toast.add({
			title: t('common.actionFailed', { action: t('common.save') }),
			description: result.error.issues[0]?.message,
			color: 'error',
		})
		return false
	}
	const username = result.data.username
	if (
		result.data.name === user.value?.name &&
		username === (user.value?.displayUsername ?? user.value?.username ?? '')
	)
		return
	saving.value = true
	try {
		const { error } = await authClient.updateUser({
			name: result.data.name,
			username,
			displayUsername: username,
		})
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action: t('common.save') }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		toast.add({ title: t('common.saved'), color: 'success' })
		props.onSaved?.(username)
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<DialogModal
		v-model:open="open"
		:title="$t('profile.edit')"
		:icon="appConfig.ui.icons.user"
		:confirm-label="$t('common.save')"
		:on-confirm="handleSave"
		@close="open = false"
	>
		<div class="flex flex-col gap-3">
			<UFormField :label="$t('auth.name')">
				<UInput
					v-model="state.name"
					:placeholder="$t('common.placeholder', { label: $t('auth.name') })"
					autocomplete="name"
					class="w-full"
				/>
			</UFormField>
			<UFormField :label="$t('auth.username')">
				<UInput
					v-model="state.username"
					:placeholder="$t('common.placeholder', { label: $t('auth.username') })"
					autocomplete="username"
					class="w-full"
				/>
			</UFormField>
		</div>
	</DialogModal>
</template>
