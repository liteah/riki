export function useNoteListReady(): Promise<void> | undefined {
	const noteStore = useNoteStore()
	if (import.meta.server || !navigator.onLine) return
	if (noteStore.loaded && !noteStore.pending) return

	const load = noteStore.pending ? undefined : noteStore.loadMore(true)
	return new Promise<void>((resolve) => {
		const stop = watch(
			() => noteStore.pending,
			(pending) => {
				if (pending) return
				stop()
				resolve()
			},
			{ immediate: true },
		)
		void load?.finally(() => {
			if (noteStore.pending) return
			stop()
			resolve()
		})
	})
}
