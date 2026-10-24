import * as z from 'zod'

export interface Note {
	id: string
	content: string
	userId: string
	spaceId: string | null
	visibility: NoteVisibility
	status: NoteStatus
	createdAt: Date
	updatedAt: Date
}

export interface Space {
	id: string
	name: string
	userId: string
	createdAt: Date
	updatedAt: Date
}

export interface Tag {
	id: string
	name: string
	userId: string
	createdAt: Date
	updatedAt: Date
}

export const noteVisibility = {
	private: 'private',
	public: 'public',
	protected: 'protected',
} as const
export type NoteVisibility = (typeof noteVisibility)[keyof typeof noteVisibility]
export const noteVisibilityValues = Object.values(noteVisibility) as [
	NoteVisibility,
	...NoteVisibility[],
]

export const noteStatus = {
	normal: 'normal',
	later: 'later',
	pinned: 'pinned',
	archived: 'archived',
} as const
export type NoteStatus = (typeof noteStatus)[keyof typeof noteStatus]
export const noteStatusValues = Object.values(noteStatus) as [NoteStatus, ...NoteStatus[]]

export const noteFeed = {
	unassigned: 'unassigned',
	later: 'later',
	archived: 'archived',
	explore: 'explore',
} as const
export type NoteFeed = (typeof noteFeed)[keyof typeof noteFeed]

export const createNoteBodySchema = z.object({
	id: z.string().trim().min(1).max(64).optional(),
	content: z.string().trim().min(1),
	spaceId: z
		.string()
		.trim()
		.min(1)
		.nullish()
		.transform((value) => value ?? null),
	tagNames: z.array(z.string().trim().min(1)).optional(),
	visibility: z.enum(noteVisibility).default(noteVisibility.private),
	status: z.enum(noteStatus).default(noteStatus.normal),
})

export type CreateNoteInput = z.input<typeof createNoteBodySchema>
export type CreateNoteBody = z.output<typeof createNoteBodySchema>

export const updateNoteBodySchema = z
	.object({
		content: z.string().trim().min(1).optional(),
		spaceId: z.union([z.string().trim().min(1), z.null()]).optional(),
		tagNames: z.array(z.string().trim().min(1)).optional(),
		visibility: z.enum(noteVisibility).optional(),
		status: z.enum(noteStatus).optional(),
		updatedAt: z.number().int().positive().optional(),
	})
	.refine(
		(body) =>
			body.content !== undefined ||
			body.spaceId !== undefined ||
			body.tagNames !== undefined ||
			body.status !== undefined ||
			body.visibility !== undefined,
		{
			message: 'Empty update',
		},
	)

export type UpdateNoteBody = z.output<typeof updateNoteBodySchema>

const noteCursorSchema = z
	.string()
	.regex(/^\d+:[^:]+:[01]$/)
	.transform((value) => {
		const [createdAt, id, pinned] = value.split(':')
		return {
			createdAt: new Date(Number(createdAt)),
			id: id as string,
			pinned: pinned === '1',
		}
	})
	.refine((cursor) => !Number.isNaN(cursor.createdAt.getTime()))

export const listNotesQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	cursor: noteCursorSchema.optional(),
	status: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.enum(noteStatus)).optional(),
	),
	notStatus: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.enum(noteStatus)).optional(),
	),
	noSpace: z.coerce.boolean().optional(),
	noTags: z.coerce.boolean().optional(),
	explore: z.coerce.boolean().optional(),
	spaceId: z.string().trim().min(1).optional(),
	spaceIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	notSpaceIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	viewIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	notViewIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	username: z.string().trim().min(1).optional(),
	tagIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	notTagIds: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.string().trim().min(1)).optional(),
	),
	visibility: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.enum(noteVisibility)).optional(),
	),
	notVisibility: z.preprocess(
		(value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
		z.array(z.enum(noteVisibility)).optional(),
	),
	q: z.string().trim().min(1).optional(),
})

export type ListNotesQuery = z.output<typeof listNotesQuerySchema>

export type NoteListItem = Note & {
	spaceName: string | null
	authorName: string | null
	authorImage: string | null
	tagIds: string[]
}

export type NoteWithTags = Note & { tagIds: string[] }

export type ListNotesResponse = { items: NoteListItem[]; nextCursor: string | null; total: number }
