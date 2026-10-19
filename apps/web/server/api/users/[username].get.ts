import { db } from '#server/utils/db'
import { user } from '#server/db/schemas'
import { and, eq } from 'drizzle-orm'

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
