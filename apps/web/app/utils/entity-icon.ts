import type { EntityIcon } from '#shared/types/icon'

type IconRegistry = Record<string, string | undefined>

export function resolveEntityIcon(
	icons: IconRegistry,
	icon: EntityIcon | null | undefined,
	fallback: EntityIcon,
) {
	return (icon && icons[icon]) || icons[fallback]
}
