import { linkPreviewTypes } from '../types/link-preview'
import type {
	LinkPreview,
	LinkPreviewMeta,
	LinkPreviewMetaValue,
	LinkPreviewType,
} from '../types/link-preview'

export interface LinkPreviewSource {
	url: string
	label?: string
}

type MetaContext = { url: URL; host: string; segments: string[] }

interface HostRule {
	type: LinkPreviewType
	provider?: string
	hosts?: string[]
	hostPrefixes?: string[]
	hostSuffixes?: string[]
	path?: RegExp
}

interface MetaRule {
	build?: (context: MetaContext) => LinkPreviewMeta
	label?: (meta: LinkPreviewMeta) => string | undefined
}

const audioExtensions = /\.(?:aac|flac|m4a|mp3|oga|ogg|opus|wav|weba)$/i
const videoExtensions = /\.(?:m3u8|mov|mp4|mpeg|mpg|ogv|webm)$/i
const articlePath = /(?:^|\/)(?:article|articles|blog|news|post|posts|story|stories)(?:\/|$)/i

const entityMap: Record<string, string> = {
	amp: '&',
	apos: "'",
	gt: '>',
	hellip: '…',
	lt: '<',
	mdash: '—',
	nbsp: ' ',
	ndash: '–',
	quot: '"',
}

// First match wins; keep narrower host and path rules above their siblings.
const hostRules: HostRule[] = [
	{ type: 'github', provider: 'GitHub', hosts: ['github.com', 'gist.github.com'] },
	{
		type: 'tweet',
		provider: 'X',
		hosts: ['x.com', 'twitter.com', 't.co'],
		hostSuffixes: ['.twitter.com'],
	},
	{ type: 'music', provider: 'YouTube', hosts: ['music.youtube.com'] },
	{ type: 'video', provider: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
	{ type: 'video', provider: 'Vimeo', hosts: ['vimeo.com'] },
	{ type: 'video', provider: 'Bilibili', hosts: ['bilibili.com', 'b23.tv'] },
	{ type: 'video', provider: 'Dailymotion', hosts: ['dailymotion.com'] },
	{ type: 'video', provider: 'Twitch', hosts: ['twitch.tv'] },
	{ type: 'video', provider: 'TikTok', hosts: ['tiktok.com'] },
	{
		type: 'podcast',
		provider: 'Spotify',
		hosts: ['open.spotify.com'],
		path: /^\/(?:episode|show)\//,
	},
	{ type: 'music', provider: 'Spotify', hosts: ['open.spotify.com'] },
	{ type: 'music', provider: 'Apple Music', hosts: ['music.apple.com'] },
	{ type: 'music', provider: 'SoundCloud', hosts: ['soundcloud.com'] },
	{ type: 'music', provider: 'Bandcamp', hosts: ['bandcamp.com'] },
	{ type: 'music', provider: 'Mixcloud', hosts: ['mixcloud.com'] },
	{ type: 'music', provider: 'Audiomack', hosts: ['audiomack.com'] },
	{ type: 'podcast', provider: 'Apple Podcasts', hosts: ['podcasts.apple.com'] },
	{ type: 'podcast', provider: 'Castbox', hosts: ['castbox.fm'] },
	{ type: 'podcast', provider: 'Overcast', hosts: ['overcast.fm'] },
	{ type: 'podcast', provider: 'Pocket Casts', hosts: ['pca.st'] },
	{ type: 'podcast', provider: 'Podbean', hosts: ['podbean.com'] },
	{ type: 'podcast', provider: 'Player FM', hosts: ['player.fm'] },
	{ type: 'article', provider: 'Medium', hosts: ['medium.com'] },
	{ type: 'article', provider: 'DEV', hosts: ['dev.to'] },
	{ type: 'article', hostPrefixes: ['blog.', 'news.'], hostSuffixes: ['.substack.com'] },
]

const pathTypeRules: Array<[RegExp, LinkPreviewType]> = [
	[videoExtensions, 'video'],
	[audioExtensions, 'audio'],
]

const videoIdReaders = new Map<string, (context: MetaContext) => string | undefined>([
	['youtu.be', ({ segments }) => segments[0]],
	['youtube.com', ({ url }) => url.searchParams.get('v') ?? undefined],
	['vimeo.com', ({ segments }) => segments[0]],
	['bilibili.com', ({ segments }) => (segments[0] === 'video' ? segments[1] : undefined)],
])

const metaRules: Partial<Record<LinkPreviewType, MetaRule>> = {
	github: {
		build: ({ segments }) =>
			compactMeta([
				['owner', segments[0]],
				['repo', segments[1]],
				['kind', segments[2]],
				['number', segments[3]],
			]),
		label: (meta) =>
			typeof meta.owner === 'string' && typeof meta.repo === 'string'
				? `${meta.owner}/${meta.repo}`
				: undefined,
	},
	tweet: {
		build: ({ segments }) => {
			const statusIndex = segments.indexOf('status')
			return compactMeta([
				['handle', segments[0]?.replace(/^@/, '')],
				['tweetId', statusIndex >= 0 ? segments[statusIndex + 1] : undefined],
			])
		},
		label: (meta) => (typeof meta.handle === 'string' ? `@${meta.handle}` : undefined),
	},
	video: {
		build: (context) =>
			compactMeta([
				['provider', linkPreviewProviderName(context.url.href)],
				['videoId', videoIdReaders.get(context.host)?.(context)],
			]),
	},
	music: {
		build: ({ url }) => compactMeta([['provider', linkPreviewProviderName(url.href)]]),
	},
	podcast: {
		build: ({ url }) => compactMeta([['provider', linkPreviewProviderName(url.href)]]),
	},
}

function compactMeta(entries: Array<[string, LinkPreviewMetaValue | undefined]>) {
	return Object.fromEntries(entries.filter((entry) => entry[1] !== undefined)) as LinkPreviewMeta
}

function normalizeHost(value: string) {
	return value.toLowerCase().replace(/^www\./, '')
}

function matchesHost(rule: HostRule, host: string, path: string) {
	const hostMatches = Boolean(
		rule.hosts?.includes(host) ||
		rule.hostPrefixes?.some((prefix) => host.startsWith(prefix)) ||
		rule.hostSuffixes?.some((suffix) => host.endsWith(suffix)),
	)
	return hostMatches && (!rule.path || rule.path.test(path))
}

function hostRuleFor(host: string, path: string) {
	return hostRules.find((rule) => matchesHost(rule, host, path))
}

function pathTypeFor(path: string) {
	return pathTypeRules.find(([pattern]) => pattern.test(path))?.[1]
}

export function normalizeOgType(value?: string | null) {
	const normalized = value?.trim().toLowerCase()
	if (!normalized || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(normalized)) return undefined
	return normalized.replace(/[._-]([a-z0-9])/g, (_, character: string) => character.toUpperCase())
}

// OGP types are namespaced (`music.song`, `video.movie`); compare the base namespace only.
function linkPreviewTypeFromOg(value?: string | null) {
	const base = value
		?.trim()
		.toLowerCase()
		.match(/^[^.:]+/)?.[0]
	return base && linkPreviewTypes.some((type) => type === base) ? (base as LinkPreviewType) : null
}

const markdownLink = /\[([^\]\n]*)\]\(\s*(https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/gi
const bareUrl = /https?:\/\/[^\s<>"']+/gi

function blankRange(value: string, index: number, length: number) {
	return `${value.slice(0, index)}${' '.repeat(length)}${value.slice(index + length)}`
}

function trimUrlCandidate(value: string) {
	let candidate = value
	while (/[.,;!?，。；：！？、]$/.test(candidate)) candidate = candidate.slice(0, -1)
	let open = 0
	let close = 0
	for (const character of candidate) {
		if (character === '(') open += 1
		if (character === ')') close += 1
	}
	while (close > open && candidate.endsWith(')')) {
		candidate = candidate.slice(0, -1)
		close -= 1
	}
	return candidate
}

export function extractLinkPreviewSources(content: string): LinkPreviewSource[] {
	let text = content
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`\n]*`/g, ' ')
		.replace(/!\[[^\]\n]*\]\([^)]*\)/g, ' ')
	const candidates: Array<{ index: number; url: string; label?: string }> = []

	for (const match of text.matchAll(markdownLink)) {
		candidates.push({
			index: match.index ?? 0,
			url: match[2] ?? '',
			label: match[1],
		})
		text = blankRange(text, match.index ?? 0, match[0].length)
	}
	for (const match of text.matchAll(bareUrl)) {
		candidates.push({
			index: match.index ?? 0,
			url: trimUrlCandidate(match[0]),
		})
	}

	const sources = new Map<string, LinkPreviewSource>()
	for (const candidate of candidates.sort((a, b) => a.index - b.index)) {
		const url = parseHttpUrl(candidate.url)
		if (!url || sources.has(url.href)) continue
		sources.set(url.href, {
			url: url.href,
			label: cleanText(candidate.label, 300),
		})
	}
	return [...sources.values()]
}

export function parseHttpUrl(value: string): URL | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	try {
		const url = new URL(trimmed)
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
	} catch {
		return null
	}
}

export function isHttpUrl(value: string) {
	return parseHttpUrl(value) !== null
}

export function cleanText(value: string | null | undefined, maxLength = 0) {
	if (!value) return undefined
	const decoded = value
		.replace(/&#x([\da-f]+);/gi, (entity, code: string) => decodeCodePoint(code, 16, entity))
		.replace(/&#(\d+);/g, (entity, code: string) => decodeCodePoint(code, 10, entity))
		.replace(/&([a-z]+);/gi, (entity, name: string) => entityMap[name.toLowerCase()] ?? entity)
	const text = decoded.replace(/\s+/g, ' ').trim()
	if (!text) return undefined
	return maxLength > 0 ? text.slice(0, maxLength) : text
}

function decodeCodePoint(value: string, radix: 10 | 16, fallback: string) {
	const codePoint = Number.parseInt(value, radix)
	if (!Number.isFinite(codePoint) || codePoint > 0x10ffff) return fallback
	return String.fromCodePoint(codePoint)
}

export function hostLabel(value: string) {
	const url = parseHttpUrl(value)
	const host = url?.hostname ?? value
	return host.replace(/^www\./i, '').replace(/\.$/, '')
}

export function linkPreviewProviderName(value: string) {
	const url = parseHttpUrl(value)
	if (!url) return undefined
	return hostRuleFor(normalizeHost(url.hostname), url.pathname.toLowerCase())?.provider
}

export function linkPreviewMetaLabel(type: LinkPreviewType, meta?: LinkPreviewMeta) {
	return metaRules[type]?.label?.(meta ?? {})
}

export function inferLinkPreviewType(value: string, ogType?: string | null): LinkPreviewType {
	const url = parseHttpUrl(value)
	const og = linkPreviewTypeFromOg(ogType)
	if (!url) return og ?? 'website'
	const host = normalizeHost(url.hostname)
	const path = url.pathname.toLowerCase()
	return (
		hostRuleFor(host, path)?.type ??
		pathTypeFor(path) ??
		og ??
		(articlePath.test(path) ? 'article' : 'website')
	)
}

export function linkPreviewMetaForUrl(value: string, type: LinkPreviewType) {
	const url = parseHttpUrl(value)
	if (!url) return undefined
	const meta = metaRules[type]?.build?.({
		url,
		host: normalizeHost(url.hostname),
		segments: url.pathname.split('/').filter(Boolean),
	})
	return meta && Object.keys(meta).length > 0 ? meta : undefined
}

export function resolveHttpAsset(value: string | undefined, base: string) {
	const raw = cleanText(value, 2048)
	if (!raw) return undefined
	try {
		const url = new URL(raw, base)
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
	} catch {
		return undefined
	}
}

export function createFallbackLinkPreview(value: string, label?: string | null): LinkPreview {
	const url = parseHttpUrl(value)
	const href = url?.href ?? value
	const host = hostLabel(href)
	const siteName = linkPreviewProviderName(href) ?? host
	const type = inferLinkPreviewType(href)
	const meta = linkPreviewMetaForUrl(href, type)
	const labelText = cleanText(label, 300)
	const title =
		labelText && labelText !== href && labelText !== host
			? labelText
			: (linkPreviewMetaLabel(type, meta) ?? siteName)
	return {
		url: href,
		type,
		title,
		siteName,
		meta,
	}
}
