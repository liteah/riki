import { db } from '#server/utils/db'
import { user } from '#server/db/schemas'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Users'],
		description: 'Returns the public profile for a non-banned user.',
		parameters: [
			{
				name: 'username',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Username, case-insensitive.',
			},
		],
		responses: {
			200: {
				description: 'The public profile.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } } },
			},
			404: {
				description: 'No such user, or the user is banned.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const username = getRouterParam(event, 'username')?.toLowerCase()
	if (!username) throw createError({ statusCode: 404, statusMessage: 'User not found' })

	const [profile] = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			displayUsername: user.displayUsername,
			image: user.image,
			createdAt: user.createdAt,
		})
		.from(user)
		.where(and(eq(user.username, username), eq(user.banned, false)))

	if (!profile) throw createError({ statusCode: 404, statusMessage: 'User not found' })
	return profile
})
