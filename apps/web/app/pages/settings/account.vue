<script setup lang="ts">
import * as z from 'zod'

definePageMeta({ title: 'settings.account.label' })

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const authClient = useAuth()

const session = authClient.useSession()
const user = computed(() => session.value.data?.user ?? null)

const emailOpen = ref(false)
const passwordOpen = ref(false)
const email = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const saving = ref(false)

const emailSchema = z.email(t('common.invalid', { label: t('auth.email') }))
const passwordSchema = z.object({
	currentPassword: z
		.string(t('common.required', { label: t('auth.currentPassword') }))
		.min(1, t('common.required', { label: t('auth.currentPassword') })),
	newPassword: z
		.string(t('common.required', { label: t('auth.newPassword') }))
		.min(8, t('common.lengthBetween', { label: t('auth.newPassword'), min: 8, max: 128 }))
		.max(128, t('common.lengthBetween', { label: t('auth.newPassword'), min: 8, max: 128 })),
})

watch(emailOpen, (open) => {
	if (open) email.value = user.value?.email ?? ''
})

watch(passwordOpen, (open) => {
	if (!open) return
	currentPassword.value = ''
	newPassword.value = ''
})

async function saveEmail() {
	if (saving.value) return false
	const result = emailSchema.safeParse(email.value.trim())
	if (!result.success) {
		toast.add({
			title: t('common.actionFailed', { action: t('common.save') }),
			description: result.error.issues[0]?.message,
			color: 'error',
		})
		return false
	}
	if (result.data === user.value?.email) return
	saving.value = true
	try {
		const { error } = await authClient.changeEmail({ newEmail: result.data })
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action: t('common.save') }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		toast.add({ title: t('common.saved'), color: 'success' })
	} finally {
		saving.value = false
	}
}

async function savePassword() {
	if (saving.value) return false
	const result = passwordSchema.safeParse({
		currentPassword: currentPassword.value,
		newPassword: newPassword.value,
	})
	if (!result.success) {
		toast.add({
			title: t('common.actionFailed', { action: t('common.save') }),
			description: result.error.issues[0]?.message,
			color: 'error',
		})
		return false
	}
	saving.value = true
	try {
		const { error } = await authClient.changePassword(result.data)
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action: t('common.save') }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		toast.add({ title: t('common.saved'), color: 'success' })
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<template v-if="user">
		<SettingsItemGroup :label="$t('profile.label')">
			<ProfileCard :user="user" />
		</SettingsItemGroup>
		<SettingsItemGroup :label="$t('settings.account.security')">
			<SettingsItem
				:label="$t('auth.email')"
				:description="user.email"
				:icon="appConfig.ui.icons.mail"
				@click="emailOpen = true"
			/>
			<SettingsItem
				:label="$t('auth.password')"
				:icon="appConfig.ui.icons.lock"
				@click="passwordOpen = true"
			/>
		</SettingsItemGroup>
		<DialogModal
			v-model:open="emailOpen"
			:title="$t('auth.email')"
			:icon="appConfig.ui.icons.mail"
			:confirm-label="$t('common.save')"
			:on-confirm="saveEmail"
		>
			<UFormField :label="$t('auth.email')">
				<UInput
					v-model="email"
					type="email"
					:placeholder="$t('common.placeholder', { label: $t('auth.email') })"
					autocomplete="email"
					class="w-full"
				/>
			</UFormField>
		</DialogModal>
		<DialogModal
			v-model:open="passwordOpen"
			:title="$t('auth.password')"
			:icon="appConfig.ui.icons.lock"
			:confirm-label="$t('common.save')"
			:on-confirm="savePassword"
		>
			<div class="flex flex-col gap-3">
				<UFormField :label="$t('auth.currentPassword')">
					<UInput
						v-model="currentPassword"
						type="password"
						:placeholder="$t('common.placeholder', { label: $t('auth.currentPassword') })"
						autocomplete="current-password"
						class="w-full"
					/>
				</UFormField>
				<UFormField :label="$t('auth.newPassword')">
					<UInput
						v-model="newPassword"
						type="password"
						:placeholder="$t('common.placeholder', { label: $t('auth.newPassword') })"
						autocomplete="new-password"
						class="w-full"
					/>
				</UFormField>
			</div>
		</DialogModal>
	</template>
</template>
