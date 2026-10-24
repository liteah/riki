import * as z from 'zod'

export const entityIconKeys = [
	'space',
	'view',
	'home',
	'briefcase',
	'book',
	'heart',
	'star',
	'coffee',
	'food',
	'music',
	'headphones',
	'camera',
	'game',
	'lightbulb',
	'rocket',
	'leaf',
	'tree',
	'bird',
	'fish',
	'paw',
	'bike',
	'car',
	'boat',
	'plane',
	'train',
	'school',
	'bank',
	'wallet',
	'shopping',
	'wrench',
	'code',
	'globe',
	'shield',
	'trophy',
	'chat',
	'calendar',
	'clock',
	'target',
	'compass',
	'mountains',
	'fire',
	'cloud',
	'map',
	'gift',
	'key',
	'lock',
	'palette',
] as const

export type EntityIcon = (typeof entityIconKeys)[number]

export const entityIconValues = entityIconKeys as unknown as [EntityIcon, ...EntityIcon[]]

export const entityIconSchema = z.enum(entityIconValues)

export const defaultSpaceIcon = 'space' satisfies EntityIcon
export const defaultViewIcon = 'view' satisfies EntityIcon
