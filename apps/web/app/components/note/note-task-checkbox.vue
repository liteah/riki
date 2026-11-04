<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
	checked?: boolean | string
	disabled?: boolean | string
}>()

const emit = defineEmits<{
	toggle: [event: MouseEvent]
}>()

function booleanLike(value?: boolean | string) {
	return value === true || value === '' || value === 'true'
}

const checked = computed(() => booleanLike(props.checked))
const disabled = computed(() => booleanLike(props.disabled))

function onClick(event: MouseEvent) {
	event.preventDefault()
	event.stopPropagation()

	if (!disabled.value) emit('toggle', event)
}
</script>

<template>
	<span
		data-task-checkbox
		:class="[
			'me-2.5 inline-flex shrink-0 items-center',
			disabled ? 'pointer-events-none' : 'cursor-pointer',
		]"
		@click="onClick"
	>
		<UCheckbox :model-value="checked" :disabled="disabled" class="pointer-events-none" />
	</span>
</template>
