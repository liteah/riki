import { z } from 'zod'

const bodySchema = z.object({
	filename: z.string().trim().max(255).optional(),
	contentType: z
		.string()
		.trim()
		.min(1)
		.max(255)
		.regex(/^[\w.+-]+\/[\w.+-]+$/),
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const body = await readBodyZod(event, bodySchema)
	const config = useRuntimeConfig(event).s3
	if (
		!config.endpoint ||
		!config.bucket ||
		!config.accessKeyId ||
		!config.secretAccessKey ||
		!config.publicUrl
	) {
		throw createError({ statusCode: 500, statusMessage: 'Image storage is not configured' })
	}
	const upload = await createImageUpload(config, user.id, body.contentType, body.filename)
	setResponseStatus(event, 201)
	return upload
})
