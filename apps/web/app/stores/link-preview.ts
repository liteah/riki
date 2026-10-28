import { skipHydrate } from 'pinia'
import type { LinkPreview } from '#shared/types/link-preview'
import { localKeys } from '~/utils/local-cache'

const cacheTtl = 24 * 60 * 60 * 1000
const cacheLimit = 100

type LinkPreviewCache = Record<string, { preview: LinkPreview; fetchedAt: number }>

export const useLinkPreviewStore = defineStore('linkPreview', () => {
	const previews = skipHydrate(useLocalStorage<LinkPreviewCache>(localKeys.linkPreviewCache, {}))
	const pending = new Set<string>()
	const failed = new Set<string>()

	function cached(url: string) {
		const entry = previews.value[url]
		if (!entry || Date.now() - entry.fetchedAt > cacheTtl) return null
		return entry.preview
	}

	function prune(cache: LinkPreviewCache) {
		const keys = Object.keys(cache)
		if (keys.length <= cacheLimit) return
		keys
			.sort((a, b) => cache[a]!.fetchedAt - cache[b]!.fetchedAt)
			.slice(0, keys.length - cacheLimit)
			.forEach((key) => delete cache[key])
	}

	async function load(url: string) {
		if (!import.meta.client || pending.has(url) || failed.has(url) || cached(url)) return
		pending.add(url)
		try {
			const preview = await $fetch<LinkPreview>('/api/link-preview', {
				query: { url },
			})
			const next = { ...previews.value, [url]: { preview, fetchedAt: Date.now() } }
			prune(next)
			previews.value = next
		} catch {
			failed.add(url)
		} finally {
			pending.delete(url)
		}
	}

	return { previews, cached, load }
})
