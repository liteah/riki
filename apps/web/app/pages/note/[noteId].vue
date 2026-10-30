<script setup lang="ts">
import type { Note } from '#shared/types/note'

const route = useRoute()
const appConfig = useAppConfig()

const noteId = computed(() => String(route.params.noteId ?? ''))

const { data: note, error } = await useFetch<Note>(
	() => `/api/notes/${encodeURIComponent(noteId.value)}`,
	{ watch: [noteId] },
)
</script>

<template>
	<NoteSidebar />
	<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
		<LayoutPageHeader :title="$t('note.detailTitle')" />
		<div v-if="note" class="mx-auto w-full max-w-2xl p-2">
			<NoteListItem :key="note.id" :note="note" detail readonly />
		</div>
		<UEmpty
			v-else-if="error"
			variant="naked"
			:icon="appConfig.ui.icons.note"
			:title="$t('note.notFoundTitle')"
			:description="$t('note.notFoundDescription')"
			class="flex min-h-0 flex-1 items-center justify-center p-6"
		/>
		<div v-else class="flex min-h-0 flex-1 items-center justify-center">
			<UIcon :name="appConfig.ui.icons.loading" class="size-6 animate-spin text-muted" />
		</div>
	</div>
</template>
