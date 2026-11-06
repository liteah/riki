import { db } from '#server/utils/db'
import { sidebar } from '#server/db/schemas'
import { reorderSidebarBodySchema } from '#shared/types/view'
import { requireUser } from '#server/utils/session'
import { reorderSidebar } from '#server/utils/sidebar'
import { readBodyZod } from '#server/utils/validation'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Sidebar'],
		description:
			'Moves a sidebar entry to a target index, shifting the other entries to fill the gap.',
		parameters: [
			{
				name: 'id',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'Sidebar entry id.',
			},
		],
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/SidebarReorderRequest' },
				},
			},
		},
		responses: {
			200: {
				description: 'The moved sidebar entry.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/SidebarEntry' } } },
			},
			400: {
				description: 'The id or body failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			404: {
				description: 'The sidebar entry is missing or not yours.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)

	const id = getRouterParam(event, 'id')
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Validation failed' })

	const body = await readBodyZod(event, reorderSidebarBodySchema)

	if (!(await reorderSidebar(user.id, id, body.position))) {
		throw createError({ statusCode: 404, statusMessage: 'Sidebar item not found' })
	}

	const [moved] = await db
		.select()
		.from(sidebar)
		.where(and(eq(sidebar.id, id), eq(sidebar.userId, user.id)))
		.limit(1)
	return moved
})
