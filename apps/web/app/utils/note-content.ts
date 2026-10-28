import { textContent, visit } from '@comark/nuxt/utils'
import type { LinkPreviewSource } from '#shared/types/link-preview'
import { cleanText, parseHttpUrl } from '#shared/utils/link-preview'

type MarkdownDocument = Parameters<typeof visit>[0]

export interface NoteContentPlan {
	sources: LinkPreviewSource[]
	hasTitle: boolean
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
