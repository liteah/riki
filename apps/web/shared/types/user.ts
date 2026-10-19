export interface UserProfile {
	id: string
	name: string
	username: string | null
	displayUsername: string | null
	image: string | null
	createdAt: Date
}
