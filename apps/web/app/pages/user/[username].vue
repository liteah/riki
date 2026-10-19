<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'
import { noteVisibility } from '#shared/types/note'
import type { ListNotesResponse, NoteListItem } from '#shared/types/note'
import type { UserProfile } from '#shared/types/user'

const route = useRoute()
const appConfig = useAppConfig()
const { t, locale } = useI18n()
const session = useAuth().useSession()

const sidebarOpen = ref(true)

const scrollArea = useTemplateRef<{ $el: HTMLElement }>('scrollArea')

const username = computed(() => String(route.params.username ?? '').toLowerCase())

const profile = ref<UserProfile | null>(null)
const notFound = ref(false)
const notes = ref<NoteListItem[]>([])
const nextCursor = ref<string | null>(null)
const pending = ref(false)
const done = ref(false)
const openNotes = ref<string>()

const signedIn = computed(() => Boolean(session.value.data?.user))
const sessionReady = computed(() => !session.value.isPending)

const publicNotesItems = computed<AccordionItem[]>(() => [
	{ label: t('profile.publicNotes'), value: 'notes', icon: appConfig.ui.icons.globe },
])

const handle = computed(
	() => profile.value?.displayUsername ?? profile.value?.username ?? username.value,
)

const joinedAt = computed(() => {
	if (!profile.value) return ''
	return new Intl.DateTimeFormat(resolveLocale(locale.value), { dateStyle: 'long' }).format(
		new Date(profile.value.createdAt),
	)
})

async function loadNotes() {
	if (!sessionReady.value || pending.value || done.value) return
	if (signedIn.value && !openNotes.value) return
	pending.value = true
	const data = await $fetch<ListNotesResponse>('/api/notes', {
		query: {
			username: username.value,
			visibility: noteVisibility.public,
			...(nextCursor.value ? { cursor: nextCursor.value } : {}),
		},
	}).catch(() => null)
	if (data) {
		const known = new Set(notes.value.map((note) => note.id))
		notes.value = [...notes.value, ...data.items.filter((note) => !known.has(note.id))]
		nextCursor.value = data.nextCursor
		done.value = data.nextCursor === null
	}
	pending.value = false
}

async function load() {
	profile.value = null
	notFound.value = false
	notes.value = []
	nextCursor.value = null
	done.value = false
	scrollArea.value?.$el?.scrollTo({ top: 0 })
	profile.value = await $fetch<UserProfile>(
		`/api/users/${encodeURIComponent(username.value)}`,
	).catch(() => null)
	if (!profile.value) {
		notFound.value = true
		return
	}
	await loadNotes()
}

watch(username, () => void load())

watch(openNotes, (open) => {
	if (open && !notes.value.length) void loadNotes()
})

watch(
	[sessionReady, signedIn],
	() => {
		if (sessionReady.value && !signedIn.value) void loadNotes()
	},
	{ immediate: true },
)

onMounted(() => {
	void load()
	useInfiniteScroll(
		() => scrollArea.value?.$el,
		() => void loadNotes(),
		{ distance: 200 },
	)
})
</script>

<template>
	<NoteSidebar v-model:open="sidebarOpen" />
	<div class="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden">
		<div
			class="relative flex min-h-(--ui-header-height) w-full max-w-2xl items-center justify-center px-2"
		>
			<UButton
				class="absolute top-1/2 left-2 -translate-y-1/2 lg:hidden"
				:icon="appConfig.ui.icons.menu"
				color="neutral"
				variant="ghost"
				:aria-label="$t('header.openSidebar')"
				@click="sidebarOpen = !sidebarOpen"
			/>
			<span class="truncate text-sm font-medium">{{ $t('profile.label') }}</span>
		</div>
		<UScrollArea v-if="profile" ref="scrollArea" shadow class="size-full p-2">
			<div class="mx-auto flex w-full max-w-2xl flex-col gap-2">
				<section class="flex flex-col gap-3 px-2 pt-2 pb-4">
					<UUser
						:avatar="{ src: profile.image ?? undefined, alt: profile.name }"
						:name="profile.name"
						:description="`@${handle}`"
						size="3xl"
						:ui="{ name: 'truncate text-xl font-bold' }"
					/>
					<p class="flex items-center gap-1.5 text-sm text-muted">
						<UIcon :name="appConfig.ui.icons.calendar" class="size-4 shrink-0" />
						{{ $t('profile.joinedAt', { date: joinedAt }) }}
					</p>
				</section>
				<template v-if="sessionReady">
					<UAccordion
						v-if="signedIn"
						v-model="openNotes"
						:items="publicNotesItems"
						type="single"
						:ui="{ trigger: 'px-2' }"
					>
						<template #content>
							<div class="flex flex-col gap-2">
								<NoteListItem
									v-for="note in notes"
									:key="note.id"
									:note="note"
									@select="openComposer"
								/>
								<UEmpty
									v-if="done && !notes.length"
									variant="naked"
									:icon="appConfig.ui.icons.globe"
									:title="$t('profile.emptyTitle')"
									class="p-6"
								/>
							</div>
						</template>
					</UAccordion>
					<template v-else>
						<NoteListItem
							v-for="note in notes"
							:key="note.id"
							:note="note"
							@select="openComposer"
						/>
						<UEmpty
							v-if="done && !notes.length"
							variant="naked"
							:icon="appConfig.ui.icons.globe"
							:title="$t('profile.emptyTitle')"
							class="p-6"
						/>
					</template>
				</template>
			</div>
		</UScrollArea>
		<UEmpty
			v-else-if="notFound"
			variant="naked"
			:icon="appConfig.ui.icons.user"
			:title="$t('profile.notFoundTitle')"
			:description="$t('profile.notFoundDescription')"
			class="flex min-h-0 flex-1 items-center justify-center p-6"
		/>
		<div v-else class="flex min-h-0 flex-1 items-center justify-center">
			<UIcon :name="appConfig.ui.icons.loading" class="size-6 animate-spin text-muted" />
		</div>
	</div>
	<ChatSidebar />
</template>
