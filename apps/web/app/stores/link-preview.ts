import { skipHydrate } from 'pinia'
import type { LinkPreview } from '#shared/types/link-preview'
import { localKeys } from '~/utils/local-cache'

const cacheTtl = 24 * 60 * 60 * 1000
const cacheLimit = 100

type LinkPreviewCache = Record<string, { preview: LinkPreview; fetchedAt: number }>

export const useLinkPreviewStore = defineStore('linkPreview', () => {
	const previews = skipHydrate(useLocalStorage<LinkPreviewCache>(localKeys.linkPreviewCache, {}))
	const pending = new Map<string, Promise<LinkPreview | null>>()
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

	async function request(url: string) {
		if (!import.meta.client) return null
		const hit = cached(url)
		if (hit) return hit
		const existing = pending.get(url)
		if (existing) return existing
		const task = (async () => {
			try {
				const preview = await $fetch<LinkPreview>('/api/link-preview', {
					query: { url },
				})
				const next = { ...previews.value, [url]: { preview, fetchedAt: Date.now() } }
				prune(next)
				previews.value = next
				return preview
			} catch {
				failed.add(url)
				return null
			} finally {
				pending.delete(url)
			}
		})()
		pending.set(url, task)
		return task
	}

	async function load(url: string) {
		if (failed.has(url)) return
		await request(url)
	}

	async function resolve(url: string) {
		failed.delete(url)
		return request(url)
	}

	return { previews, cached, load, resolve }
})
