<script setup lang="ts">
const props = defineProps<{
	title?: string
	description?: string
	destructive?: boolean
	confirmLabel?: string
	cancelLabel?: string
	onConfirm?: () => void | boolean | Promise<void | boolean>
}>()

const emit = defineEmits<{
	close: []
}>()

const open = defineModel<boolean>('open', { default: false })

function close() {
	open.value = false
	emit('close')
}

async function handleConfirm() {
	const confirmed = await props.onConfirm?.()
	if (confirmed === false) return
	close()
}
</script>

<template>
	<UModal v-model:open="open" :close="{ onClick: close }">
		<template #header>
			<div class="flex w-full flex-col items-start text-left">
				<span v-if="title" class="font-medium">{{ title }}</span>
				<span v-if="description" class="mt-1 text-sm text-pretty text-muted">
					{{ description }}
				</span>
			</div>
		</template>

		<template v-if="$slots.default" #body>
			<slot />
		</template>

		<template #footer>
			<div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
				<UButton
					:label="cancelLabel ?? $t('common.cancel')"
					color="neutral"
					variant="subtle"
					class="w-full justify-center sm:w-auto"
					@click="close"
				/>
				<UButton
					:label="confirmLabel ?? $t('common.confirm')"
					:color="destructive ? 'error' : 'primary'"
					class="w-full justify-center sm:w-auto"
					@click="handleConfirm"
				/>
			</div>
		</template>
	</UModal>
</template>
