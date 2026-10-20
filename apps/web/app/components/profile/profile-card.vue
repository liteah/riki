<script setup lang="ts">
import { LazyProfileModal } from '#components'

const props = withDefaults(
	defineProps<{
		user: {
			id: string
			name: string
			username?: string | null
			displayUsername?: string | null
			image?: string | null
		}
		variant?: 'settings' | 'profile'
	}>(),
	{ variant: 'settings' },
)

const emit = defineEmits<{
	saved: [username: string]
}>()

const { t } = useI18n()
const session = useAuth().useSession()
const overlay = useOverlay()

const profileModal = overlay.create(LazyProfileModal)

const own = computed(() => session.value.data?.user?.id === props.user.id)
const handle = computed(() => props.user.displayUsername ?? props.user.username ?? '')

function edit() {
	profileModal.open({ onSaved: (username) => emit('saved', username) })
}

defineExpose({ edit })
</script>

<template>
	<SettingsItem
		v-if="variant === 'settings'"
		:label="user.name"
		:description="handle ? `@${handle}` : undefined"
		:hint="own ? t('profile.edit') : undefined"
		v-on="own ? { click: edit } : {}"
	>
		<template #icon>
			<UAvatar :src="user.image ?? undefined" :alt="user.name" />
		</template>
	</SettingsItem>
	<div v-else class="flex flex-col items-center gap-2 py-4 text-center">
		<UAvatar :src="user.image ?? undefined" :alt="user.name" size="3xl" />
		<div class="flex max-w-full min-w-0 flex-col">
			<span class="truncate text-xl font-medium">{{ user.name }}</span>
			<span v-if="handle" class="truncate text-sm text-muted">@{{ handle }}</span>
		</div>
	</div>
</template>
