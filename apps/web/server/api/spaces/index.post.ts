import { db } from '#server/utils/db'
import { spaces } from '#server/db/schemas'
import { createSpaceBodySchema } from '#shared/types/space'
import { requireUser } from '#server/utils/session'
import { readBodyZod } from '#server/utils/validation'
import { newId } from '#shared/utils/id'

defineRouteMeta({
	openAPI: {
		tags: ['Spaces'],
		description: 'Creates a space for the signed-in user.',
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/SpaceCreateRequest' },
				},
			},
		},
		responses: {
			201: {
				description: 'Space created. A Location header points to the new space.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Space' } } },
			},
			400: {
				description: 'The body failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const body = await readBodyZod(event, createSpaceBodySchema)

	const spaceId = newId()
	const [spaceRows] = await db.batch([
		db
			.insert(spaces)
			.values({ id: spaceId, name: body.name, icon: body.icon, userId: user.id })
			.returning(),
	])
	const space = spaceRows[0]
	if (!space) throw createError({ statusCode: 500, statusMessage: 'Space not created' })

	setResponseStatus(event, 201)
	setResponseHeader(event, 'Location', `/api/spaces/${spaceId}`)
	return space
})
