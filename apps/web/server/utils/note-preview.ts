import { parseMarkdown } from '@comark/nuxt/parse'
import type { LinkPreview } from '#shared/types/link-preview'
import { isLinkPreviewUrlBlocked } from '#shared/utils/link-preview'
import { planNoteContent } from '#shared/utils/note-content'
import { resolveLinkPreview } from '#server/utils/link-preview'

const previewConcurrency = 4

export async function resolveNoteLinkPreviews(
	content: string,
	existing: Record<string, LinkPreview> = {},
): Promise<Record<string, LinkPreview>> {
	const document = await parseMarkdown(content).catch(() => null)
	if (!document) return {}
	const previews: Record<string, LinkPreview> = {}
	const missing: string[] = []
	for (const source of planNoteContent(document).sources) {
		if (isLinkPreviewUrlBlocked(source.url)) continue
		const preview = existing[source.url]
		if (preview) previews[source.url] = preview
		else missing.push(source.url)
	}
	let next = 0
	async function worker() {
		while (next < missing.length) {
			const url = missing[next++]
			if (!url) continue
			const preview = await resolveLinkPreview(url).catch(() => null)
			if (preview) previews[url] = preview
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(previewConcurrency, missing.length) }, () => worker()),
	)
	return previews
}
