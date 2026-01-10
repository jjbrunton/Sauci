import { supabase } from '../lib/supabase.js';

export interface AuditLogEntry {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  admin_user_id?: string;
}

let cachedSystemAdminId: string | null = null;

async function getSystemAdminId(): Promise<string | null> {
  if (cachedSystemAdminId) return cachedSystemAdminId;

  // Try to find a super_admin user
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();

  if (data?.user_id) {
    cachedSystemAdminId = data.user_id;
    return data.user_id;
  }

  // Fallback: any admin user
  const { data: anyAdmin } = await supabase
    .from('admin_users')
    .select('user_id')
    .limit(1)
    .maybeSingle();
    
  if (anyAdmin?.user_id) {
    cachedSystemAdminId = anyAdmin.user_id;
    return anyAdmin.user_id;
  }

  return null;
}

/**
 * Log an admin action to the audit_logs table
 */
export async function logAudit(entry: AuditLogEntry) {
  try {
    let adminUserId = entry.admin_user_id;
    
    if (!adminUserId) {
      adminUserId = await getSystemAdminId() || undefined;
    }

    if (!adminUserId) {
      console.warn('Cannot log audit entry: No admin user found to attribute action to');
      return;
    }

    // Ensure values are plain objects, not Supabase response objects
    const cleanOldValues = entry.old_values ? JSON.parse(JSON.stringify(entry.old_values)) : null;
    const cleanNewValues = entry.new_values ? JSON.parse(JSON.stringify(entry.new_values)) : null;

    const { error } = await supabase.from('audit_logs').insert({
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id || '00000000-0000-0000-0000-000000000000', // Fallback UUID if needed
      old_values: cleanOldValues,
      new_values: cleanNewValues,
      admin_role: 'super_admin', // MCP acts as super admin
      admin_user_id: adminUserId
    });

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Error in logAudit:', err);
  }
}
