<script setup lang="ts">
import { normalizeNoteImageSource } from '#shared/utils/note-content'

const props = defineProps<{
	editor: any
}>()

const { t } = useI18n()
const toast = useToast()

const open = ref(false)
const reference = shallowRef<any>()
const url = ref('')
const alt = ref('')
const uploadFile = ref<File | null>(null)
const uploading = ref(false)
const urlInput = useTemplateRef<any>('urlInput')

function reset() {
	url.value = ''
	alt.value = ''
	uploadFile.value = null
}

function focusUrl() {
	void nextTick(() => urlInput.value?.inputRef?.focus())
}

function resolveSource() {
	const value = url.value.trim()
	if (!value) return null
	const candidate =
		/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('.')
			? value
			: `https://${value}`
	return normalizeNoteImageSource(candidate)
}

function insertImage(src: string, altText = alt.value.trim()) {
	const editor = props.editor
	if (!editor) return
	editor.chain().focus().setImage({ src, alt: altText }).run()
	reset()
	open.value = false
}

function insertFromUrl() {
	const source = resolveSource()
	if (!source) {
		toast.add({
			title: t('common.invalid', { label: t('note.imageUrl') }),
			color: 'error',
		})
		return
	}
	insertImage(source)
}

async function handleUpload(value: unknown) {
	if (!(value instanceof File)) return
	const file = value
	uploading.value = true
	try {
		const contentType = file.type || 'application/octet-stream'
		const upload = await $fetch<{ uploadUrl: string; url: string }>('/api/uploads', {
			method: 'POST',
			body: { filename: file.name, contentType },
		})
		const response = await fetch(upload.uploadUrl, {
			method: 'PUT',
			body: file,
			headers: { 'Content-Type': contentType },
		})
		if (!response.ok) throw new Error(`Upload failed: ${response.status}`)
		const source = normalizeNoteImageSource(upload.url)
		if (!source) throw new Error('Invalid upload URL')
		insertImage(source, alt.value.trim() || file.name.replace(/\.[^.]+$/, ''))
	} catch (error) {
		toast.add({
			title: t('note.imageUploadFailed'),
			description: error instanceof Error ? error.message : undefined,
			color: 'error',
		})
	} finally {
		uploading.value = false
		uploadFile.value = null
	}
}

function openAt(position?: number) {
	const editor = props.editor
	if (!editor) return
	const pos = Math.min(
		Math.max(position ?? editor.state.selection.from, 0),
		editor.state.doc.content.size,
	)
	reference.value = {
		getBoundingClientRect() {
			const coords = editor.view.coordsAtPos(pos)
			return {
				x: coords.left,
				y: coords.top,
				left: coords.left,
				top: coords.top,
				right: coords.right,
				bottom: coords.bottom,
				width: coords.right - coords.left,
				height: coords.bottom - coords.top,
				toJSON: () => ({}),
			}
		},
	}
	if (open.value) {
		reset()
		focusUrl()
		return
	}
	open.value = true
}

function openAtSelection() {
	const editor = props.editor
	if (!editor) return
	openAt(editor.state.selection.from)
}

watch(open, (isOpen) => {
	if (!isOpen) return
	reset()
	focusUrl()
})

function handleKeyDown(event: KeyboardEvent) {
	if (event.key !== 'Enter') return
	event.preventDefault()
	insertFromUrl()
}

defineExpose({ openAt, openAtSelection })
</script>

<template>
	<UPopover
		v-model:open="open"
		:reference="reference"
		:content="{ align: 'start', side: 'bottom' }"
		:ui="{ content: 'p-1' }"
	>
		<template #content>
			<div class="w-80 space-y-2">
				<div class="flex items-center gap-1">
					<UInput
						ref="urlInput"
						v-model="url"
						autofocus
						name="image-url"
						type="url"
						variant="none"
						class="flex-1"
						:aria-label="t('note.imageUrl')"
						:placeholder="t('note.imageUrlPlaceholder')"
						@keydown="handleKeyDown"
					/>
					<UButton
						:label="t('note.insertImage')"
						size="sm"
						:disabled="!url.trim()"
						@click="insertFromUrl"
					/>
				</div>
				<UInput
					v-model="alt"
					name="image-alt"
					variant="none"
					:aria-label="t('note.imageAlt')"
					:placeholder="t('note.imageAltPlaceholder')"
					@keydown="handleKeyDown"
				/>
				<USeparator />
				<UFileUpload
					v-model="uploadFile"
					accept="image/*"
					:preview="false"
					:disabled="uploading"
					:label="t('note.uploadImage')"
					:description="t('note.imageUploadHint')"
					class="min-h-24"
					@update:model-value="handleUpload"
				/>
			</div>
		</template>
	</UPopover>
</template>
