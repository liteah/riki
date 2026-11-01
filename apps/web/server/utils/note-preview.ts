import { parseMarkdown } from '@comark/nuxt/parse'
import type { LinkPreview } from '#shared/types/link-preview'
import { isLinkPreviewUrlBlocked } from '#shared/utils/link-preview'
import { planNoteContent } from '#shared/utils/note-content'
import { resolveLinkPreview } from '#server/utils/link-preview'

const previewConcurrency = 4

export async function resolveNoteLinkPreviews(
	content: string,
	existing: Record<string, LinkPreview> = {},
	previousContent?: string,
): Promise<Record<string, LinkPreview>> {
	const [document, previousDocument] = await Promise.all([
		parseMarkdown(content).catch(() => null),
		previousContent === undefined ? null : parseMarkdown(previousContent).catch(() => null),
	])
	if (!document) return {}
	const previousSources =
		previousDocument === null
			? null
			: new Map(planNoteContent(previousDocument).sources.map((source) => [source.url, source]))
	const previews: Record<string, LinkPreview> = {}
	const missing: string[] = []
	for (const source of planNoteContent(document).sources) {
		if (isLinkPreviewUrlBlocked(source.url)) continue
		const previous = previousSources?.get(source.url)
		const changed = previous !== undefined && previous.label !== source.label
		const shouldFetch = previousSources === null || !previous || changed
		const preview = existing[source.url]
		// Reuse unchanged metadata; only a new URL or changed link label needs a fetch.
		if (preview && !changed) previews[source.url] = preview
		else if (shouldFetch) {
			if (preview) previews[source.url] = preview
			missing.push(source.url)
		}
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
