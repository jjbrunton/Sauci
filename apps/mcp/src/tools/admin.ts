import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerAdminTools(server: McpServer) {
  server.tool(
    'list_admins',
    'List all admin users',
    {},
    async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          user:user_id (name, email, avatar_url)
        `);
        
      if (error) throw new Error(`Failed to list admins: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'add_admin',
    'Grant admin access to a user',
    {
      user_id: z.string(),
      role: z.enum(['super_admin', 'pack_creator']).default('pack_creator'),
      permissions: z.array(z.string()).optional()
    },
    async ({ user_id, role, permissions }) => {
      const { data, error } = await supabase
        .from('admin_users')
        .insert({
          user_id,
          role,
          permissions: permissions || []
        })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to add admin: ${error.message}`);

      await logAudit({
        action: 'INSERT',
        table_name: 'admin_users',
        record_id: data.id,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_admin_permissions',
    'Update admin permissions',
    {
      id: z.string(), // admin_users ID, not user_id
      role: z.enum(['super_admin', 'pack_creator']).optional(),
      permissions: z.array(z.string()).optional()
    },
    async ({ id, role, permissions }) => {
      const { data: oldData } = await supabase.from('admin_users').select('*').eq('id', id).single();
      
      const updates: any = {};
      if (role) updates.role = role;
      if (permissions) updates.permissions = permissions;

      const { data, error } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update admin: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'admin_users',
        record_id: id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'remove_admin',
    'Revoke admin access',
    { id: z.string() }, // admin_users ID
    async ({ id }) => {
      const { data: oldData } = await supabase.from('admin_users').select('*').eq('id', id).single();
      
      const { error } = await supabase.from('admin_users').delete().eq('id', id);
      if (error) throw new Error(`Failed to remove admin: ${error.message}`);

      await logAudit({
        action: 'DELETE',
        table_name: 'admin_users',
        record_id: id,
        old_values: oldData
      });

      return {
        content: [{ type: 'text', text: `Admin ${id} removed successfully` }]
      };
    }
  );

  server.tool(
    'list_audit_logs',
    'View audit logs',
    {
      limit: z.number().default(20),
      offset: z.number().default(0),
      table_name: z.string().optional(),
      action: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional()
    },
    async ({ limit, offset, table_name, action }) => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });
        
      if (table_name) query = query.eq('table_name', table_name);
      if (action) query = query.eq('action', action);
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) throw new Error(`Failed to list audit logs: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count }, null, 2) }]
      };
    }
  );
}
