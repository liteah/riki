import { AwsClient } from 'aws4fetch'
import { nanoid } from 'nanoid'

export interface ImageStorageConfig {
	endpoint: string
	region: string
	bucket: string
	accessKeyId: string
	secretAccessKey: string
	publicUrl: string
}

function prefixFor(filename: string | undefined) {
	const base = filename?.replace(/\.[^.]+$/, '').trim()
	const safe = base
		?.replace(/[\p{Cc}\\/:*?"<>|]/gu, '-')
		.replace(/\s+/g, '-')
		.replace(/^\.+|-+$/g, '')
		.slice(0, 80)
	return safe || 'image'
}

function extensionFor(filename: string | undefined, contentType: string) {
	const extension = filename?.match(/\.([a-z0-9]{1,10})$/i)?.[1]
	if (extension) return `.${extension.toLowerCase()}`
	const subtype = contentType
		.split('/')[1]
		?.replace(/[^a-z0-9]/gi, '')
		.slice(0, 10)
	return subtype ? `.${subtype.toLowerCase()}` : ''
}

export async function createImageUpload(
	config: ImageStorageConfig,
	userId: string,
	contentType: string,
	filename?: string,
) {
	const client = new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		service: 's3',
		region: config.region || 'auto',
	})
	const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '')
	const key = `users/${safeUserId}/images/${prefixFor(filename)}-${nanoid()}${extensionFor(filename, contentType)}`
	const encodedKey = key.split('/').map(encodeURIComponent).join('/')
	const endpoint = config.endpoint.replace(/\/+$/, '')
	const publicUrl = config.publicUrl.replace(/\/+$/, '')
	const request = new Request(
		`${endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}?X-Amz-Expires=3600`,
		{
			method: 'PUT',
			headers: { 'Content-Type': contentType },
		},
	)
	const signed = await client.sign(request, { aws: { signQuery: true, allHeaders: true } })
	return { uploadUrl: signed.url.toString(), url: `${publicUrl}/${encodedKey}` }
}
