export type AdminRole = 'pack_creator' | 'super_admin';

export interface AdminPrincipal {
  adminId: string;
  userId: string;
  role: AdminRole;
  permissions: string[];
}

export type AdminFilterOperator = 'eq' | 'neq' | 'in' | 'is' | 'gte' | 'lte' | 'ilike';
export interface AdminFilter { column: string; op: AdminFilterOperator; value?: unknown }
export interface AdminQuery {
  columns?: string[];
  filters?: AdminFilter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export class AdminError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: 400 | 403 | 404 | 409) {
    super(message);
  }
}
