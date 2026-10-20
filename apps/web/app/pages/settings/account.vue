<script setup lang="ts">
definePageMeta({ title: 'settings.account.label' })

const session = useAuth().useSession()
const user = computed(() => session.value.data?.user ?? null)
</script>

<template>
	<SettingsItemGroup v-if="user">
		<ProfileCard :user="user" />
	</SettingsItemGroup>
</template>
