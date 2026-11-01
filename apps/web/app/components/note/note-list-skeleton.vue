<script setup lang="ts">
import { tv } from 'tailwind-variants'
import type { NoteColumnMode } from '~/utils/note-columns'

const props = withDefaults(defineProps<{ columns?: NoteColumnMode }>(), { columns: 'auto' })

const skeleton = tv({
	slots: {
		root: 'size-full overflow-x-hidden overflow-y-auto p-2',
		grid: 'grid gap-2',
		card: 'rounded-xl bg-muted p-1 dark:bg-muted/50',
		inner: 'h-full rounded-lg bg-default p-2',
		content: 'flow-root space-y-2',
		footer: 'flex flex-wrap items-center gap-2 pl-2 text-xs text-muted sm:py-1 sm:text-sm',
	},
	variants: {
		columns: {
			auto: { grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' },
			single: { grid: 'mx-auto max-w-2xl grid-cols-1' },
			double: { grid: 'mx-auto max-w-4xl grid-cols-1 sm:grid-cols-2' },
		},
	},
})

const ui = computed(() => skeleton({ columns: props.columns }))
</script>

<template>
	<div :class="ui.root()" aria-busy="true">
		<div :class="ui.grid()">
			<div v-for="index in 9" :key="index" :class="ui.card()">
				<div :class="ui.inner()">
					<div :class="ui.content()">
						<USkeleton class="h-4 w-2/3" />
						<USkeleton class="h-3 w-full" />
						<USkeleton class="h-3 w-5/6" />
						<USkeleton class="h-3 w-3/4" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
