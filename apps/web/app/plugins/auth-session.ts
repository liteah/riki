import type { AuthSession } from '~/composables/use-auth'

export default defineNuxtPlugin(async () => {
	const session = useState<AuthSession | null>('auth-session', () => null)

	if (import.meta.server) {
		session.value = await useRequestFetch()<AuthSession | null>('/api/auth/get-session').catch(
			() => null,
		)
		return
	}

	useAuth().hydrateSession(session.value)
})
