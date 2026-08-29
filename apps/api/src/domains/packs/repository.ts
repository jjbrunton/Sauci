import { Pool } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';

export interface PackCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  is_public: boolean;
}

export interface PublicQuestionPack {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_premium: boolean;
  is_public: boolean;
  is_explicit: boolean;
  min_intensity: number | null;
  max_intensity: number | null;
  avg_intensity: number | null;
  sort_order: number;
  category_id: string | null;
  category: PackCategory | null;
  questions: Array<{ count: number }>;
  created_at: string;
}

export interface PacksCatalogResponse {
  categories: PackCategory[];
  packs: PublicQuestionPack[];
}

export interface EnabledPacksResponse {
  enabledPackIds: string[];
}

export interface PackProgressItem {
  packId: string;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface PackProgressResponse {
  progress: PackProgressItem[];
}

export class PacksDomainError extends Error {
  constructor(readonly code: 'no_couple' | 'pack_not_found') {
    super(code);
  }
}

export interface PacksRepository {
  getCatalog(userId: string, showAllIntensities: boolean): Promise<PacksCatalogResponse>;
  getEnabledPacks(userId: string): Promise<EnabledPacksResponse>;
  setPackEnabled(userId: string, packId: string, enabled: boolean): Promise<EnabledPacksResponse>;
  getPackProgress(userId: string): Promise<PackProgressResponse>;
  close(): Promise<void>;
}

interface ProfilePreferencesRow {
  couple_id: string | null;
  hide_nsfw: boolean;
}

export class PostgresPacksRepository implements PacksRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
  }

  private async profile(userId: string): Promise<ProfilePreferencesRow> {
    const result = await this.pool.query<ProfilePreferencesRow>(
      'select couple_id, hide_nsfw from profiles where id = $1 limit 1',
      [userId],
    );
    // An identity that has not completed /v1/me bootstrapping gets the safest content defaults.
    return result.rows[0] ?? { couple_id: null, hide_nsfw: true };
  }

  async getCatalog(userId: string, showAllIntensities: boolean): Promise<PacksCatalogResponse> {
    const profile = await this.profile(userId);
    const maxIntensity = profile.hide_nsfw ? 2 : 5;
    const [categoryResult, packResult] = await Promise.all([
      this.pool.query<PackCategory>(`
        select id, name, description, icon, color, sort_order, created_at, is_public
        from categories
        where is_public = true
        order by sort_order, name, id
      `),
      this.pool.query<PublicQuestionPack>(`
        select
          qp.id, qp.name, qp.description, qp.icon, qp.is_premium, qp.is_public,
          qp.is_explicit, qp.min_intensity, qp.max_intensity,
          qp.avg_intensity::double precision as avg_intensity,
          qp.sort_order, qp.category_id, qp.created_at,
          case when c.id is null then null else json_build_object(
            'id', c.id, 'name', c.name, 'description', c.description, 'icon', c.icon,
            'color', c.color, 'sort_order', c.sort_order, 'created_at', c.created_at,
            'is_public', c.is_public
          ) end as category,
          json_build_array(json_build_object('count', count(q.id)::integer)) as questions
        from question_packs qp
        left join categories c on c.id = qp.category_id
        left join questions q on q.pack_id = qp.id
        where qp.is_public = true
          and (qp.category_id is null or c.is_public = true)
          and ($1::boolean = false or qp.is_explicit = false)
          and ($2::boolean = true or qp.max_intensity is null or qp.max_intensity <= $3::integer)
        group by qp.id, c.id
        order by qp.sort_order, qp.name, qp.id
      `, [profile.hide_nsfw, showAllIntensities, maxIntensity]),
    ]);

    return {
      categories: categoryResult.rows.map((category) => ({
        ...category,
        created_at: new Date(category.created_at).toISOString(),
      })),
      packs: packResult.rows.map((pack) => ({
        ...pack,
        created_at: new Date(pack.created_at).toISOString(),
      })),
    };
  }

  async getEnabledPacks(userId: string): Promise<EnabledPacksResponse> {
    const profile = await this.profile(userId);
    if (!profile.couple_id) return { enabledPackIds: [] };
    const result = await this.pool.query<{ pack_id: string }>(`
      select cp.pack_id
      from couple_packs cp
      join question_packs qp on qp.id = cp.pack_id
      left join categories c on c.id = qp.category_id
      where cp.couple_id = $1 and cp.enabled = true and qp.is_public = true
        and (qp.category_id is null or c.is_public = true)
      order by qp.sort_order, cp.pack_id
    `, [profile.couple_id]);
    return { enabledPackIds: result.rows.map((row) => row.pack_id) };
  }

  async setPackEnabled(userId: string, packId: string, enabled: boolean): Promise<EnabledPacksResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await client.query<ProfilePreferencesRow>(
        'select couple_id, hide_nsfw from profiles where id = $1 limit 1 for share',
        [userId],
      );
      const coupleId = profile.rows[0]?.couple_id;
      if (!coupleId) throw new PacksDomainError('no_couple');
      const pack = await client.query(`
        select qp.id
        from question_packs qp
        left join categories c on c.id = qp.category_id
        where qp.id = $1 and qp.is_public = true
          and (qp.category_id is null or c.is_public = true)
        limit 1
      `, [packId]);
      if (pack.rowCount === 0) throw new PacksDomainError('pack_not_found');

      const previous = await client.query<{ enabled: boolean }>(`
        select enabled from couple_packs
        where couple_id = $1 and pack_id = $2
        for update
      `, [coupleId, packId]);
      await client.query(`
        insert into couple_packs (couple_id, pack_id, enabled)
        values ($1, $2, $3)
        on conflict (couple_id, pack_id)
        do update set enabled = excluded.enabled
      `, [coupleId, packId, enabled]);
      if (enabled && previous.rows[0]?.enabled !== true) {
        await client.query('select queue_pack_change($1, $2)', [coupleId, userId]);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    return this.getEnabledPacks(userId);
  }

  async getPackProgress(userId: string): Promise<PackProgressResponse> {
    const result = await this.pool.query<{
      pack_id: string;
      total_questions: number;
      answered_questions: number;
    }>(`
      select qp.id as pack_id,
        count(distinct q.id)::integer as total_questions,
        count(distinct r.question_id)::integer as answered_questions
      from question_packs qp
      left join categories c on c.id = qp.category_id
      left join questions q on q.pack_id = qp.id
      left join responses r on r.question_id = q.id and r.user_id = $1
      where qp.is_public = true and (qp.category_id is null or c.is_public = true)
      group by qp.id
      order by qp.sort_order, qp.id
    `, [userId]);
    return {
      progress: result.rows.map((row) => ({
        packId: row.pack_id,
        totalQuestions: row.total_questions,
        answeredQuestions: row.answered_questions,
      })),
    };
  }

  async close(): Promise<void> {
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}
