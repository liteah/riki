import type { ComputedRef, InjectionKey } from 'vue'

export type SuppressedLinkMode = 'hide' | 'text'

export const suppressedLinkPreviewsKey: InjectionKey<
	ComputedRef<ReadonlyMap<string, SuppressedLinkMode>>
> = Symbol('suppressedLinkPreviews')
