<script setup lang="ts">
import { tv } from 'tailwind-variants'
import type { LinkPreview, LinkPreviewType } from '#shared/types/link-preview'
import {
	hostLabel,
	linkPreviewMetaLabel,
	linkPreviewProviderIconKey,
} from '#shared/utils/link-preview'

const props = withDefaults(
	defineProps<{
		preview: LinkPreview
		variant?: 'landscape' | 'portrait'
		flush?: boolean
	}>(),
	{ variant: 'landscape', flush: false },
)

const appConfig = useAppConfig()
const imageFailed = ref(false)
const faviconFailed = ref(false)

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
			tweet: appConfig.ui.icons.twitterLogo,
			github: appConfig.ui.icons.githubLogo,
		}) satisfies Record<LinkPreviewType, string>,
)

const typeIcon = computed(() => typeIcons.value[props.preview.type])
const image = computed(() => (imageFailed.value ? undefined : props.preview.image))
const providerIcon = computed(() => {
	const key = linkPreviewProviderIconKey(props.preview.url)
	return key ? appConfig.ui.icons[key as keyof typeof appConfig.ui.icons] : undefined
})
const headerIcon = computed(() => providerIcon.value ?? typeIcon.value)
const favicon = computed(() => {
	if (providerIcon.value) return undefined
	if (props.preview.icon) return props.preview.icon
	const { imageWidth, imageHeight } = props.preview
	if (image.value && imageWidth && imageHeight && imageWidth <= 256 && imageHeight <= 256) {
		return image.value
	}
	return undefined
})

const hasPortraitCover = computed(() => {
	const { imageWidth, imageHeight } = props.preview
	if (props.variant !== 'portrait' || !image.value || !imageWidth || !imageHeight) return false
	return imageWidth >= 600 && imageHeight >= 300 && imageWidth / imageHeight >= 1.5
})

const effectiveVariant = computed(() => (hasPortraitCover.value ? 'portrait' : 'landscape'))

const siteLabel = computed(
	() =>
		linkPreviewMetaLabel(props.preview.type, props.preview.meta) ??
		props.preview.siteName ??
		hostLabel(props.preview.url),
)

const card = tv({
	base: 'overflow-hidden transition-colors',
	variants: {
		flush: {
			true: '',
			false: 'mt-2',
		},
		variant: {
			landscape: 'flex h-24 rounded-lg bg-default',
			portrait: 'flex flex-col rounded-xl bg-default',
		},
	},
	defaultVariants: { flush: false, variant: 'landscape' },
})

const landscapeMedia = tv({
	base: 'h-full shrink-0 overflow-hidden bg-muted',
	variants: {
		type: {
			website: 'aspect-video',
			article: 'aspect-video',
			book: 'aspect-2/3',
			video: 'aspect-video',
			audio: 'aspect-square',
			music: 'aspect-square',
			podcast: 'aspect-square',
			tweet: 'aspect-video',
			github: 'aspect-2/1',
		},
	},
})

const portraitMedia = tv({
	base: 'aspect-video w-full shrink-0 overflow-hidden bg-muted',
})

const title = tv({
	base: 'leading-snug font-medium text-default',
	variants: {
		variant: {
			landscape: 'line-clamp-2 text-sm',
			portrait: 'line-clamp-3 text-base',
		},
	},
	defaultVariants: { variant: 'landscape' },
})

const description = tv({
	base: 'text-xs text-muted',
	variants: {
		variant: {
			landscape: 'line-clamp-1',
			portrait: 'line-clamp-2',
		},
	},
	defaultVariants: { variant: 'landscape' },
})

watch(
	() => [props.preview.image, props.preview.icon],
	() => {
		imageFailed.value = false
		faviconFailed.value = false
	},
)
</script>

<template>
	<a
		:href="preview.url"
		target="_blank"
		rel="noopener noreferrer"
		:data-type="preview.type"
		:data-variant="effectiveVariant"
		:class="card({ flush, variant: effectiveVariant })"
		@click.stop
	>
		<div v-if="hasPortraitCover" :class="portraitMedia()">
			<img
				:src="image"
				:alt="preview.imageAlt ?? ''"
				class="size-full object-cover"
				loading="lazy"
				referrerpolicy="no-referrer"
				@error="imageFailed = true"
			/>
		</div>
		<div v-else-if="image" :class="landscapeMedia({ type: preview.type })">
			<img
				:src="image"
				:alt="preview.imageAlt ?? ''"
				class="size-full object-cover"
				loading="lazy"
				referrerpolicy="no-referrer"
				@error="imageFailed = true"
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col justify-center gap-1 bg-transparent px-2 py-1">
			<div class="flex min-w-0 items-center justify-start gap-1 text-[11px] text-muted">
				<img
					v-if="favicon && !faviconFailed"
					:src="favicon"
					alt=""
					class="size-3.5 shrink-0 rounded-sm object-contain"
					loading="lazy"
					referrerpolicy="no-referrer"
					@error="faviconFailed = true"
				/>
				<UIcon v-else :name="headerIcon" class="size-3.5 shrink-0" aria-hidden="true" />
				<span class="truncate">{{ siteLabel }}</span>
				<UIcon
					:name="appConfig.ui.icons.external"
					class="ms-auto size-3.5 shrink-0"
					aria-hidden="true"
				/>
			</div>
			<div :class="title({ variant: effectiveVariant })">
				{{ preview.title }}
			</div>
			<div v-if="preview.description" :class="description({ variant: effectiveVariant })">
				{{ preview.description }}
			</div>
		</div>
	</a>
</template>
