<script setup lang="ts">
import type { LinkPreview, LinkPreviewType } from '#shared/types/link-preview'
import { hostLabel, linkPreviewMetaLabel } from '#shared/utils/link-preview'

const props = defineProps<{
	preview: LinkPreview
}>()

const appConfig = useAppConfig()
const imageFailed = ref(false)

const typeIcons = computed(
	() =>
		({
			website: appConfig.ui.icons.globe,
			article: appConfig.ui.icons.article,
			book: appConfig.ui.icons.book,
			video: appConfig.ui.icons.video,
			audio: appConfig.ui.icons.waveform,
			music: appConfig.ui.icons.music,
			podcast: appConfig.ui.icons.headphones,
			tweet: appConfig.ui.icons.chat,
			github: appConfig.ui.icons.githubLogo,
		}) satisfies Record<LinkPreviewType, string>,
)

const typeIcon = computed(() => typeIcons.value[props.preview.type])
const image = computed(() => (imageFailed.value ? undefined : props.preview.image))
const siteLabel = computed(
	() =>
		linkPreviewMetaLabel(props.preview.type, props.preview.meta) ??
		props.preview.siteName ??
		hostLabel(props.preview.url),
)

watch(
	() => props.preview.image,
	() => {
		imageFailed.value = false
	},
)
</script>

<template>
	<a
		:href="preview.url"
		target="_blank"
		rel="noopener noreferrer"
		:title="preview.url"
		:data-type="preview.type"
		class="mt-2 flex h-24 overflow-hidden rounded-lg border border-default bg-elevated/60 transition-colors hover:bg-elevated"
		@click.stop
	>
		<div v-if="image" class="h-full w-24 shrink-0 overflow-hidden bg-muted">
			<img
				:src="image"
				alt=""
				class="size-full object-cover"
				loading="lazy"
				referrerpolicy="no-referrer"
				@error="imageFailed = true"
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
			<div class="flex min-w-0 items-center gap-1 text-[11px] text-muted">
				<UIcon :name="typeIcon" class="size-3.5 shrink-0" aria-hidden="true" />
				<span class="truncate">{{ siteLabel }}</span>
				<UIcon
					:name="appConfig.ui.icons.external"
					class="ms-auto size-3.5 shrink-0"
					aria-hidden="true"
				/>
			</div>
			<div class="line-clamp-2 text-sm leading-snug font-medium text-default">
				{{ preview.title }}
			</div>
			<div v-if="preview.description" class="line-clamp-1 text-xs text-muted">
				{{ preview.description }}
			</div>
		</div>
	</a>
</template>
