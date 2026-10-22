<script setup lang="ts">
import { eventToShortcut, isModifierKey, shortcutParts } from '~/utils/shortcuts'

const props = defineProps<{
	modelValue: string
}>()

const emit = defineEmits<{
	capture: [shortcut: string]
	invalid: []
}>()

const recording = ref(false)
const keys = computed(() => shortcutParts(props.modelValue))

function start(event: MouseEvent) {
	recording.value = true
	if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
}

function onKeydown(event: KeyboardEvent) {
	if (!recording.value) return
	if (event.key === 'Tab') {
		recording.value = false
		return
	}
	event.preventDefault()
	event.stopPropagation()
	if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
		recording.value = false
		return
	}
	if (isModifierKey(event.key)) return
	const shortcut = eventToShortcut(event)
	recording.value = false
	if (!shortcut) {
		emit('invalid')
		return
	}
	emit('capture', shortcut)
}
</script>

<template>
	<UButton
		color="neutral"
		variant="outline"
		size="sm"
		class="min-w-32 justify-center"
		:aria-label="recording ? $t('settings.shortcuts.recording') : $t('settings.shortcuts.change')"
		@click="start"
		@keydown="onKeydown"
		@blur="recording = false"
	>
		<span v-if="recording" class="text-xs">{{ $t('settings.shortcuts.recording') }}</span>
		<span v-else class="flex items-center gap-1">
			<UKbd v-for="key in keys" :key="key" :value="key" />
		</span>
	</UButton>
</template>
