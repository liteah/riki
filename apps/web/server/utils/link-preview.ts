import type { LinkPreview } from '#shared/types/link-preview'
import {
	cleanText,
	hostLabel,
	inferLinkPreviewType,
	linkPreviewMetaForUrl,
	linkPreviewProviderName,
	normalizeOgType,
	parseHttpUrl,
	resolveHttpAsset,
} from '#shared/utils/link-preview'

const maxHtmlBytes = 512 * 1024
const maxRedirects = 3
const fetchTimeout = 5000
const cacheTtl = 6 * 60 * 60 * 1000
const cacheLimit = 200
const htmlContentType = /^(?:application\/xhtml\+xml|text\/html)/i

const cache = new Map<string, { preview: LinkPreview; expiresAt: number }>()
const pending = new Map<string, Promise<LinkPreview | null>>()
const blockedHosts = new Set(['localhost', 'metadata.google.internal'])
const blockedSuffixes = [
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

export async function resolveLinkPreview(value: string): Promise<LinkPreview | null> {
	const url = parseHttpUrl(value)
	if (!url) return null
	const key = url.href
	const cached = cache.get(key)
	if (cached && cached.expiresAt > Date.now()) return cached.preview
	const existing = pending.get(key)
	if (existing) return existing
	const task = buildLinkPreview(url)
		.then((preview) => {
			if (preview) {
				cache.set(key, { preview, expiresAt: Date.now() + cacheTtl })
				if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!)
			}
			return preview
		})
		.finally(() => pending.delete(key))
	pending.set(key, task)
	return task
}

async function buildLinkPreview(url: URL) {
	try {
		assertPublicUrl(url)
		const page = await fetchHtml(url)
		if (!page) return null
		return parseLinkPreviewHtml(page.html, page.url, url)
	} catch {
		return null
	}
}

async function fetchHtml(url: URL, depth = 0): Promise<{ html: string; url: URL } | null> {
	if (depth > maxRedirects) return null
	const response = await fetch(url, {
		redirect: 'manual',
		signal: AbortSignal.timeout(fetchTimeout),
		headers: {
			accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
			'accept-language': 'en-US,en;q=0.8',
			'user-agent': 'RikkiLinkPreview/1.0',
		},
	})
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get('location')
		if (!location) return null
		const next = new URL(location, url)
		assertPublicUrl(next)
		return fetchHtml(next, depth + 1)
	}
	if (!response.ok) return null
	const contentType = response.headers.get('content-type')
	if (contentType && !htmlContentType.test(contentType)) return null
	const html = await readBodyLimited(response)
	return html === null ? null : { html, url }
}

async function readBodyLimited(response: Response) {
	const body = response.body
	if (!body) return null
	const reader = body.getReader()
	const decoder = new TextDecoder()
	const chunks: string[] = []
	let total = 0
	try {
		while (total < maxHtmlBytes) {
			const { done, value } = await reader.read()
			if (done) break
			if (!value) continue
			const remaining = maxHtmlBytes - total
			const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value
			total += chunk.byteLength
			chunks.push(decoder.decode(chunk, { stream: true }))
			if (total >= maxHtmlBytes) break
		}
		chunks.push(decoder.decode())
		return chunks.join('')
	} finally {
		reader.releaseLock()
	}
}

export function parseLinkPreviewHtml(html: string, pageUrl: URL, sourceUrl: URL): LinkPreview {
	const meta = new Map<string, string>()
	let titleTag = ''
	let icon: string | undefined
	for (const match of html.matchAll(/<(meta|link|title)\b([^>]*)>/gi)) {
		const tag = match[1]?.toLowerCase()
		if (tag === 'title') {
			const end = html.indexOf('</title>', (match.index ?? 0) + match[0].length)
			if (end >= 0) titleTag = html.slice((match.index ?? 0) + match[0].length, end)
			continue
		}
		const attributes = readAttributes(match[2] ?? '')
		if (tag === 'link') {
			const rel = (attributes.rel ?? '').toLowerCase()
			if (!icon && rel.includes('icon')) icon = attributes.href
			continue
		}
		const key = (attributes.property ?? attributes.name ?? attributes.itemprop ?? '').toLowerCase()
		if (key && attributes.content && !meta.has(key)) meta.set(key, attributes.content)
	}
	const title =
		metaValue(meta, ['og:title', 'twitter:title']) ??
		cleanText(titleTag, 300) ??
		hostLabel(sourceUrl.href)
	const description = metaValue(meta, ['og:description', 'twitter:description', 'description'], 500)
	const ogTypeValue = metaValue(meta, ['og:type'])
	const type = inferLinkPreviewType(sourceUrl.href, ogTypeValue)
	const image = resolveHttpAsset(
		metaValue(meta, [
			'og:image:secure_url',
			'og:image:url',
			'og:image',
			'twitter:image',
			'twitter:image:src',
		]),
		pageUrl.href,
	)
	const imageWidth = metaNumber(meta, ['og:image:width', 'twitter:image:width'])
	const imageHeight = metaNumber(meta, ['og:image:height', 'twitter:image:height'])
	const author = metaValue(meta, ['article:author', 'author', 'twitter:creator'], 100)
	const publishedAt = metaValue(
		meta,
		['article:published_time', 'datepublished', 'date', 'og:updated_time'],
		50,
	)
	return {
		url: sourceUrl.href,
		type,
		ogType: normalizeOgType(ogTypeValue),
		title,
		description,
		image,
		imageWidth,
		imageHeight,
		icon: resolveHttpAsset(icon, pageUrl.href),
		siteName:
			metaValue(meta, ['og:site_name', 'application-name'], 100) ??
			linkPreviewProviderName(sourceUrl.href) ??
			hostLabel(sourceUrl.href),
		author: author && !isHttpUrlText(author) ? author : undefined,
		publishedAt,
		meta: linkPreviewMetaForUrl(sourceUrl.href, type),
	}
}

function readAttributes(source: string) {
	const attributes: Record<string, string> = {}
	for (const match of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
		const key = match[1]?.toLowerCase()
		if (key) attributes[key] = match[2] ?? match[3] ?? match[4] ?? ''
	}
	return attributes
}

function metaValue(meta: Map<string, string>, keys: string[], maxLength = 300) {
	for (const key of keys) {
		const value = cleanText(meta.get(key), maxLength)
		if (value) return value
	}
	return undefined
}

function metaNumber(meta: Map<string, string>, keys: string[]) {
	for (const key of keys) {
		const value = Number.parseInt(meta.get(key) ?? '', 10)
		if (Number.isFinite(value) && value > 0 && value <= 100_000) return value
	}
	return undefined
}

function isHttpUrlText(value: string) {
	return /^https?:\/\//i.test(value)
}

// Note content is untrusted; reject loopback, private, and metadata targets before fetching.
function assertPublicUrl(url: URL) {
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol')
	if (url.username || url.password) throw new Error('Credentials are not allowed')
	if (url.port && url.port !== '80' && url.port !== '443') throw new Error('Port is not allowed')
	const host = url.hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '')
	if (!host || isBlockedHostname(host) || isBlockedIp(host)) throw new Error('Private host')
}

function isBlockedHostname(host: string) {
	return (
		blockedHosts.has(host) ||
		blockedSuffixes.some((suffix) => host.endsWith(suffix)) ||
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
