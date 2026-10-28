export const linkPreviewTypes = [
	'website',
	'article',
	'book',
	'video',
	'audio',
	'music',
	'podcast',
	'tweet',
	'github',
] as const

export type LinkPreviewType = (typeof linkPreviewTypes)[number]

export type LinkPreviewMode = 'never' | 'landscape' | 'portrait'

export interface LinkPreviewSource {
	url: string
	label?: string
	preview?: boolean
}

export type LinkPreviewMetaValue = string | number | boolean | null

export type LinkPreviewMeta = Record<string, LinkPreviewMetaValue | undefined>

export interface LinkPreview {
	url: string
	type: LinkPreviewType
	ogType?: string
	title: string
	description?: string
	image?: string
	imageWidth?: number
	imageHeight?: number
	imageAlt?: string
	icon?: string
	siteName?: string
	author?: string
	publishedAt?: string
	meta?: LinkPreviewMeta
}
