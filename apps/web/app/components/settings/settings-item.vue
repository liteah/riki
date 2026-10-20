<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	label: string
	description?: string
	icon?: string
	to?: RouteLocationRaw
	hint?: string
}>()

const attrs = useAttrs()
const appConfig = useAppConfig()

const interactive = computed(() => Boolean(props.to || attrs.onClick))
</script>

<template>
	<ULink
		v-bind="$attrs"
		raw
		:to="to"
		:as="interactive ? 'button' : 'div'"
		class="flex h-16 items-center gap-2 rounded-sm bg-muted p-4 text-left first:rounded-t-lg last:rounded-b-lg dark:bg-muted/50"
		:class="interactive && 'cursor-pointer transition-colors hover:bg-elevated/50'"
	>
		<slot name="icon">
			<UIcon v-if="icon" :name="icon" class="size-6 text-muted" />
		</slot>
		<div class="flex min-w-0 flex-1 flex-col">
			<span class="truncate text-sm font-medium">{{ label }}</span>
			<span v-if="description" class="truncate text-xs text-muted">{{ description }}</span>
		</div>
		<slot />
		<span v-if="hint" class="shrink-0 text-sm text-dimmed">{{ hint }}</span>
		<UIcon
			v-if="interactive"
			:name="appConfig.ui.icons.chevronRight"
			class="size-4 shrink-0 text-dimmed"
		/>
	</ULink>
</template>
