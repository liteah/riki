<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { noteStatus, noteStatusValues, noteVisibilityValues } from '#shared/types/note'
import type { NoteStatus, NoteVisibility } from '#shared/types/note'
import type { ViewFilter } from '#shared/types/view'
import { countFilterValues } from '~/utils/note-filter'
import { noteVisibilityMeta } from '~/utils/note-visibility'

type FilterProperty = 'view' | 'space' | 'tag' | 'status' | 'visibility'
type ValueProperty = Exclude<FilterProperty, 'space'>

const properties: FilterProperty[] = ['view', 'space', 'tag', 'status', 'visibility']

const props = defineProps<{
	modelValue: ViewFilter
	embedded?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [value: ViewFilter]
	'create-space': []
	'save-view': []
}>()

const { t } = useI18n()
const appConfig = useAppConfig()
const spaceStore = useSpaceStore()
const tagStore = useTagStore()
const viewStore = useViewStore()

const operators = reactive<Record<FilterProperty, boolean>>({
	view: false,
	space: false,
	tag: false,
	status: false,
	visibility: false,
})

const activeCount = computed(() => countFilterValues(props.modelValue))

const { items: spaceItems } = useNoteSpaceFilterOptions(
	() => selectedValues('space'),
	(id) => toggleValue('space', id),
	() => emit('create-space'),
)

const items = computed<DropdownMenuItem[][]>(() => {
	const actions: DropdownMenuItem[] = []
	if (!props.embedded) {
		actions.push({
			label: t('view.saveFilter'),
			icon: appConfig.ui.icons.file,
			onSelect: () => emit('save-view'),
		})
	}
	actions.push({
		label: t('view.clearFilter'),
		icon: appConfig.ui.icons.close,
		disabled: !activeCount.value,
		onSelect: () => emit('update:modelValue', {}),
	})
	return [properties.map(propertyMenu), actions]
})

watch(
	() => props.modelValue,
	() => {
		for (const property of properties) operators[property] = isNegative(property)
	},
	{ deep: true, immediate: true },
)

function onOpen(open: boolean) {
	if (!open) return
	for (const property of properties) operators[property] = isNegative(property)
	void spaceStore.load()
	void tagStore.load()
	void viewStore.load()
}

function propertyMenu(property: FilterProperty): DropdownMenuItem {
	const values =
		property === 'space'
			? spaceValueItems()
			: valueOptions(property).map((option) => ({
					type: 'checkbox' as const,
					label: option.label,
					icon: option.icon,
					checked: selectedValues(property).includes(option.value),
					onSelect: (event: Event) => {
						event.preventDefault()
						toggleValue(property, option.value)
					},
				}))

	return {
		label: propertyLabel(property),
		icon: propertyIcon(property),
		filter: searchFilter(property),
		children: [
			{ type: 'label', slot: 'operator', property } as DropdownMenuItem,
			{ type: 'separator' },
			...values,
		],
	}
}

function spaceValueItems(): DropdownMenuItem[] {
	const groups = spaceItems.value.filter((group) => group.length)
	return groups.flatMap((group, index) =>
		index ? [{ type: 'separator' as const }, ...group] : group,
	)
}

function valueOptions(property: ValueProperty) {
	switch (property) {
		case 'view':
			return viewStore.views.map((view) => ({
				label: view.name,
				value: view.id,
				icon: appConfig.ui.icons.file,
			}))
		case 'tag':
			return tagStore.tags.map((tag) => ({
				label: tag.name,
				value: tag.id,
				icon: appConfig.ui.icons.hash,
			}))
		case 'status':
			return noteStatusValues.map((value) => ({
				label: statusLabel(value),
				value,
				icon: statusIcon(value),
			}))
		case 'visibility':
			return noteVisibilityValues.map((value) => ({
				label: t(noteVisibilityMeta[value].label),
				value,
				icon: appConfig.ui.icons[noteVisibilityMeta[value].icon],
			}))
	}
}

function selectedValues(property: FilterProperty): string[] {
	const filter = props.modelValue
	switch (property) {
		case 'view':
			return filter.notViewIds?.length ? filter.notViewIds : (filter.viewIds ?? [])
		case 'space':
			return filter.notSpaceIds?.length
				? filter.notSpaceIds
				: (filter.spaceIds ?? (filter.spaceId ? [filter.spaceId] : []))
		case 'tag':
			return filter.notTagIds?.length ? filter.notTagIds : (filter.tagIds ?? [])
		case 'status':
			return filter.notStatus?.length ? filter.notStatus : (filter.status ?? [])
		case 'visibility':
			return filter.notVisibility?.length ? filter.notVisibility : (filter.visibility ?? [])
	}
}

function isNegative(property: FilterProperty) {
	const filter = props.modelValue
	switch (property) {
		case 'view':
			return Boolean(filter.notViewIds?.length)
		case 'space':
			return Boolean(filter.notSpaceIds?.length)
		case 'tag':
			return Boolean(filter.notTagIds?.length)
		case 'status':
			return Boolean(filter.notStatus?.length)
		case 'visibility':
			return Boolean(filter.notVisibility?.length)
	}
}

function setOperator(property: FilterProperty, negative: boolean) {
	if (operators[property] === negative) return
	operators[property] = negative
	const values = selectedValues(property)
	if (values.length) applyValues(property, values, negative)
}

function toggleValue(property: FilterProperty, value: string) {
	const current = selectedValues(property)
	const next = current.includes(value)
		? current.filter((item) => item !== value)
		: [...current, value]
	applyValues(property, next, operators[property])
}

function applyValues(property: FilterProperty, values: string[], negative: boolean) {
	const next = { ...props.modelValue }
	const list = values.length ? values : undefined
	switch (property) {
		case 'view':
			next.viewIds = negative ? undefined : list
			next.notViewIds = negative ? list : undefined
			break
		case 'space':
			next.spaceId = undefined
			next.spaceIds = negative ? undefined : list
			next.notSpaceIds = negative ? list : undefined
			break
		case 'tag':
			next.tagIds = negative ? undefined : list
			next.notTagIds = negative ? list : undefined
			break
		case 'status':
			next.status = negative ? undefined : (list as NoteStatus[] | undefined)
			next.notStatus = negative ? (list as NoteStatus[] | undefined) : undefined
			break
		case 'visibility':
			next.visibility = negative ? undefined : (list as NoteVisibility[] | undefined)
			next.notVisibility = negative ? (list as NoteVisibility[] | undefined) : undefined
			break
	}
	emit('update:modelValue', next)
}

function operatorOptions(property: FilterProperty) {
	const contains = property === 'tag'
	return [
		{ label: t(contains ? 'view.filterContains' : 'view.filterIs'), value: 'is' },
		{ label: t(contains ? 'view.filterNotContains' : 'view.filterIsNot'), value: 'not' },
	]
}

function operatorProperty(item: unknown) {
	return (item as { property?: FilterProperty }).property
}

function operatorOptionsFor(item: unknown) {
	const property = operatorProperty(item)
	return property ? operatorOptions(property) : []
}

function operatorLabel(item: unknown) {
	const property = operatorProperty(item)
	return property ? propertyLabel(property) : ''
}

function operatorValue(item: unknown) {
	const property = operatorProperty(item)
	return property && operators[property] ? 'not' : 'is'
}

function selectOperator(item: unknown, value: unknown) {
	const property = operatorProperty(item)
	if (property) setOperator(property, value === 'not')
}

function searchFilter(property: FilterProperty) {
	switch (property) {
		case 'view':
			return { placeholder: t('view.searchPlaceholder') }
		case 'space':
			return { placeholder: t('space.searchPlaceholder') }
		case 'tag':
			return { placeholder: t('tag.searchPlaceholder') }
		default:
			return undefined
	}
}

function statusLabel(value: NoteStatus) {
	switch (value) {
		case noteStatus.normal:
			return t('note.statusNormal')
		case noteStatus.later:
			return t('note.later')
		case noteStatus.pinned:
			return t('common.pinned')
		case noteStatus.archived:
			return t('note.statusArchived')
	}
}

function statusIcon(value: NoteStatus) {
	switch (value) {
		case noteStatus.normal:
			return appConfig.ui.icons.note
		case noteStatus.later:
			return appConfig.ui.icons.later
		case noteStatus.pinned:
			return appConfig.ui.icons.pin
		case noteStatus.archived:
			return appConfig.ui.icons.archive
	}
}

function propertyLabel(property: FilterProperty) {
	switch (property) {
		case 'view':
			return t('view.label')
		case 'space':
			return t('space.label')
		case 'tag':
			return t('tag.label')
		case 'status':
			return t('view.status')
		case 'visibility':
			return t('note.visibilityLabel')
	}
}

function propertyIcon(property: FilterProperty) {
	switch (property) {
		case 'view':
			return appConfig.ui.icons.file
		case 'space':
			return appConfig.ui.icons.folder
		case 'tag':
			return appConfig.ui.icons.hash
		case 'status':
			return appConfig.ui.icons.filter
		case 'visibility':
			return appConfig.ui.icons.globe
	}
}
</script>

<template>
	<UDropdownMenu :items="items" :content="{ align: 'end' }" @update:open="onOpen">
		<slot :active-count="activeCount">
			<UButton
				:icon="appConfig.ui.icons.filter"
				:color="activeCount ? 'primary' : 'neutral'"
				:variant="activeCount ? 'soft' : 'ghost'"
				size="sm"
				:aria-label="t('view.filter')"
			/>
		</slot>

		<template #operator="{ item }">
			<div class="flex w-full items-center justify-between gap-2">
				<span>{{ operatorLabel(item) }}</span>
				<USelect
					:items="operatorOptionsFor(item)"
					:model-value="operatorValue(item)"
					size="xs"
					color="neutral"
					variant="ghost"
					@update:model-value="selectOperator(item, $event)"
				/>
			</div>
		</template>
	</UDropdownMenu>
</template>
