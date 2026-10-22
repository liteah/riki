<script setup lang="ts">
import type { ApiKey } from '@better-auth/api-key'

definePageMeta({ layout: false, title: 'settings.apiKeys.label' })

type ApiKeyItem = Omit<ApiKey, 'key'>

const { t, locale } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const authClient = useAuth()

const keys = ref<ApiKeyItem[]>([])
const loading = ref(true)
const createdKey = ref<string | null>(null)
const createdOpen = ref(false)
const revealKey = ref(true)

const createOpen = ref(false)
const editOpen = ref(false)
const deleteOpen = ref(false)
const name = ref('')
const neverExpires = ref(true)
const expiresInDays = ref<number | null>(30)
const editing = ref<ApiKeyItem | null>(null)
const deleting = ref<ApiKeyItem | null>(null)
const busy = ref(false)

const [DefineKeyForm, ReuseKeyForm] = createReusableTemplate()

watch(createdOpen, (open) => {
	if (!open) createdKey.value = null
})

function formatDateTime(value: string | Date) {
	return new Intl.DateTimeFormat(resolveLocale(locale.value), {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}

function keyExpiry(key: ApiKeyItem) {
	return key.expiresAt
		? t('settings.apiKeys.expiresAt', { date: formatDateTime(key.expiresAt) })
		: t('settings.apiKeys.neverExpires')
}

function keyMeta(key: ApiKeyItem) {
	const lines = [t('common.createdAt', { time: formatDateTime(key.createdAt) })]
	if (key.lastRequest)
		lines.push(t('settings.apiKeys.lastUsedAt', { date: formatDateTime(key.lastRequest) }))
	if (key.requestCount > 0)
		lines.push(t('settings.apiKeys.requestCount', { count: key.requestCount }))
	return lines.join('\n')
}

function setExpiry(key: ApiKeyItem) {
	if (!key.expiresAt) {
		neverExpires.value = true
		expiresInDays.value = 30
		return
	}
	const remaining = Math.ceil((new Date(key.expiresAt).getTime() - Date.now()) / 86_400_000)
	neverExpires.value = false
	expiresInDays.value = Math.min(365, Math.max(1, remaining))
}

async function load() {
	loading.value = true
	try {
		const { data, error } = await authClient.apiKey.list({
			query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc' },
		})
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action: t('settings.apiKeys.label') }),
				description: error.message,
				color: 'error',
			})
			return
		}
		keys.value = data?.apiKeys ?? []
	} finally {
		loading.value = false
	}
}

onMounted(() => void load())

function openCreate() {
	createdKey.value = null
	name.value = `${t('settings.apiKeys.label')} ${keys.value.length + 1}`
	neverExpires.value = true
	expiresInDays.value = 30
	createOpen.value = true
}

function openCreated() {
	if (!createdKey.value) return
	nextTick(() => {
		createdOpen.value = true
	})
}

function openEdit(key: ApiKeyItem) {
	editing.value = key
	name.value = key.name ?? ''
	setExpiry(key)
	editOpen.value = true
}

function openDelete(key: ApiKeyItem) {
	deleting.value = key
	deleteOpen.value = true
}

function readName(action: string) {
	const trimmed = name.value.trim()
	if (trimmed) return trimmed
	toast.add({
		title: t('common.actionFailed', { action }),
		description: t('common.required', { label: t('settings.apiKeys.name') }),
		color: 'error',
	})
	return null
}

function readExpiry(action: string): { expiresIn: number | null } | null {
	if (neverExpires.value) return { expiresIn: null }
	const days = expiresInDays.value ?? 0
	if (days >= 1) return { expiresIn: days * 86400 }
	toast.add({
		title: t('common.actionFailed', { action }),
		description: t('common.invalid', { label: t('settings.apiKeys.days') }),
		color: 'error',
	})
	return null
}

async function create() {
	if (busy.value) return false
	const action = t('common.create')
	const trimmed = readName(action)
	if (!trimmed) return false
	const expiry = readExpiry(action)
	if (!expiry) return false
	busy.value = true
	try {
		const { data, error } = await authClient.apiKey.create({
			name: trimmed,
			...expiry,
		})
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		createdKey.value = data?.key ?? null
		if (createdKey.value) revealKey.value = true
		await load()
	} finally {
		busy.value = false
	}
}

async function updateKey() {
	if (busy.value || !editing.value) return false
	const action = t('common.save')
	const trimmed = readName(action)
	if (!trimmed) return false
	const expiry = readExpiry(action)
	if (!expiry) return false
	const key = editing.value
	busy.value = true
	try {
		const { error } = await authClient.apiKey.update({
			keyId: key.id,
			name: trimmed,
			...expiry,
		})
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		toast.add({ title: t('common.saved'), color: 'success' })
		await load()
	} finally {
		busy.value = false
	}
}

async function remove() {
	if (busy.value || !deleting.value) return false
	const key = deleting.value
	busy.value = true
	try {
		const { error } = await authClient.apiKey.delete({ keyId: key.id })
		if (error) {
			toast.add({
				title: t('common.actionFailed', { action: t('common.delete') }),
				description: error.message,
				color: 'error',
			})
			return false
		}
		await load()
	} finally {
		busy.value = false
	}
}

async function copyCreated() {
	if (!createdKey.value) return false
	try {
		await navigator.clipboard.writeText(createdKey.value)
	} catch {
		toast.add({
			title: t('common.actionFailed', { action: t('common.copy') }),
			color: 'error',
		})
		return false
	}
	toast.add({ title: t('common.copied'), color: 'success' })
}
</script>

<template>
	<NuxtLayout name="settings">
		<template #header-actions>
			<UButton
				:icon="appConfig.ui.icons.plus"
				:label="$t('common.create')"
				color="neutral"
				variant="ghost"
				@click="openCreate"
			/>
		</template>
		<DefineKeyForm>
			<div class="flex flex-col gap-4">
				<UFormField :label="$t('settings.apiKeys.name')">
					<UInput
						v-model="name"
						:placeholder="$t('common.placeholder', { label: $t('settings.apiKeys.name') })"
						class="w-full"
					/>
				</UFormField>
				<USwitch v-model="neverExpires" :label="$t('settings.apiKeys.neverExpires')" />
				<UFormField v-if="!neverExpires" :label="$t('settings.apiKeys.days')">
					<UInputNumber v-model="expiresInDays" :min="1" :max="365" class="w-full" />
				</UFormField>
			</div>
		</DefineKeyForm>
		<SettingsItemGroup v-if="keys.length">
			<SettingsItem v-for="key in keys" :key="key.id" :label="key.name || key.start || key.id">
				<template #description>
					<UTooltip :text="keyMeta(key)" :ui="{ content: 'whitespace-pre-line' }">
						<span class="truncate text-xs text-muted">{{ keyExpiry(key) }}</span>
					</UTooltip>
				</template>
				<UTooltip :text="$t('common.edit')">
					<UButton
						:icon="appConfig.ui.icons.edit"
						color="neutral"
						variant="ghost"
						:aria-label="$t('common.edit')"
						@click="openEdit(key)"
					/>
				</UTooltip>
				<UTooltip :text="$t('common.delete')">
					<UButton
						:icon="appConfig.ui.icons.trash"
						color="error"
						variant="ghost"
						:aria-label="$t('common.delete')"
						@click="openDelete(key)"
					/>
				</UTooltip>
			</SettingsItem>
		</SettingsItemGroup>
		<UEmpty
			v-if="!loading && !keys.length"
			:icon="appConfig.ui.icons.key"
			:title="$t('settings.apiKeys.empty')"
			:description="$t('settings.apiKeys.description')"
		>
			<template #actions>
				<UButton
					:icon="appConfig.ui.icons.plus"
					:label="$t('settings.apiKeys.new')"
					@click="openCreate"
				/>
			</template>
		</UEmpty>
		<DialogModal
			v-model:open="createOpen"
			:title="$t('settings.apiKeys.new')"
			:icon="appConfig.ui.icons.key"
			:confirm-label="$t('common.create')"
			:on-confirm="create"
			@close="openCreated"
		>
			<ReuseKeyForm />
		</DialogModal>
		<DialogModal
			v-model:open="createdOpen"
			:title="$t('settings.apiKeys.created')"
			:description="$t('settings.apiKeys.createdDescription')"
			:icon="appConfig.ui.icons.key"
			:confirm-label="$t('common.copy')"
			:cancel-label="$t('common.close')"
			:on-confirm="copyCreated"
		>
			<UFormField v-if="createdKey" :label="$t('settings.apiKeys.key')">
				<UInput
					:model-value="createdKey"
					:type="revealKey ? 'text' : 'password'"
					readonly
					class="w-full font-mono"
					:ui="{ trailing: 'pe-1' }"
				>
					<template #trailing>
						<UTooltip :text="revealKey ? $t('settings.apiKeys.hide') : $t('settings.apiKeys.show')">
							<UButton
								:icon="revealKey ? appConfig.ui.icons.eyeOff : appConfig.ui.icons.eye"
								color="neutral"
								variant="link"
								:aria-label="revealKey ? $t('settings.apiKeys.hide') : $t('settings.apiKeys.show')"
								@click="revealKey = !revealKey"
							/>
						</UTooltip>
					</template>
				</UInput>
			</UFormField>
		</DialogModal>
		<DialogModal
			v-model:open="editOpen"
			:title="$t('settings.apiKeys.edit')"
			:icon="appConfig.ui.icons.key"
			:confirm-label="$t('common.save')"
			:on-confirm="updateKey"
		>
			<ReuseKeyForm />
		</DialogModal>
		<DialogModal
			v-model:open="deleteOpen"
			destructive
			:title="$t('settings.apiKeys.delete')"
			:description="$t('settings.apiKeys.deleteDescription')"
			:icon="appConfig.ui.icons.caution"
			:confirm-label="$t('common.delete')"
			:on-confirm="remove"
		/>
	</NuxtLayout>
</template>
