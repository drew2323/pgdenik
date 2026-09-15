import config from '@payload-config'
import { getPayload } from 'payload'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload.count({ collection: 'users' })

    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'unhealthy' }, { status: 503 })
  }
}
