<script setup lang="ts">
import type { LinkPreview } from '#shared/types/link-preview'
import {
	createFallbackLinkPreview,
	isLinkPreviewUrlBlocked,
	parseHttpUrl,
} from '#shared/utils/link-preview'
import { suppressedLinkPreviewsKey } from '~/utils/link-preview-suppression'

const props = defineProps<{
	href?: string
	preview?: boolean | string
}>()

const settingsStore = useSettingsStore()
const { state: settings } = storeToRefs(settingsStore)
const linkPreviewStore = useLinkPreviewStore()
const session = useAuth().useSession()
const suppressedLinks = inject(suppressedLinkPreviewsKey, null)

const open = ref(false)
const linkKey = computed(() => (props.href ? (parseHttpUrl(props.href)?.href ?? props.href) : ''))
const suppressedMode = computed(() => suppressedLinks?.value.get(linkKey.value))
const canPreview = computed(() => Boolean(props.href && !isLinkPreviewUrlBlocked(props.href)))
const showPreview = computed(
	() =>
		!suppressedMode.value &&
		settings.value.linkPreviewHover &&
		settings.value.linkPreviewMode !== 'never' &&
		canPreview.value,
)
const linkPreview = computed<LinkPreview | null>(() => {
	if (!canPreview.value || !props.href) return null
	return linkPreviewStore.cached(props.href) ?? createFallbackLinkPreview(props.href)
})

watch(open, (isOpen) => {
	if (!isOpen || !canPreview.value || !props.href || !session.value.data?.user?.id) return
	void linkPreviewStore.load(props.href)
})
</script>

<template>
	<span v-if="suppressedMode === 'text'"><slot /></span>
	<UPopover
		v-else-if="showPreview && linkPreview"
		v-model:open="open"
		mode="hover"
		:content="{ side: 'top', align: 'start', sideOffset: 6 }"
	>
		<ProseA :href="href" target="_blank" rel="noopener noreferrer" @click.stop>
			<slot />
		</ProseA>
		<template #content>
			<NoteLinkPreview :preview="linkPreview" flush class="w-80" />
		</template>
	</UPopover>
	<ProseA
		v-else-if="suppressedMode !== 'hide'"
		:href="href"
		target="_blank"
		rel="noopener noreferrer"
		@click.stop
	>
		<slot />
	</ProseA>
</template>
