import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export type DareStatus =
  | 'pending' | 'active' | 'submitted' | 'completed' | 'expired' | 'declined' | 'cancelled';

/** Free senders get a rolling weekly allowance; receiving and responding are never gated. */
export const FREE_WEEKLY_SEND_LIMIT = 3;

/** Durations offered in the send sheet. `null` means no deadline. */
export const DURATION_PRESET_HOURS = [1, 6, 12, 24, 72, 168] as const;

export interface DarePack {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_premium: boolean;
  is_explicit: boolean;
  sort_order: number;
  category_id: string | null;
  min_intensity: number | null;
  max_intensity: number | null;
  avg_intensity: number | null;
  dare_count: number;
}

export interface DareItem {
  id: string;
  pack_id: string;
  text: string;
  intensity: number;
  suggested_duration_hours: number | null;
}

export interface SentDare {
  id: string;
  couple_id: string;
  dare_id: string | null;
  text: string;
  intensity: number;
  is_custom: boolean;
  sender_id: string;
  recipient_id: string;
  direction: 'incoming' | 'outgoing';
  status: DareStatus;
  sender_notes: string | null;
  sent_at: string;
  accepted_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

export interface DareEntitlement {
  is_premium: boolean;
  can_send_custom: boolean;
  weekly_send_limit: number | null;
  sends_remaining: number | null;
}

export interface DareCatalog {
  entitlement: DareEntitlement;
  packs: DarePack[];
}

export interface DareStats {
  sent: number;
  received: number;
  completed_together: number;
  active: number;
  completed_by_me: number;
  completed_by_partner: number;
}

export interface SendDareInput {
  dare_id?: string | null;
  custom_dare_text?: string | null;
  custom_dare_intensity?: number | null;
  duration_hours?: number | null;
  sender_notes?: string | null;
}

export class DaresError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 402 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

interface ContextRow extends QueryResultRow {
  couple_id: string | null;
  is_premium: boolean;
  hide_nsfw: boolean;
  max_intensity: number;
  partner_id: string | null;
  partner_premium: boolean;
}

interface SentDareRecord extends QueryResultRow {
  id: string;
  couple_id: string;
  dare_id: string | null;
  dare_text_snapshot: string;
  dare_intensity_snapshot: number;
  custom_dare_text: string | null;
  sender_id: string;
  recipient_id: string;
  status: DareStatus;
  sender_notes: string | null;
  sent_at: Date;
  accepted_at: Date | null;
  submitted_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
}

export interface DaresRepository {
  getCatalog(userId: string): Promise<DareCatalog>;
  listPackDares(userId: string, packId: string): Promise<DareItem[]>;
  listDares(userId: string, filter: 'active' | 'history'): Promise<SentDare[]>;
  send(userId: string, input: SendDareInput): Promise<SentDare>;
  respond(userId: string, dareId: string, action: 'accept' | 'decline'): Promise<SentDare>;
  submit(userId: string, dareId: string): Promise<SentDare>;
  complete(userId: string, dareId: string): Promise<SentDare>;
  cancel(userId: string, dareId: string): Promise<SentDare>;
  stats(userId: string): Promise<DareStats>;
  close(): Promise<void>;
}

const BARE_COLUMNS = `id, couple_id, dare_id, dare_text_snapshot, dare_intensity_snapshot,
  custom_dare_text, sender_id, recipient_id, status, sender_notes,
  sent_at, accepted_at, submitted_at, completed_at, expires_at`;

const SENT_COLUMNS = BARE_COLUMNS.split(',').map((column) => `sd.${column.trim()}`).join(', ');

/** Statuses still awaiting somebody's action; everything else is history. */
const OPEN_STATUSES: readonly DareStatus[] = ['pending', 'active', 'submitted'];

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function toSentDare(row: SentDareRecord, viewerId: string): SentDare {
  return {
    id: row.id,
    couple_id: row.couple_id,
    dare_id: row.dare_id,
    text: row.dare_text_snapshot,
    intensity: row.dare_intensity_snapshot,
    is_custom: row.custom_dare_text !== null,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    direction: row.recipient_id === viewerId ? 'incoming' : 'outgoing',
    status: row.status,
    sender_notes: row.sender_notes,
    sent_at: row.sent_at.toISOString(),
    accepted_at: iso(row.accepted_at),
    submitted_at: iso(row.submitted_at),
    completed_at: iso(row.completed_at),
    expires_at: iso(row.expires_at),
  };
}

export class PostgresDaresRepository implements DaresRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  /**
   * Premium is couple-shared, matching the answers domain: either partner paying
   * unlocks the catalogue for both.
   */
  private async context(userId: string): Promise<ContextRow> {
    const result = await this.pool.query<ContextRow>(
      `select p.couple_id, p.is_premium, p.hide_nsfw, p.max_intensity,
              partner.id as partner_id,
              coalesce(partner.is_premium, false) as partner_premium
         from profiles p
         left join lateral (
           select id, is_premium from profiles other
            where other.couple_id = p.couple_id and other.id <> p.id
            order by other.id limit 1
         ) partner on true
        where p.id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw new DaresError('profile_not_found', 'Profile not found', 404);
    return row;
  }

  private static isPremium(context: ContextRow): boolean {
    return context.is_premium || context.partner_premium;
  }

  private async sendsThisWeek(userId: string, client: Pool | PoolClient = this.pool): Promise<number> {
    const result = await client.query<{ count: string }>(
      `select count(*) as count from sent_dares
        where sender_id = $1 and sent_at > now() - interval '7 days'`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async entitlement(context: ContextRow, userId: string): Promise<DareEntitlement> {
    const premium = PostgresDaresRepository.isPremium(context);
    if (premium) {
      return { is_premium: true, can_send_custom: true, weekly_send_limit: null, sends_remaining: null };
    }
    const used = await this.sendsThisWeek(userId);
    return {
      is_premium: false,
      can_send_custom: false,
      weekly_send_limit: FREE_WEEKLY_SEND_LIMIT,
      sends_remaining: Math.max(0, FREE_WEEKLY_SEND_LIMIT - used),
    };
  }

  async getCatalog(userId: string): Promise<DareCatalog> {
    const context = await this.context(userId);
    const maxIntensity = context.hide_nsfw ? 2 : context.max_intensity;
    const [entitlement, packs] = await Promise.all([
      this.entitlement(context, userId),
      this.pool.query<DarePack & QueryResultRow>(
        `select dp.id, dp.name, dp.description, dp.icon, dp.is_premium, dp.is_explicit,
                dp.sort_order, dp.category_id, dp.min_intensity, dp.max_intensity,
                dp.avg_intensity::double precision as avg_intensity,
                count(d.id) filter (where d.content_status = 'allowed')::integer as dare_count
           from dare_packs dp
           left join categories c on c.id = dp.category_id
           left join dares d on d.pack_id = dp.id
          where dp.is_public = true
            and dp.content_status = 'allowed'
            and (dp.category_id is null or c.is_public = true)
            and ($1::boolean = false or dp.is_explicit = false)
            and (dp.min_intensity is null or dp.min_intensity <= $2::integer)
          group by dp.id
         having count(d.id) filter (where d.content_status = 'allowed') > 0
          order by dp.sort_order, dp.name, dp.id`,
        [context.hide_nsfw, maxIntensity],
      ),
    ]);
    return { entitlement, packs: packs.rows };
  }

  async listPackDares(userId: string, packId: string): Promise<DareItem[]> {
    const context = await this.context(userId);
    const pack = await this.pool.query<{ is_premium: boolean; is_explicit: boolean }>(
      `select dp.is_premium, dp.is_explicit
         from dare_packs dp
         left join categories c on c.id = dp.category_id
        where dp.id = $1 and dp.is_public = true and dp.content_status = 'allowed'
          and (dp.category_id is null or c.is_public = true)`,
      [packId],
    );
    const row = pack.rows[0];
    if (!row) throw new DaresError('pack_not_found', 'Dare pack not found', 404);
    if (row.is_explicit && context.hide_nsfw) {
      throw new DaresError('pack_not_found', 'Dare pack not found', 404);
    }
    if (row.is_premium && !PostgresDaresRepository.isPremium(context)) {
      throw new DaresError('premium_required', 'This dare pack requires premium', 402);
    }
    const maxIntensity = context.hide_nsfw ? 2 : context.max_intensity;
    const result = await this.pool.query<DareItem & QueryResultRow>(
      `select d.id, d.pack_id, d.text, d.intensity, d.suggested_duration_hours
         from dares d
        where d.pack_id = $1 and d.content_status = 'allowed' and d.intensity <= $2::integer
        order by d.intensity, d.created_at, d.id`,
      [packId, maxIntensity],
    );
    return result.rows;
  }

  async listDares(userId: string, filter: 'active' | 'history'): Promise<SentDare[]> {
    const context = await this.context(userId);
    if (!context.couple_id) return [];
    const result = await this.pool.query<SentDareRecord>(
      `select ${SENT_COLUMNS}
         from sent_dares sd
        where sd.couple_id = $1
          and (sd.status = any($2::text[])) = $3::boolean
        order by sd.sent_at desc, sd.id desc
        limit 200`,
      [context.couple_id, OPEN_STATUSES, filter === 'active'],
    );
    return result.rows.map((row) => toSentDare(row, userId));
  }

  async send(userId: string, input: SendDareInput): Promise<SentDare> {
    const context = await this.context(userId);
    if (!context.couple_id || !context.partner_id) {
      throw new DaresError('no_couple', 'Pair with your partner before sending dares', 409);
    }
    const premium = PostgresDaresRepository.isPremium(context);

    const duration = input.duration_hours ?? null;
    if (duration !== null && !DURATION_PRESET_HOURS.includes(duration as never)) {
      throw new DaresError('invalid_duration', 'Duration must be one of the offered presets', 400);
    }

    let text: string;
    let intensity: number;
    let dareId: string | null = null;
    let customText: string | null = null;
    let customIntensity: number | null = null;

    if (input.dare_id) {
      // Re-check entitlement against the pack so a stale client cannot send a locked dare.
      const dare = await this.pool.query<{ text: string; intensity: number; is_premium: boolean; is_explicit: boolean }>(
        `select d.text, d.intensity, dp.is_premium, dp.is_explicit
           from dares d
           join dare_packs dp on dp.id = d.pack_id
           left join categories c on c.id = dp.category_id
          where d.id = $1 and d.content_status = 'allowed' and dp.content_status = 'allowed'
            and dp.is_public = true and (dp.category_id is null or c.is_public = true)`,
        [input.dare_id],
      );
      const row = dare.rows[0];
      if (!row) throw new DaresError('dare_not_found', 'Dare not found', 404);
      if (row.is_explicit && context.hide_nsfw) {
        throw new DaresError('dare_not_found', 'Dare not found', 404);
      }
      if (row.is_premium && !premium) {
        throw new DaresError('premium_required', 'This dare requires premium', 402);
      }
      dareId = input.dare_id;
      text = row.text;
      intensity = row.intensity;
    } else {
      if (!premium) throw new DaresError('premium_required', 'Custom dares require premium', 402);
      const trimmed = input.custom_dare_text?.trim();
      if (!trimmed) throw new DaresError('invalid_dare', 'Custom dare text is required', 400);
      customText = trimmed;
      customIntensity = input.custom_dare_intensity ?? 1;
      text = trimmed;
      intensity = customIntensity;
    }

    // The quota is a paywall boundary, so the count and the insert have to be atomic:
    // locking the sender's profile row serializes concurrent sends by the same user.
    return transaction(this.pool, async (client) => {
      if (!premium) {
        await client.query('select 1 from profiles where id = $1 for update', [userId]);
        const used = await this.sendsThisWeek(userId, client);
        if (used >= FREE_WEEKLY_SEND_LIMIT) {
          throw new DaresError('send_limit_reached', 'Weekly dare limit reached', 402);
        }
      }

      const result = await client.query<SentDareRecord>(
        `insert into sent_dares (
           couple_id, dare_id, custom_dare_text, custom_dare_intensity,
           dare_text_snapshot, dare_intensity_snapshot,
           sender_id, recipient_id, sender_notes, expires_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           case when $10::integer is null then null else now() + ($10::integer * interval '1 hour') end
         )
         returning ${BARE_COLUMNS}`,
        [
          context.couple_id, dareId, customText, customIntensity, text, intensity,
          userId, context.partner_id, input.sender_notes?.trim() || null, duration,
        ],
      );
      return toSentDare(result.rows[0]!, userId);
    });
  }

  /**
   * Applies a status change, enforcing both the actor's role and the legal
   * transitions out of the current status. Notifications are emitted by the
   * `operations_dare_changed` trigger, so no enqueue happens here.
   */
  private async transition(
    userId: string,
    dareId: string,
    actor: 'sender' | 'recipient',
    from: readonly DareStatus[],
    to: DareStatus,
    timestampColumn: 'accepted_at' | 'submitted_at' | 'completed_at' | null,
  ): Promise<SentDare> {
    const actorColumn = actor === 'sender' ? 'sender_id' : 'recipient_id';
    const setTimestamp = timestampColumn ? `, ${timestampColumn} = now()` : '';
    const result = await this.pool.query<SentDareRecord>(
      `update sent_dares sd
          set status = $3::text${setTimestamp}
        where sd.id = $1 and sd.${actorColumn} = $2 and sd.status = any($4::text[])
        returning ${SENT_COLUMNS}`,
      [dareId, userId, to, from],
    );
    const row = result.rows[0];
    if (row) return toSentDare(row, userId);

    // Distinguish "not yours / gone" from "wrong state" so the client can react.
    const existing = await this.pool.query<{ sender_id: string; recipient_id: string; status: DareStatus }>(
      'select sender_id, recipient_id, status from sent_dares where id = $1',
      [dareId],
    );
    const found = existing.rows[0];
    if (!found || (found.sender_id !== userId && found.recipient_id !== userId)) {
      throw new DaresError('dare_not_found', 'Dare not found', 404);
    }
    const actorId = actor === 'sender' ? found.sender_id : found.recipient_id;
    if (actorId !== userId) {
      throw new DaresError('not_permitted', `Only the ${actor} can do that`, 403);
    }
    throw new DaresError('invalid_transition', `A ${found.status} dare cannot change to ${to}`, 409);
  }

  async respond(userId: string, dareId: string, action: 'accept' | 'decline'): Promise<SentDare> {
    return action === 'accept'
      ? this.transition(userId, dareId, 'recipient', ['pending'], 'active', 'accepted_at')
      : this.transition(userId, dareId, 'recipient', ['pending'], 'declined', null);
  }

  async submit(userId: string, dareId: string): Promise<SentDare> {
    return this.transition(userId, dareId, 'recipient', ['active'], 'submitted', 'submitted_at');
  }

  async complete(userId: string, dareId: string): Promise<SentDare> {
    return this.transition(userId, dareId, 'sender', ['active', 'submitted'], 'completed', 'completed_at');
  }

  async cancel(userId: string, dareId: string): Promise<SentDare> {
    return this.transition(userId, dareId, 'sender', ['pending', 'active', 'submitted'], 'cancelled', null);
  }

  async stats(userId: string): Promise<DareStats> {
    const context = await this.context(userId);
    if (!context.couple_id) {
      return { sent: 0, received: 0, completed_together: 0, active: 0, completed_by_me: 0, completed_by_partner: 0 };
    }
    const result = await this.pool.query<Record<string, string>>(
      `select
         count(*) filter (where sender_id = $2)::text as sent,
         count(*) filter (where recipient_id = $2)::text as received,
         count(*) filter (where status = 'completed')::text as completed_together,
         count(*) filter (where status = any($3::text[]))::text as active,
         count(*) filter (where status = 'completed' and recipient_id = $2)::text as completed_by_me,
         count(*) filter (where status = 'completed' and sender_id = $2)::text as completed_by_partner
       from sent_dares where couple_id = $1`,
      [context.couple_id, userId, OPEN_STATUSES],
    );
    const row = result.rows[0] ?? {};
    const read = (key: string): number => Number(row[key] ?? 0);
    return {
      sent: read('sent'),
      received: read('received'),
      completed_together: read('completed_together'),
      active: read('active'),
      completed_by_me: read('completed_by_me'),
      completed_by_partner: read('completed_by_partner'),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
