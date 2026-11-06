import { db } from '#server/utils/db'
import { notes, spaces } from '#server/db/schemas'
import { createNoteBodySchema } from '#shared/types/note'
import { resolveNoteLinkPreviews } from '#server/utils/note-preview'
import { resolveTagIdsForNames, tagIdsForNote, tagLinkInserts } from '#server/utils/note-tags'
import { requireUser } from '#server/utils/session'
import { readBodyZod } from '#server/utils/validation'
import { newId } from '#shared/utils/id'
import { and, eq } from 'drizzle-orm'

defineRouteMeta({
	openAPI: {
		tags: ['Notes'],
		description:
			'Creates a note and resolves link previews from its content. Pass a client-minted id to make retries safe: re-posting the same id that you own returns 200 with the existing note instead of creating a duplicate.',
		requestBody: {
			required: true,
			content: {
				'application/json': {
					schema: { $ref: '#/components/schemas/CreateNoteRequest' },
				},
			},
		},
		responses: {
			200: {
				description: 'A note with the same client-minted id already existed.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/NoteListItem' } } },
			},
			201: {
				description: 'Note created. A Location header points to the new note.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/NoteListItem' } } },
			},
			400: {
				description: 'The body failed validation.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			401: {
				description: 'Sign-in is required.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
			404: {
				description: 'The minted id or space is not visible to you.',
				content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
			},
		},
	},
})

export default defineEventHandler(async (event) => {
	const user = await requireUser(event)
	const body = await readBodyZod(event, createNoteBodySchema)

	if (body.spaceId) {
		const [owned] = await db
			.select({ id: spaces.id })
			.from(spaces)
			.where(and(eq(spaces.id, body.spaceId), eq(spaces.userId, user.id)))
			.limit(1)
		if (!owned) throw createError({ statusCode: 404, statusMessage: 'Space not found' })
	}

	// A client-minted id makes this retryable. Ownership first, so an id belonging
	// to someone else is indistinguishable from one that does not exist.
	if (body.id) {
		const [existing] = await db
			.select()
			.from(notes)
			.where(and(eq(notes.id, body.id), eq(notes.userId, user.id)))
			.limit(1)
		if (existing) return { ...existing, tagIds: await tagIdsForNote(body.id) }
		const [foreign] = await db
			.select({ id: notes.id })
			.from(notes)
			.where(eq(notes.id, body.id))
			.limit(1)
		if (foreign) throw createError({ statusCode: 404, statusMessage: 'Note not found' })
	}

	const noteId = body.id ?? newId()
	const [tagIds, linkPreviews] = await Promise.all([
		resolveTagIdsForNames(user.id, body.tagNames ?? []),
		resolveNoteLinkPreviews(body.content),
	])

	const [noteRows] = await db.batch([
		db
			.insert(notes)
			.values({
				id: noteId,
				content: body.content,
				linkPreviews,
				userId: user.id,
				spaceId: body.spaceId,
				visibility: body.visibility,
				status: body.status,
			})
			.returning(),
		...tagLinkInserts(noteId, tagIds),
	])

	setResponseStatus(event, 201)
	setResponseHeader(event, 'Location', `/api/notes/${noteId}`)
	return { ...noteRows[0], tagIds }
})
