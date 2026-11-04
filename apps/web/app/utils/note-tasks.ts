interface TaskTarget {
	pos: number
	checked: boolean
}

export async function toggleTaskItem(
	content: string,
	index: number,
): Promise<{ content: string; changed: boolean }> {
	const [{ Editor }, { default: StarterKit }, { TaskList, TaskItem }, { Markdown }] =
		await Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit'),
			import('@tiptap/extension-list'),
			import('@tiptap/markdown'),
		])

	const editor = new Editor({
		content,
		contentType: 'markdown',
		extensions: [
			Markdown.configure({ markedOptions: { gfm: true } }),
			StarterKit,
			TaskList,
			TaskItem,
		],
	})

	try {
		let seen = -1
		let target: TaskTarget | null = null

		editor.state.doc.descendants((node, pos) => {
			if (node.type.name !== 'taskItem') return true

			seen += 1
			if (seen === index) target = { pos, checked: Boolean(node.attrs.checked) }

			return true
		})

		if (!target) return { content, changed: false }

		const selected = target as TaskTarget
		editor
			.chain()
			.command(({ tr }) => {
				const node = tr.doc.nodeAt(selected.pos)
				if (!node) return false

				tr.setNodeMarkup(selected.pos, undefined, { ...node.attrs, checked: !selected.checked })
				return true
			})
			.run()

		return { content: editor.getMarkdown(), changed: true }
	} finally {
		editor.destroy()
	}
}
