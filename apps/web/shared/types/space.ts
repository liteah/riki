import * as z from 'zod'
import type { Space } from './note'
import { defaultSpaceIcon, entityIconSchema } from './icon'

export const createSpaceBodySchema = z.object({
	name: z.string().trim().min(1).max(64),
	icon: entityIconSchema.default(defaultSpaceIcon),
})

export type CreateSpaceBody = z.output<typeof createSpaceBodySchema>

export const updateSpaceBodySchema = z.object({
	name: z.string().trim().min(1).max(64),
	icon: entityIconSchema.optional(),
})

export type UpdateSpaceBody = z.output<typeof updateSpaceBodySchema>

export type SpaceListItem = Pick<Space, 'id' | 'name' | 'icon'> & { noteCount: number }
