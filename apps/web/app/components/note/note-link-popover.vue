<script setup lang="ts">
import { cleanText, parseHttpUrl } from '#shared/utils/link-preview'

const props = defineProps<{
	editor: any
}>()

const { t } = useI18n()
const toast = useToast()
const appConfig = useAppConfig()
const linkPreviewStore = useLinkPreviewStore()

const open = ref(false)
const reference = shallowRef<any>()
const initialUrl = ref('')
const url = ref('')
const title = ref('')
const fetching = ref(false)
const linkActive = ref(false)
const urlInput = useTemplateRef<any>('urlInput')

function resolveUrl() {
	const value = url.value.trim()
	if (!value) return null
	return parseHttpUrl(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`)
}

function syncState() {
	const editor = props.editor
	linkActive.value = Boolean(editor?.isActive('link'))
	if (!open.value) url.value = editor?.getAttributes('link').href || ''
}

function hydrate(href = '') {
	const editor = props.editor
	syncState()
	url.value = href || editor?.getAttributes('link').href || ''
	const selection = editor?.state.selection
	const text = selection ? editor.state.doc.textBetween(selection.from, selection.to, ' ') : ''
	title.value = !href && text && !parseHttpUrl(text) ? text : ''
}

function openAt(position?: number, href = '') {
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
	initialUrl.value = href
	if (open.value) {
		hydrate(href)
		initialUrl.value = ''
		void nextTick(() => urlInput.value?.inputRef?.focus())
		return
	}
	open.value = true
}

function openAtSelection() {
	const editor = props.editor
	if (!editor) return
	openAt(editor.state.selection.from)
}

watch(
	() => props.editor,
	(editor, _, onCleanup) => {
		if (!editor) return
		syncState()
		editor.on('selectionUpdate', syncState)
		editor.on('transaction', syncState)
		onCleanup(() => {
			editor.off('selectionUpdate', syncState)
			editor.off('transaction', syncState)
		})
	},
	{ immediate: true },
)

watch(open, (isOpen) => {
	if (!isOpen) return
	hydrate(initialUrl.value)
	initialUrl.value = ''
	void nextTick(() => urlInput.value?.inputRef?.focus())
})

defineExpose({ openAt, openAtSelection })

async function fetchTitle() {
	const target = resolveUrl()
	if (fetching.value) return
	if (!target) {
		toast.add({
			title: t('common.invalid', { label: t('note.linkUrl') }),
			color: 'error',
		})
		return
	}
	fetching.value = true
	try {
		const preview = await linkPreviewStore.resolve(target.href)
		const next = cleanText(preview?.title, 300)
		if (!next) {
			toast.add({
				title: t('common.actionFailed', { action: t('note.fetchTitle') }),
				color: 'error',
			})
			return
		}
		title.value = next
	} finally {
		fetching.value = false
	}
}

function setLink() {
	const target = resolveUrl()
	if (!target) {
		toast.add({
			title: t('common.invalid', { label: t('note.linkUrl') }),
			color: 'error',
		})
		return
	}

	const editor = props.editor
	const { from, to, empty } = editor.state.selection
	const nextTitle = cleanText(title.value, 300)
	const currentTitle = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
	const hasLink = editor.isActive('link')
	let chain = editor.chain().focus()

	if (!empty && nextTitle && nextTitle !== currentTitle) {
		chain = chain.insertContentAt({ from, to }, { type: 'text', text: nextTitle })
		chain = chain.setTextSelection({ from, to: from + nextTitle.length })
	}
	if (!empty || hasLink) chain = chain.extendMarkRange('link')
	chain = chain.setLink({ href: target.href })
	if (empty && !hasLink) {
		chain = chain.insertContent({
			type: 'text',
			text: nextTitle || target.href,
			marks: [{ type: 'link', attrs: { href: target.href } }],
		})
	}

	chain.run()
	open.value = false
}

function removeLink() {
	props.editor
		.chain()
		.focus()
		.extendMarkRange('link')
		.unsetLink()
		.setMeta('preventAutolink', true)
		.run()
	open.value = false
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key !== 'Enter') return
	event.preventDefault()
	setLink()
}
</script>

<template>
	<UPopover
		v-model:open="open"
		:reference="reference"
		:content="{ align: 'start', side: 'bottom' }"
		:ui="{ content: 'p-1' }"
	>
		<template #content>
			<div class="w-80">
				<UInput
					ref="urlInput"
					v-model="url"
					autofocus
					name="url"
					type="url"
					variant="none"
					:aria-label="t('note.linkUrl')"
					:placeholder="t('note.linkUrlPlaceholder')"
					@keydown="handleKeyDown"
				>
					<div class="flex items-center">
						<UTooltip :text="t('note.applyLink')">
							<UButton
								:icon="appConfig.ui.icons.check"
								:aria-label="t('note.applyLink')"
								variant="ghost"
								size="sm"
								:disabled="!url && !linkActive"
								@click="setLink"
							/>
						</UTooltip>
						<USeparator orientation="vertical" class="mx-1 h-6" />
						<UTooltip :text="t('note.removeLink')">
							<UButton
								:icon="appConfig.ui.icons.trash"
								:aria-label="t('note.removeLink')"
								color="neutral"
								variant="ghost"
								size="sm"
								:disabled="!url && !linkActive"
								@click="removeLink"
							/>
						</UTooltip>
					</div>
				</UInput>

				<USeparator />

				<div class="flex items-center gap-1">
					<UInput
						v-model="title"
						name="link-title"
						variant="none"
						class="flex-1"
						:aria-label="t('note.linkTitle')"
						:placeholder="t('note.linkTitlePlaceholder')"
						@keydown="handleKeyDown"
					/>
					<UTooltip :text="t('note.fetchTitle')">
						<UButton
							:icon="appConfig.ui.icons.reload"
							:aria-label="t('note.fetchTitle')"
							color="neutral"
							variant="ghost"
							size="sm"
							:loading="fetching"
							:disabled="!url"
							@click="fetchTitle"
						/>
					</UTooltip>
				</div>
			</div>
		</template>
	</UPopover>
</template>
