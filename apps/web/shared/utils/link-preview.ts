import { linkPreviewTypes } from '../types/link-preview'
import type {
	LinkPreview,
	LinkPreviewMeta,
	LinkPreviewMetaValue,
	LinkPreviewType,
} from '../types/link-preview'

type MetaContext = { url: URL; host: string; segments: string[] }

interface HostRule {
	type: LinkPreviewType
	provider?: string
	icon?: string
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

const blockedPreviewHosts = new Set(['localhost', 'metadata.google.internal'])
const blockedPreviewSuffixes = [
	'.localhost',
	'.local',
	'.internal',
	'.lan',
	'.home.arpa',
	'.nip.io',
	'.sslip.io',
	'.xip.io',
	'.localtest.me',
	'.lvh.me',
	'.vcap.me',
]
// [network, prefix length] pairs, including non-routable documentation ranges.
const privateIpv4Ranges: Array<[number, number]> = [
	[0x00000000, 8],
	[0x0a000000, 8],
	[0x64400000, 10],
	[0x7f000000, 8],
	[0xa9fe0000, 16],
	[0xac100000, 12],
	[0xc0000000, 24],
	[0xc0000200, 24],
	[0xc0a80000, 16],
	[0xc6120000, 15],
	[0xc6336400, 24],
	[0xcb007100, 24],
	[0xe0000000, 4],
	[0xf0000000, 4],
]
const privateIpv6Ranges: Array<[number, number]> = [
	[0xfc00, 0xfe00],
	[0xfe80, 0xffc0],
	[0xfec0, 0xffc0],
	[0xff00, 0xff00],
]

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
	{
		type: 'github',
		provider: 'GitHub',
		icon: 'githubLogo',
		hosts: ['github.com', 'gist.github.com'],
	},
	{
		type: 'tweet',
		provider: 'Twitter (X)',
		icon: 'twitterLogo',
		hosts: ['x.com', 'twitter.com', 't.co'],
		hostSuffixes: ['.twitter.com'],
	},
	{
		type: 'music',
		provider: 'YouTube',
		icon: 'youtubeLogo',
		hosts: ['music.youtube.com'],
	},
	{
		type: 'video',
		provider: 'YouTube',
		icon: 'youtubeLogo',
		hosts: ['youtube.com', 'youtu.be'],
		hostSuffixes: ['.youtube.com'],
	},
	{ type: 'video', provider: 'Vimeo', hosts: ['vimeo.com'] },
	{ type: 'video', provider: 'Bilibili', hosts: ['bilibili.com', 'b23.tv'] },
	{ type: 'video', provider: 'Dailymotion', hosts: ['dailymotion.com'] },
	{
		type: 'video',
		provider: 'Twitch',
		icon: 'twitchLogo',
		hosts: ['twitch.tv'],
		hostSuffixes: ['.twitch.tv'],
	},
	{ type: 'video', provider: 'TikTok', hosts: ['tiktok.com'] },
	{
		type: 'podcast',
		provider: 'Spotify',
		icon: 'spotifyLogo',
		hosts: ['open.spotify.com'],
		path: /^\/(?:episode|show)\//,
	},
	{ type: 'music', provider: 'Spotify', icon: 'spotifyLogo', hosts: ['open.spotify.com'] },
	{ type: 'music', provider: 'Apple Music', icon: 'music', hosts: ['music.apple.com'] },
	{
		type: 'music',
		provider: 'SoundCloud',
		icon: 'soundcloudLogo',
		hosts: ['soundcloud.com'],
		hostSuffixes: ['.soundcloud.com'],
	},
	{ type: 'music', provider: 'Bandcamp', hosts: ['bandcamp.com'] },
	{ type: 'music', provider: 'Mixcloud', hosts: ['mixcloud.com'] },
	{ type: 'music', provider: 'Audiomack', hosts: ['audiomack.com'] },
	{
		type: 'music',
		provider: 'Last.fm',
		icon: 'lastfmLogo',
		hosts: ['last.fm', 'lastfm.com'],
	},
	{
		type: 'podcast',
		provider: 'Apple Podcasts',
		icon: 'appleLogo',
		hosts: ['podcasts.apple.com'],
	},
	{ type: 'podcast', provider: 'Castbox', hosts: ['castbox.fm'] },
	{ type: 'podcast', provider: 'Overcast', hosts: ['overcast.fm'] },
	{ type: 'podcast', provider: 'Pocket Casts', hosts: ['pca.st'] },
	{ type: 'podcast', provider: 'Podbean', hosts: ['podbean.com'] },
	{ type: 'podcast', provider: 'Player FM', hosts: ['player.fm'] },
	{
		type: 'article',
		provider: 'Medium',
		icon: 'mediumLogo',
		hosts: ['medium.com'],
		hostSuffixes: ['.medium.com'],
	},
	{
		type: 'article',
		provider: 'LinkedIn',
		icon: 'linkedinLogo',
		hosts: ['linkedin.com', 'lnkd.in'],
		hostSuffixes: ['.linkedin.com'],
	},
	{
		type: 'article',
		provider: 'Reddit',
		icon: 'redditLogo',
		hosts: ['reddit.com', 'redd.it'],
		hostSuffixes: ['.reddit.com'],
	},
	{
		type: 'website',
		provider: 'Instagram',
		icon: 'instagramLogo',
		hosts: ['instagram.com'],
		hostSuffixes: ['.instagram.com'],
	},
	{
		type: 'website',
		provider: 'Mastodon',
		icon: 'mastodonLogo',
		hosts: [
			'mastodon.social',
			'mastodon.online',
			'mstdn.social',
			'mstdn.jp',
			'fosstodon.org',
			'hachyderm.io',
			'infosec.exchange',
			'techhub.social',
			'mas.to',
			'mastodon.world',
			'universeodon.com',
			'mastodon.cloud',
			'mastodonapp.uk',
			'pawoo.net',
		],
	},
	{
		type: 'website',
		provider: 'Threads',
		icon: 'threadsLogo',
		hosts: ['threads.net', 'threads.com'],
	},
	{
		type: 'website',
		provider: 'Pinterest',
		icon: 'pinterestLogo',
		hosts: ['pinterest.com', 'pin.it'],
		hostSuffixes: ['.pinterest.com'],
	},
	{
		type: 'website',
		provider: 'Apple',
		icon: 'appleLogo',
		hosts: ['apple.com'],
		hostSuffixes: ['.apple.com'],
	},
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

// OGP types are namespaced (`music.song`, `video.movie`); compare the base namespace only.
function linkPreviewTypeFromOg(value?: string | null) {
	const base = value
		?.trim()
		.toLowerCase()
		.match(/^[^.:]+/)?.[0]
	return base && linkPreviewTypes.some((type) => type === base) ? (base as LinkPreviewType) : null
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

export function isLinkPreviewUrlBlocked(value: string) {
	const url = parseHttpUrl(value)
	if (!url) return true
	if (url.username || url.password) return true
	if (url.port && url.port !== '80' && url.port !== '443') return true
	const host = url.hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '')
	return !host || isBlockedHostname(host) || isBlockedIp(host)
}

function isBlockedHostname(host: string) {
	return (
		blockedPreviewHosts.has(host) ||
		blockedPreviewSuffixes.some((suffix) => host.endsWith(suffix)) ||
		(!host.includes('.') && !host.includes(':'))
	)
}

function isBlockedIp(host: string) {
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return isPrivateIpv4(host)
	if (host.includes(':')) return isPrivateIpv6(host)
	return false
}

function isPrivateIpv4(host: string) {
	const parts = host.split('.').map(Number)
	if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) return false
	const value = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
	return privateIpv4Ranges.some(([base, bits]) => {
		const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
		return (value & mask) === base
	})
}

function isPrivateIpv6(host: string) {
	const normalized = host.replace(/^\[|\]$/g, '').toLowerCase()
	if (normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:')) return true
	const first = Number.parseInt(normalized.split(':')[0] ?? '', 16)
	if (Number.isNaN(first)) return false
	return privateIpv6Ranges.some(([base, mask]) => (first & mask) === base)
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

export function linkPreviewProviderIconKey(value: string) {
	const url = parseHttpUrl(value)
	if (!url) return undefined
	return hostRuleFor(normalizeHost(url.hostname), url.pathname.toLowerCase())?.icon
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
