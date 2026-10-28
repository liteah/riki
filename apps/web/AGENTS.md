# apps/web - AGENTS.md

## Documentation

When a task touches a library below, consult its official documentation at the point of change instead of relying on memory.

## Tech stack

- [Nuxt 4](https://nuxt.com)
- [Nuxt UI 4](https://ui.nuxt.com/docs/components)
- [better-auth](https://better-auth.com)
- [Drizzle (Cloudflare D1)](https://orm.drizzle.team/docs)
- [Tiptap](https://tiptap.dev/docs)
- [Comark](https://comark.dev/)
- [@nuxtjs/i18n (vue-i18n)](https://i18n.nuxtjs.org/docs/guide)
- [Tauri shell](https://tauri.app/)

## UI

- Icons only via `appConfig.ui.icons` (`app/theme/icons.ts`). Never hardcode icon strings in components.
- Never use the native `title` attribute in place of a tooltip. Remove `title` from links; use `UTooltip`.
- Variant classes are computed with `tv` from `tailwind-variants`; never assemble variant class strings in a computed ref.
- Use Tailwind `aspect-*` utilities for aspect ratios; never set `aspectRatio` inline.
- Modals only via `useOverlay` (`overlay.create(LazyXxxModal)` + `.open(props)`); dialog components expose a `close` emit. Never mount modal tags statically.
- Should follow optimistic UI principles.

## Client state and sync

- `$fetch` deliberately does **not** forward cookies during SSR (SSRF / auth-misuse protection). Any store action hitting an auth-gated endpoint with plain `$fetch` must therefore stay client-only: wrapping it in `callOnce` or `onServerPrefetch` turns a 401 into a broken page for signed-out visitors. SSR such an action only behind `useRequestFetch()`, and only after weighing the extra D1 reads on every render.
- A preload (`load`, `pull`, background sync) swallows its failure and leaves `loaded` false so it retries; it must never reject into a render or a page setup. A user-initiated action throws so the caller can toast.
- Shared domain state lives in a Pinia store; a component that renders it must go through the store instance (`store.foo` / `storeToRefs`), never by destructuring state. Destructuring a store yields an unwrapped snapshot and loses reactivity.
- A store whose state comes from browser storage must wrap it in `skipHydrate`, or Pinia hydrates the SSR default over the stored copy on every page load.
- Writes are optimistic: apply the intended state immediately, enqueue the intent, then reconcile with the server. Roll back and rethrow on failure so the caller owns the toast.
- Offline intents queue durably and retry with exponential backoff plus jitter. Surface a "not synced" indicator only when a write has genuinely not landed (queued while offline, or failed) - never on mere queue presence, which flashes on every successful online write.
- Conflicts resolve last-write-wins on `updatedAt`, enforced on both ends: the server ignores a write older than the stored row and answers with the winning row, and the client adopts that answer. Deletion is `status: 'archived'`; there is no tombstone column.
- The timeline lists `status` `normal` **and** `pinned`; a `status` filter narrows to the selected statuses, including `archived`. A `status: 'pinned'` note is hidden from nothing. Order is pinned first, then the active sort (createdAt/id descending by default), on both ends - the note cursor carries both the sort and the position - and the client filter drops `archived` rows unless the status filter asks for them, just as the query does.
- Filtering runs twice on purpose: a client computed applies the whole active filter (spaces, views, `noSpace`, tags, visibility, status) to loaded rows for instant offline feedback, and the server does the real query. List rows carry `tagIds`, so the client narrowing matches the server's. Selected views OR together, each view's own conditions stay AND, and nested views resolve to depth 3 on both ends. Every filter property supports `is` / `is not`; negative space and tag filters also match notes with no space or no such tag. Other people's rows never reach the persisted cache - they arrive only through the `visibility` filter and live in a memory-only list - so a fetched feed cannot resurface once the filter or identity changes.
- A note list is a function of the viewer, the active filter, and the active sort, so a cursor is valid for one `(identity, filter, sort)` triple only. Reset the cursor whenever any of them changes. On an identity change, also clear the memory-only foreign list and purge foreign rows from the persisted one; a blank `userId` is an offline create and survives.
- Library and Inbox are code constants, not `views` rows: always at the head of the pinned section, never renamed, reordered, unpinned or deleted. `sidebarKind` covers only what a `sidebar` row can point at, and the API rejects anything else.
- The sidebar target is URL state: `/` carries mutually exclusive `space`/`tag`/`view` scope params and `/inbox` is its own path; any other query param is a filter param and must survive a target change.
- `sidebar` rows are the pinned section, and `position` is a dense `0..n-1` sequence shared by views, spaces and tags. Reorder and unpin both renumber through `server/utils/sidebar.ts`; a bare delete leaves a hole and corrupts the ordering.
- The server must clamp a client `updatedAt` to server time. A user can set their device clock years ahead, which would otherwise pin a note in the future and make every later last-write-wins comparison lose.
- No polling. A retry only earns its keep once something has actually failed, so the queue is driven by user writes and by the browser's `online` event. A write that fails while online keeps its badge until the next write, the next reconnect, or a click on the badge.
- `navigator.onLine` is not a reachability probe: it stays `true` through DNS failure, an unreachable server, and captive portals. Never gate a not-synced indicator on it alone - badge a write that has actually failed to send.
- Anything keyed by user id must stay writable while the session cannot be fetched. Offline, `/api/auth/get-session` fails, so cache the last resolved id; gating a local write on a live session drops it silently.
- Deletion is `status: 'archived'`; there is no tombstone column.
- Drafts are per user and per note, written on a debounce, restored on reopen, and discarded on save. A discard must also cancel any debounced write still in flight, or unmounting resurrects the saved note as a stale draft.
- Polling pulls ask for deltas (`?since=`) and only advance the sync point past a response they know is complete.

## Cloudflare

- D1 hard limits: **50 queries per Worker invocation** and **100 bound parameters per query** on the free plan (1,000 queries on paid). Free tier also caps 5M rows read and 100k rows written per day, and since 2026-09-01 exceeding the daily limits makes queries fail outright.
- Never loop a per-row query helper inside a request handler; one request handles one resource. D1 allows 100 bound parameters per query and 50 queries per Worker invocation on the free plan.
- One `db.batch([...])` per atomic multi-statement write. Helpers that loop internally break this.
- Free tier also caps 5M rows read and 100k rows written per day, and since 2026-09-01 exceeding the daily limits makes queries fail outright. Read costs count, so do not poll a full page on a timer.

## Reuse

- Before writing a helper, check whether the shape already exists. Identical logic in two places is a defect, not a coincidence.
- `useToast`, `useOverlay` and `$fetch` are the primitives. Do not wrap a framework primitive in a single-purpose helper - a `notifyFailure` that can only report failures is a narrowing, not a reusable abstraction, and it cannot be called from a store because it needs `useI18n`. Call the primitive directly.
- Extract to `shared/utils/` only when both client and server need it; `app/utils/` is client-only, `server/utils/` is server-only.

## Performance

- Merging a fetched page into a reactive list is O(n) in the size of both, not O(n·m): build a `Map` by id once instead of scanning per row.
- Replace a reactive collection in one assignment after mutating a copy, rather than pushing row by row.
- Do not re-fetch a full page on a timer; every read costs against D1's daily budget.

## i18n

- Every user-facing string goes in `i18n/locales/*.json`.
- Scope search placeholders to the domain they filter; do not add a generic `common` search placeholder.
- Define state and action labels separately.
- Use one term per concept.
- Remove scope-local keys whose meaning is already covered elsewhere. If a scope has a `new` label, do not also add a `create` label for the same action; collapse fully duplicated labels into one shared key and keep redundancy to a minimum.

## Server and shared

- `shared/` holds pure zod schemas and types only - no drizzle runtime imports. Enums are const objects plus `keyof typeof`; drizzle enum columns consume pre-exported Values tuples.
- Every handler starts with `const user = await requireUser(event)` (`server/utils/session.ts` → 401). Scope all queries by `userId`; missing and not-owned both return 404 so existence never leaks.
- `GET /api/notes` is the one anonymous-tolerant handler, because the home timeline doubles as the public feed for signed-out visitors. It resolves the viewer with `getSessionUser` (null, not 401): signed-in users get only their own notes, unless a `visibility` filter widens the set to other people's non-private notes; signed-out visitors only public ones. Null a foreign note's `spaceName` - a space is a private taxonomy - and never serve an archived note.
- Validate with `readBodyZod` / `readQueryZod` (`server/utils/validation.ts`, explicit 400). Resolve tag names with `resolveTagIdsForNames` (`server/utils/note-tags.ts`). No silent failures, no inline glue duplication.
- No `db.transaction` on libsql - one `db.batch([...])` per atomic multi-statement write. Order statements defensively (e.g. delete links before notes) instead of relying on FK pragmas.
- REST: POST returns 201 + `Location` + row; PATCH returns the updated row; DELETE returns `{ id }`. A deleted note is archived via `PATCH { status: 'archived' }`; `DELETE` stays a hard delete.
- Every endpoint must fit that contract. An endpoint that exists only to serve one client's internal transport is not an API - build that client on the documented routes instead. `POST /api/notes` accepts an optional client-minted `id`, which is what makes a create retryable, and `PATCH /api/notes/:id` takes an optional `updatedAt` for last-write-wins.

## Link previews

- Link URLs stay in the note content; preview metadata is a cache, never a second source of truth. Re-derive links from stored content on every write and never trust a client-supplied preview URL.
- Preserve the raw `og:type` namespace (`music.album`, `video.movie`) and derive the base presentation type separately. Do not add an exhaustive subtype map.
- A link opts into a bottom card with the Comark `preview` attribute: `[label](url){preview}`; `{preview=false}` opts out of the automatic single-link card. Without it, cards appear only for a note with exactly one link and no title; multiple links require explicit `preview`.
- A carded link is not also rendered as a link at its original position; labeled links keep plain text, bare URLs disappear.
- Display modes are `never`, `landscape`, and `portrait`. `landscape` always wins; `portrait` applies only when there is exactly one card, and multiple cards stay landscape.
- Portrait cards use an `aspect-video` cover only when OGP reports wide, high-resolution dimensions; otherwise they fall back to a landscape card. Use `og:image:alt` when present.
- Known providers use their brand icon instead of a favicon; other sites use the favicon or a small image, then the presentation-type icon.
- Hover previews are opt-out in settings; blocked and private hosts never show hover or card previews.

## Editor vs renderer

- Tiptap `UEditor` (single modal instance) is the only writer; Comark `<Markdown>` is the reader for lists. Never mount editors in lists - ProseMirror instances are heavy, static VNodes are cheap and SSR-friendly.
- Stored note content is strict MDC. All editor/storage translation lives in `app/utils/tiptap-tag.ts` and nowhere else. Prefer one-time data migrations over permanent runtime compat shims.
- Never hand-write MDC parsing. Register or use a Comark MDC plugin/component instead.
