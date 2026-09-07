// D:\dev\loyo-os\apps\api\src\routes\notifications.ts
// LOYO OS // Scheduler notifications endpoint (Fastify)

import { FastifyInstance } from 'fastify'
import { getNotifications, markNotificationRead, markAllRead } from '../services/scheduler'

export default async function notificationsRoutes(app: FastifyInstance)
{
  // GET /api/notifications?unread=true
  app.get('/notifications', async (req) =>
  {
    const { unread } = req.query as { unread?: string }
    return { notifications: getNotifications(unread === 'true') }
  })

  // POST /api/notifications/:id/read
  app.post('/notifications/:id/read', async (req) =>
  {
    const { id } = req.params as { id: string }
    markNotificationRead(id)
    return { ok: true }
  })

  // POST /api/notifications/read-all
  app.post('/notifications/read-all', async () =>
  {
    markAllRead()
    return { ok: true }
  })
}
