import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerCodeTools(server: McpServer) {
  server.tool(
    'list_redemption_codes',
    'List redemption codes',
    {
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional()
    },
    async ({ page, limit, search }) => {
      const offset = (page - 1) * limit;
      
      let query = supabase
        .from('redemption_codes')
        .select('*', { count: 'exact' });
        
      if (search) {
        query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(`Failed to list codes: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count }, null, 2) }]
      };
    }
  );

  server.tool(
    'generate_code',
    'Create a new redemption code',
    {
      code: z.string().optional(), // If not provided, should generate one
      description: z.string().optional(),
      max_uses: z.number().default(1),
      expires_at: z.string().optional(), // ISO date string
      is_active: z.boolean().default(true)
    },
    async ({ code, description, max_uses, expires_at, is_active }) => {
      const finalCode = code || Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data, error } = await supabase
        .from('redemption_codes')
        .insert({
          code: finalCode,
          description,
          max_uses,
          expires_at,
          is_active,
          current_uses: 0
        })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to create code: ${error.message}`);

      await logAudit({
        action: 'INSERT',
        table_name: 'redemption_codes',
        record_id: data.id,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'toggle_code_active',
    'Enable or disable a redemption code',
    { id: z.string(), is_active: z.boolean() },
    async ({ id, is_active }) => {
      const { data: oldData } = await supabase.from('redemption_codes').select('*').eq('id', id).single();
      
      const { data, error } = await supabase
        .from('redemption_codes')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update code: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'redemption_codes',
        record_id: id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Code ${data.code} is now ${is_active ? 'active' : 'inactive'}` }]
      };
    }
  );

  server.tool(
    'delete_code',
    'Delete a redemption code',
    { id: z.string() },
    async ({ id }) => {
      const { data: oldData } = await supabase.from('redemption_codes').select('*').eq('id', id).single();
      
      const { error } = await supabase.from('redemption_codes').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete code: ${error.message}`);

      await logAudit({
        action: 'DELETE',
        table_name: 'redemption_codes',
        record_id: id,
        old_values: oldData
      });

      return {
        content: [{ type: 'text', text: `Code ${id} deleted successfully` }]
      };
    }
  );

  server.tool(
    'list_code_redemptions',
    'See who redeemed a code',
    { code_id: z.string() },
    async ({ code_id }) => {
      const { data, error } = await supabase
        .from('code_redemptions')
        .select(`
          *,
          user:user_id (name, email)
        `)
        .eq('code_id', code_id)
        .order('redeemed_at', { ascending: false });
        
      if (error) throw new Error(`Failed to list redemptions: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );
}
