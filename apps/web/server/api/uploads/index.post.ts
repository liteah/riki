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

defineRouteMeta({
	openAPI: {
		tags: ['Uploads'],
		description:
			'Signs a direct S3 PUT upload for an image. The client uploads bytes itself with the presigned uploadUrl; no object exists server-side until the client stores the returned public url in a note.',
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/UploadRequest' },
				},
			},
		},
		responses: {
			201: {
				description: 'Presigned upload target.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/UploadTarget' } } },
			},
			400: {
				description: 'The body failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			500: {
				description: 'Object storage is not configured on the server.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
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
