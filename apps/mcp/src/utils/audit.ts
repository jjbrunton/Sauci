export interface AuditLogEntry {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  admin_user_id?: string;
}

/**
 * Standalone admin API mutations are authorized and audited atomically by the
 * API. This compatibility hook deliberately does not create a duplicate row.
 */
export async function logAudit(_entry: AuditLogEntry): Promise<void> {
  // The called admin API mutation owns the audit transaction.
}
