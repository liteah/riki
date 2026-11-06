import { auth } from '#server/utils/auth'

defineRouteMeta({
	openAPI: {
		tags: ['Authentication'],
		description:
			'Better Auth endpoints under /api/auth/*. Common flows: POST /api/auth/sign-up/email, POST /api/auth/sign-in/email, POST /api/auth/sign-in/username, GET|POST /api/auth/get-session, POST /api/auth/sign-out. The request and response bodies are defined by Better Auth (and its admin/api-key/username plugins), not by Riki.',
		externalDocs: {
			url: 'https://better-auth.com/docs',
			description: 'Better Auth API reference',
		},
		parameters: [
			{
				name: 'all',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Better Auth route path, e.g. sign-in/email.',
			},
		],
		responses: {
			200: {
				description: 'Better Auth response; shape depends on the endpoint.',
				content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
			},
			'4XX': {
				description: 'Better Auth error; shape depends on the endpoint.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler((event) => {
	return auth.handler(toWebRequest(event))
})
