import { textContent, visit } from '@comark/nuxt/utils'
import { MarkdownExit } from 'markdown-exit'
import type { Token } from 'markdown-exit'
import type { LinkPreviewSource } from '../types/link-preview'
import { cleanText, parseHttpUrl } from './link-preview'

type MarkdownDocument = Parameters<typeof visit>[0]

export interface NoteImageSource {
	src: string
	alt?: string
}

export interface NoteContentPlan {
	sources: LinkPreviewSource[]
	hasTitle: boolean
}

// Comark's post plugin runs after the parent render; parse images eagerly so SSR gallery and inline suppression agree.
const imageParser = new MarkdownExit()

export function normalizeNoteImageSource(value: string): string | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
	if (trimmed.startsWith('./') || trimmed.startsWith('../')) return trimmed
	const url = parseHttpUrl(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
	return url?.href ?? null
}

export function planNoteImages(markdown: string): NoteImageSource[] {
	const images = new Map<string, NoteImageSource>()
	const collect = (tokens: Token[]) => {
		for (const token of tokens) {
			if (token.type === 'image') {
				const src = token.attrGet('src')
				if (src) {
					const source = normalizeNoteImageSource(src)
					if (source && !images.has(source)) {
						images.set(source, { src: source, alt: cleanText(token.content, 300) })
					}
				}
			}
			if (token.children?.length) collect(token.children)
		}
	}
	collect(imageParser.parse(markdown))
	return [...images.values()]
}

function previewAttribute(attributes: Record<string, unknown>): boolean | undefined {
	const value = attributes[':preview'] ?? attributes.preview
	if (value === undefined) return undefined
	return value !== false && value !== 'false'
}

function mergePreview(
	current: boolean | undefined,
	next: boolean | undefined,
): boolean | undefined {
	if (current === true || next === true) return true
	if (current === false || next === false) return false
	return undefined
}

export function planNoteContent(document: MarkdownDocument): NoteContentPlan {
	const sources = new Map<string, LinkPreviewSource>()
	visit(
		document,
		(node) => Array.isArray(node) && node[0] === 'a',
		(node) => {
			if (!Array.isArray(node) || node[0] !== 'a') return
			const attributes = node[1]
			const href = attributes.href
			if (typeof href !== 'string') return
			const url = parseHttpUrl(href)
			if (!url) return
			const label = cleanText(textContent(node), 300)
			const labelUrl = label ? parseHttpUrl(label) : null
			const bare = !label || label === href || label === url.href || labelUrl?.href === url.href
			const existing = sources.get(url.href)
			const preview = previewAttribute(attributes)
			if (existing) {
				existing.preview = mergePreview(existing.preview, preview)
				if (!existing.label && !bare && label) existing.label = label
				return
			}
			sources.set(url.href, {
				url: url.href,
				label: bare ? undefined : label,
				preview,
			})
		},
	)
	const title = document.frontmatter?.title
	return {
		sources: [...sources.values()],
		hasTitle:
			(typeof title === 'string' && title.trim().length > 0) ||
			document.nodes.some((node) => Array.isArray(node) && node[0] === 'h1'),
	}
}
