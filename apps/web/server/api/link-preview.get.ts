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

defineRouteMeta({
	openAPI: {
		tags: ['Link previews'],
		description:
			'Fetches and resolves metadata for an http(s) URL. Private/blocked hosts, unsupported ports, and non-HTML responses fail with 502. Results are cached in memory for six hours.',
		parameters: [
			{
				name: 'url',
				in: 'query',
				required: true,
				schema: { type: 'string' },
				description: 'Absolute http(s) URL to preview.',
			},
		],
		responses: {
			200: {
				description: 'Resolved link preview.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/LinkPreview' } } },
			},
			400: {
				description: 'The url failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			502: {
				description:
					'The URL could not be previewed (blocked host, timeout, unsupported content, or upstream failure).',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	await requireUser(event)
	const query = await readQueryZod(event, querySchema)
	const preview = await resolveLinkPreview(query.url)
	if (!preview) throw createError({ statusCode: 502, statusMessage: 'Preview unavailable' })
	return preview
})
