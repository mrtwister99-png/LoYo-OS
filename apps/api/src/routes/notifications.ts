// D:\dev\loyo-os\apps\api\src\routes\notifications.ts
// LOYO OS // Scheduler notifications endpoint (Fastify)

import { FastifyInstance } from 'fastify'
import { getNotifications, markNotificationRead, markAllRead, pushNotification } from '../services/scheduler'

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

  // POST /api/notifications { type: new|urgent|approval, command, message } — pro Strážce a skripty mimo API
  app.post('/notifications', async (req, reply) =>
  {
    const { type, command, message } = (req.body as { type?: string; command?: string; message?: string }) || {}
    if (!message || !['new', 'urgent', 'approval'].includes(String(type))) { reply.code(400); return { error: 'type (new|urgent|approval) a message jsou povinné' } }
    pushNotification(type as any, command || 'system', message)
    return { ok: true }
  })

  // POST /api/notifications/read-all
  app.post('/notifications/read-all', async () =>
  {
    markAllRead()
    return { ok: true }
  })
}
