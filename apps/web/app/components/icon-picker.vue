<script setup lang="ts">
import { entityIconKeys } from '#shared/types/icon'
import type { EntityIcon } from '#shared/types/icon'

const props = defineProps<{
	modelValue: EntityIcon
}>()

const emit = defineEmits<{
	'update:modelValue': [value: EntityIcon]
}>()

const { t } = useI18n()
const appConfig = useAppConfig()
const open = ref(false)

function select(icon: EntityIcon) {
	emit('update:modelValue', icon)
	open.value = false
}

function iconLabel(icon: EntityIcon) {
	return icon.charAt(0).toUpperCase() + icon.slice(1)
}
</script>

<template>
	<UPopover v-model:open="open" :content="{ align: 'start' }">
		<UButton
			:icon="appConfig.ui.icons[props.modelValue]"
			:aria-label="t('common.chooseIcon')"
			color="neutral"
			variant="outline"
			square
		/>
		<template #content>
			<div class="grid w-64 grid-cols-7 gap-0.5 p-1">
				<UTooltip v-for="icon in entityIconKeys" :key="icon" :text="iconLabel(icon)">
					<UButton
						:icon="appConfig.ui.icons[icon]"
						:aria-label="iconLabel(icon)"
						:aria-pressed="icon === modelValue"
						:color="icon === modelValue ? 'primary' : 'neutral'"
						:variant="icon === modelValue ? 'soft' : 'ghost'"
						square
						@click="select(icon)"
					/>
				</UTooltip>
			</div>
		</template>
	</UPopover>
</template>
