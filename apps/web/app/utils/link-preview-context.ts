import type { ComputedRef, InjectionKey } from 'vue'
import type { LinkPreview } from '#shared/types/link-preview'

export const noteLinkPreviewsKey: InjectionKey<ComputedRef<Readonly<Record<string, LinkPreview>>>> =
	Symbol('noteLinkPreviews')
