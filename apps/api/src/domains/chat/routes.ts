import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { ChatError, type ChatRepository } from './repository.js';

type AuthenticatedApp = Hono<{ Variables: { identity: AuthIdentity } }>;
const id = z.string().uuid();
const sendBody = z.object({ content: z.string().trim().min(1).max(10_000) }).strict();
const reportBody = z.object({ reason: z.enum(['harassment', 'spam', 'inappropriate_content', 'other']) }).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function result<T>(operation: () => Promise<T>) {
  try {
    return { ok: true as const, value: await operation() };
  } catch (cause) {
    if (cause instanceof ChatError) return { ok: false as const, cause };
    throw cause;
  }
}

export function registerChatRoutes(app: AuthenticatedApp, repository: ChatRepository): void {
  app.get('/v1/chat/unread', async (c) => c.json(await repository.unreadCounts(c.get('identity').id)));

  app.get('/v1/matches/:matchId/messages', async (c) => {
    const parsedId = id.safeParse(c.req.param('matchId'));
    if (!parsedId.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    const response = await result(() => repository.listMessages(c.get('identity').id, parsedId.data));
    return response.ok ? c.json({ messages: response.value }) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/matches/:matchId/messages', async (c) => {
    const parsedId = id.safeParse(c.req.param('matchId'));
    const parsedBody = sendBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsedId.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    if (!parsedBody.success) return c.json(error('invalid_message', 'Message content is required'), 400);
    const response = await result(() => repository.sendText(c.get('identity').id, parsedId.data, parsedBody.data.content));
    return response.ok ? c.json({ message: response.value }, 201) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/matches/:matchId/read', async (c) => {
    const parsedId = id.safeParse(c.req.param('matchId'));
    if (!parsedId.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    const response = await result(() => repository.markMatchRead(c.get('identity').id, parsedId.data));
    return response.ok ? c.json(response.value) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.put('/v1/matches/:matchId/typing', async (c) => {
    const parsedId = id.safeParse(c.req.param('matchId'));
    if (!parsedId.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    const response = await result(() => repository.setTyping(c.get('identity').id, parsedId.data, 4_000));
    return response.ok ? c.json({ typing: true }) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.get('/v1/matches/:matchId/typing', async (c) => {
    const parsedId = id.safeParse(c.req.param('matchId'));
    if (!parsedId.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    const response = await result(() => repository.getPartnerTyping(c.get('identity').id, parsedId.data));
    return response.ok ? c.json(response.value) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/messages/:messageId/delivered', async (c) => {
    const parsedId = id.safeParse(c.req.param('messageId'));
    if (!parsedId.success) return c.json(error('invalid_message_id', 'A valid message ID is required'), 400);
    const response = await result(() => repository.markDelivered(c.get('identity').id, parsedId.data));
    return response.ok ? c.json({ message: response.value }) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.delete('/v1/messages/:messageId', async (c) => {
    const parsedId = id.safeParse(c.req.param('messageId'));
    const scope = c.req.query('scope');
    if (!parsedId.success) return c.json(error('invalid_message_id', 'A valid message ID is required'), 400);
    if (scope !== 'self' && scope !== 'everyone') return c.json(error('invalid_delete_scope', 'Delete scope must be self or everyone'), 400);
    if (scope === 'self') {
      const response = await result(() => repository.deleteForSelf(c.get('identity').id, parsedId.data));
      return response.ok ? c.json({ deleted: true }) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
    }
    const response = await result(() => repository.deleteForEveryone(c.get('identity').id, parsedId.data));
    return response.ok ? c.json({ deleted: true, message: response.value }) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/messages/:messageId/reports', async (c) => {
    const parsedId = id.safeParse(c.req.param('messageId'));
    const parsedBody = reportBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsedId.success) return c.json(error('invalid_message_id', 'A valid message ID is required'), 400);
    if (!parsedBody.success) return c.json(error('invalid_report_reason', 'A valid report reason is required'), 400);
    const response = await result(() => repository.report(c.get('identity').id, parsedId.data, parsedBody.data.reason));
    return response.ok ? c.json({ reported: true }, 201) : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });
}
