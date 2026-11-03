<script setup lang="ts">
import { LazyNoteSpaceFormModal } from '#components'
import { noteVisibility, noteVisibilityValues } from '#shared/types/note'
import type { Note, NoteVisibility } from '#shared/types/note'
import type {
	DropdownMenuItem,
	EditorCustomHandlers,
	EditorSuggestionMenuItem,
	EditorToolbarItem,
} from '@nuxt/ui'
import { noteVisibilityMeta } from '~/utils/note-visibility'
import { tagMention } from '~/utils/tiptap-tag'

const props = defineProps<{
	note?: Note | null
}>()

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const appConfig = useAppConfig()
const appendToBody = () => document.body
const headingLevels = [
	{ level: 1, icon: appConfig.ui.icons.heading1, label: 'note.heading1' },
	{ level: 2, icon: appConfig.ui.icons.heading2, label: 'note.heading2' },
	{ level: 3, icon: appConfig.ui.icons.heading3, label: 'note.heading3' },
	{ level: 4, icon: appConfig.ui.icons.heading4, label: 'note.heading4' },
] as const
const overlay = useOverlay()
const noteStore = useNoteStore()
const draftStore = useDraftStore()
const viewStore = useViewStore()
const spaceStore = useSpaceStore()

const spaceFormModal = overlay.create(LazyNoteSpaceFormModal)

const content = ref('')
const spaceId = ref<string | null>(null)
const visibility = ref<NoteVisibility>(noteVisibility.private)
const sending = ref(false)

const draftScope = computed(() => draftStore.scopeFor(props.note?.id))
const baseline = computed(() => props.note?.content ?? '')

watch(
	() => open.value,
	(isOpen) => {
		if (!isOpen) return
		void spaceStore.load()
		content.value = draftStore.load(draftScope.value) || baseline.value
		spaceId.value = props.note ? props.note.spaceId : (viewStore.baseFilter.spaceId ?? null)
		visibility.value = props.note?.visibility ?? noteVisibility.private
	},
	{ immediate: true },
)

watch(content, (value) => {
	if (!open.value) return
	if (value === baseline.value) {
		draftStore.discard(draftScope.value)
		return
	}
	draftStore.save(draftScope.value, value)
})

const editorRef = useTemplateRef<any>('editorRef')
const editor = computed(() => editorRef.value?.editor)
const linkPopoverRef = useTemplateRef<{
	openAt: (position?: number, href?: string) => void
	openAtSelection: () => void
}>('linkPopoverRef')
const imagePopoverRef = useTemplateRef<{
	openAt: (position?: number) => void
	openAtSelection: () => void
}>('imagePopoverRef')

const isEmpty = computed(() => !content.value.trim())

const toolbarItems = computed<EditorToolbarItem[]>(() => [
	{
		icon: appConfig.ui.icons.heading,
		tooltip: { text: $t('note.headings') },
		content: { align: 'start' },
		items: headingLevels.map(({ level, icon, label }) => ({
			kind: 'heading' as const,
			level,
			icon,
			label: $t(label),
		})),
	},
	{ kind: 'mark', mark: 'bold', icon: appConfig.ui.icons.bold },
	{ kind: 'mark', mark: 'italic', icon: appConfig.ui.icons.italic },
	{ kind: 'bulletList', icon: appConfig.ui.icons.bulletList },
	{ kind: 'orderedList', icon: appConfig.ui.icons.orderedList },
	{ kind: 'codeBlock', icon: appConfig.ui.icons.code },
	{ kind: 'link', slot: 'link' },
	{ kind: 'image', slot: 'image' },
])

function openLinkPopover() {
	linkPopoverRef.value?.openAtSelection()
}

function openImagePopover() {
	imagePopoverRef.value?.openAtSelection()
}

function openImageFromMenu(event: Event) {
	event.preventDefault()
	openImagePopover()
}

const editorHandlers = {
	link: {
		canExecute: () => true,
		execute: (editor) => {
			openLinkPopover()
			return editor.chain()
		},
		isActive: (editor) => editor.isActive('link'),
	},
	image: {
		canExecute: () => true,
		execute: (editor) => {
			openImagePopover()
			return editor.chain()
		},
		isActive: (editor) => editor.isActive('image'),
	},
} satisfies EditorCustomHandlers

const suggestionItems = computed<EditorSuggestionMenuItem[][]>(() => [
	[
		{ type: 'label', label: $t('note.text') },
		{ kind: 'paragraph', label: $t('note.paragraph'), icon: appConfig.ui.icons.paragraph },
		...headingLevels.map(({ level, icon, label }) => ({
			kind: 'heading' as const,
			level,
			icon,
			label: $t(label),
		})),
	],
	[
		{ type: 'label', label: $t('note.lists') },
		{
			kind: 'bulletList',
			label: $t('note.bulletList'),
			icon: appConfig.ui.icons.bulletList,
		},
		{
			kind: 'orderedList',
			label: $t('note.orderedList'),
			icon: appConfig.ui.icons.orderedList,
		},
	],
	[
		{ type: 'label', label: $t('note.insert') },
		{ kind: 'blockquote', label: $t('note.blockquote'), icon: appConfig.ui.icons.quote },
		{ kind: 'codeBlock', label: $t('note.codeBlock'), icon: appConfig.ui.icons.code },
		{ kind: 'horizontalRule', label: $t('note.divider'), icon: appConfig.ui.icons.minus },
		{ kind: 'link', label: $t('note.link'), icon: appConfig.ui.icons.link },
		{ kind: 'image', label: $t('note.attachImage'), icon: appConfig.ui.icons.image },
	],
])

const addItems = computed<DropdownMenuItem[][]>(() => [
	[
		{
			label: $t('note.attachImage'),
			icon: appConfig.ui.icons.image,
			onSelect: openImageFromMenu,
		},
		{
			label: $t('note.attachAudio'),
			icon: appConfig.ui.icons.waveform,
		},
		{
			label: $t('note.attachLocation'),
			icon: appConfig.ui.icons.mapPin,
		},
	],
])

const visibilityItems = computed<DropdownMenuItem[][]>(() => [
	noteVisibilityValues.map((value) => {
		const option = noteVisibilityMeta[value]
		return {
			type: 'checkbox' as const,
			label: $t(option.label),
			icon: appConfig.ui.icons[option.icon],
			checked: visibility.value === value,
			onSelect: () => {
				visibility.value = value
			},
		}
	}),
])

const currentVisibility = computed(() => noteVisibilityMeta[visibility.value])

const currentSpace = computed(() => spaceStore.spaces.find((space) => space.id === spaceId.value))
const spaceLabel = computed(() => currentSpace.value?.name ?? $t('note.inbox'))
const { forSpace } = useEntityIcon()
const spaceIcon = computed(() =>
	currentSpace.value ? forSpace(currentSpace.value) : appConfig.ui.icons.inbox,
)

function openNewSpace() {
	spaceFormModal.open({ space: null })
}

const submitLabel = computed(() => {
	const publishing = visibility.value === noteVisibility.public
	if (!props.note?.id) return publishing ? $t('note.publish') : $t('note.send')
	return publishing && props.note.visibility !== noteVisibility.public
		? $t('note.publish')
		: $t('note.save')
})

async function handleSend() {
	if (isEmpty.value || sending.value) return
	sending.value = true
	try {
		const trimmed = content.value.trim()
		const body = {
			content: trimmed,
			spaceId: spaceId.value,
			tagNames: extractTagNames(editor.value),
			visibility: visibility.value,
		}
		if (props.note?.id) await noteStore.update(props.note.id, body)
		else await noteStore.create(body)
		content.value = ''
		draftStore.discard(draftScope.value)
		open.value = false
	} catch (error) {
		toast.add({
			title: $t('common.actionFailed', { action: $t('note.send') }),
			description: error instanceof Error ? error.message : undefined,
			color: 'error',
		})
	} finally {
		sending.value = false
	}
}
</script>

<template>
	<UModal v-model:open="open">
		<template #body>
			<UEditor
				ref="editorRef"
				v-model="content"
				content-type="markdown"
				:placeholder="$t('note.editorPlaceholder')"
				:mention="false"
				:extensions="[tagMention]"
				:handlers="editorHandlers"
				class="min-h-48 w-full"
			>
				<UEditorToolbar
					v-if="editor"
					:editor="editor"
					:items="toolbarItems"
					layout="bubble"
					:options="{ placement: 'top', offset: 8 }"
				>
					<template #link="{ item, isActive, isDisabled }">
						<UTooltip :text="$t('note.link')" :disabled="isDisabled(item)">
							<UButton
								:icon="appConfig.ui.icons.link"
								:aria-label="$t('note.link')"
								color="neutral"
								active-color="primary"
								variant="ghost"
								active-variant="soft"
								size="sm"
								:active="isActive(item)"
								:disabled="isDisabled(item)"
								@click="openLinkPopover"
							/>
						</UTooltip>
					</template>
					<template #image="{ item, isActive, isDisabled }">
						<UTooltip :text="$t('note.attachImage')" :disabled="isDisabled(item)">
							<UButton
								:icon="appConfig.ui.icons.image"
								:aria-label="$t('note.attachImage')"
								color="neutral"
								active-color="primary"
								variant="ghost"
								active-variant="soft"
								size="sm"
								:active="isActive(item)"
								:disabled="isDisabled(item)"
								@click="openImagePopover"
							/>
						</UTooltip>
					</template>
				</UEditorToolbar>
				<UEditorSuggestionMenu
					v-if="editor"
					:editor="editor"
					:items="suggestionItems"
					:append-to="appendToBody"
				/>
				<NoteLinkPopover v-if="editor" ref="linkPopoverRef" :editor="editor" />
				<NoteImagePopover v-if="editor" ref="imagePopoverRef" :editor="editor" />
				<NoteTagMenu :editor="editor" />
			</UEditor>
		</template>
		<template #footer>
			<div class="flex w-full items-center gap-1">
				<UDropdownMenu :items="addItems" :content="{ align: 'start', side: 'top' }">
					<UButton :icon="appConfig.ui.icons.plus" color="neutral" variant="ghost" />
				</UDropdownMenu>
				<NoteSpacePicker
					:space-id="spaceId"
					modal
					align="start"
					@select="spaceId = $event"
					@create="openNewSpace"
				>
					<UButton
						:icon="spaceIcon"
						:label="spaceLabel"
						color="neutral"
						variant="ghost"
						:ui="{ leadingIcon: 'size-4' }"
					/>
				</NoteSpacePicker>
				<UFieldGroup class="ml-auto">
					<UButton :label="submitLabel" variant="soft" :loading="sending" @click="handleSend" />
					<UDropdownMenu :items="visibilityItems" :content="{ align: 'end', side: 'top' }">
						<UTooltip :text="$t(currentVisibility.label)">
							<UButton
								:icon="appConfig.ui.icons.chevronDown"
								:aria-label="$t('note.visibilityLabel')"
								variant="soft"
							/>
						</UTooltip>
					</UDropdownMenu>
				</UFieldGroup>
			</div>
		</template>
	</UModal>
</template>
