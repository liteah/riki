import { z } from 'zod'
import { isHttpUrl } from '#shared/utils/link-preview'

const querySchema = z.object({
	url: z
		.string()
		.trim()
		.min(1)
		.max(2048)
		.refine((value) => isHttpUrl(value)),
})

export default defineEventHandler(async (event) => {
	await requireUser(event)
	const query = await readQueryZod(event, querySchema)
	const preview = await resolveLinkPreview(query.url)
	if (!preview) throw createError({ statusCode: 502, statusMessage: 'Preview unavailable' })
	return preview
})
