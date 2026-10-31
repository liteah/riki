import type { TVConfig } from '@nuxt/ui'
import type * as ui from '#build/ui'
import { tv } from 'tailwind-variants'

export const tagChip = tv({
	base: 'mention mx-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 align-baseline text-xs font-normal whitespace-nowrap',
	variants: {
		state: {
			active: 'bg-primary/10 text-primary',
			deleted: 'bg-muted text-muted',
		},
	},
	defaultVariants: { state: 'active' },
})

const selectSlots = {
	slots: {
		content: 'min-w-fit',
		trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform',
	},
}

export const uiTheme = {
	formField: {
		slots: {
			root: 'w-full',
		},
	},
	select: selectSlots,
	selectMenu: selectSlots,
	input: {
		slots: {
			root: 'w-full',
		},
	},
	inputMenu: {
		slots: {
			root: 'w-full',
			content: 'min-w-fit',
		},
	},
	textarea: {
		slots: {
			root: 'w-full',
			base: 'resize-none',
		},
	},
	accordion: {
		slots: {
			trigger: 'cursor-pointer',
			item: 'md:py-2',
		},
	},
	tabs: {
		compoundVariants: [
			{
				color: 'neutral',
				variant: 'pill',
				class: {
					indicator: 'bg-default',
					trigger: [
						'data-[state=active]:text-default outline-default/25 focus-visible:outline-3',
						'in-[[data-slot=list]:not(:has([data-slot=indicator]))]:data-[state=active]:before:bg-default',
					],
				},
			},
		],
	},
	sidebar: {
		slots: {
			root: '[--sidebar-width-icon:3rem]',
			container: 'border-0',
			inner: 'divide-y-0',
			body: [
				'p-1.5 pt-0.5 pr-0 gap-2',
				'group-data-[state=collapsed]/sidebar:overflow-x-hidden',
				'scrollbar-gutter-stable scrollbar-thumb-transparent hover:scrollbar-thumb-[var(--ui-border)]',
			],
			header: 'px-1.5 pt-1 gap-0.5',
			title: 'text-sm font-normal',
		},
	},
	navigationMenu: {
		slots: {
			link: 'overflow-hidden has-data-[state=open]:before:bg-elevated/50',
			separator: 'px-0 hidden',
			label: 'font-normal text-muted py-1',
		},
		variants: {
			orientation: {
				vertical: {
					link: 'px-2',
				},
			},
		},
	},
	modal: {
		slots: {
			overlay: 'backdrop-blur-xs',
			footer: 'bg-muted dark:bg-muted/20',
		},
		variants: {
			overlay: {
				true: {
					overlay: 'bg-black/10 dark:bg-black/20',
				},
			},
		},
	},
	commandPalette: {
		slots: {
			root: 'divide-none',
			label: 'font-normal text-muted',
			input: '[&>input]:h-10',
		},
	},
	dropdownMenu: {
		slots: {
			label: 'font-normal',
		},
	},
	calendar: {
		variants: {
			color: {
				primary: {
					headCell: 'text-muted',
					cellTrigger: 'outline-primary/25',
				},
			},
		},
	},
	editor: {
		slots: {
			base: [
				'*:mt-0 px-0 sm:px-0',
				'[&_p]:mt-0 [&_p]:mb-1 [&_p]:text-sm/6 [&_p]:text-toned [&_p]:last:mb-0',
				'[&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-medium [&_h1]:last:mb-0',
				'[&_h2]:mt-0 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:last:mb-0',
				'[&_h3]:mt-0 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-medium [&_h3]:last:mb-0',
				'[&_h4]:mt-0 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:last:mb-0',
				'[&_h5]:mt-0 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:last:mb-0',
				'[&_h6]:mt-0 [&_h6]:mb-1 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:last:mb-0',
				'[&_blockquote]:mt-0 [&_blockquote]:mb-1 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:not-italic [&_blockquote]:last:mb-0',
				'[&_pre]:mt-0 [&_pre]:mb-1 [&_pre]:px-2 [&_pre]:py-2 [&_pre]:text-xs/5 [&_pre]:last:mb-0',
				'[&_ul]:mt-0 [&_ul]:mb-1 [&_ul]:ps-4 [&_ul]:text-toned [&_ul]:last:mb-0',
				'[&_ol]:mt-0 [&_ol]:mb-1 [&_ol]:ps-4 [&_ol]:text-toned [&_ol]:last:mb-0',
				'[&_li]:mt-0 [&_li]:mb-0.5 [&_li]:text-sm/6 [&_li]:text-toned [&_li]:last:mb-0',
				'[&_code]:text-xs',
				'[&_table]:mt-0 [&_table]:mb-1 [&_table]:last:mb-0',
				'[&_hr]:mt-0 [&_hr]:mb-1 [&_hr]:last:mb-0',
			],
		},
	},
	prose: {
		p: { base: 'mt-0 mb-1 text-sm/6 text-toned last:mb-0' },
		a: { base: 'text-default border-default/50 outline-default/25 hover:border-default/80' },
		li: { base: 'mt-0 mb-0.5 text-sm/6 text-toned last:mb-0' },
		ul: { base: 'mt-0 mb-1 text-toned  last:mb-0' },
		ol: { base: 'mt-0 mb-1 text-toned last:mb-0' },
		h1: { slots: { base: 'text-xl mt-0 mb-2 font-medium last:mb-0' } },
		h2: { slots: { base: 'text-lg mt-0 mb-1.5 font-medium last:mb-0' } },
		h3: { slots: { base: 'text-base mt-0 mb-1 font-medium last:mb-0' } },
		h4: { slots: { base: 'text-sm mt-0 mb-1 font-medium last:mb-0' } },
		code: { base: 'text-xs' },
		blockquote: { base: 'border-s-2 ps-4 not-italic' },
		pre: { slots: { root: 'mt-0 mb-1 last:mb-0', base: 'text-xs/5' } },
		table: { slots: { root: 'mt-0 mb-1 last:mb-0' } },
		hr: { base: 'mt-0 mb-1 last:mb-0' },
	},
} satisfies TVConfig<typeof ui>
