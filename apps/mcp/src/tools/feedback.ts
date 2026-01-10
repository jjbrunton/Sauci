import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerFeedbackTools(server: McpServer) {
  server.tool(
    'list_feedback',
    'List feedback with filters',
    {
      type: z.enum(['bug', 'feature_request', 'general', 'question']).optional(),
      status: z.enum(['new', 'reviewed', 'in_progress', 'resolved', 'closed']).optional(),
      limit: z.number().default(20),
      offset: z.number().default(0)
    },
    async ({ type, status, limit, offset }) => {
      let query = supabase
        .from('feedback')
        .select(`
          *,
          user:user_id (name, email)
        `, { count: 'exact' });
        
      if (type) query = query.eq('type', type);
      if (status) query = query.eq('status', status);
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) throw new Error(`Failed to list feedback: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count }, null, 2) }]
      };
    }
  );

  server.tool(
    'get_feedback_detail',
    'Get full feedback details',
    { id: z.string() },
    async ({ id }) => {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          user:user_id (name, email),
          question:question_id (text)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw new Error(`Failed to get feedback detail: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_feedback_status',
    'Update feedback status',
    {
      id: z.string(),
      status: z.enum(['new', 'reviewed', 'in_progress', 'resolved', 'closed'])
    },
    async ({ id, status }) => {
      const { data: oldData } = await supabase.from('feedback').select('*').eq('id', id).single();
      
      const { data, error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update status: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'feedback',
        record_id: id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Feedback ${id} status updated to ${status}` }]
      };
    }
  );

  server.tool(
    'add_feedback_notes',
    'Add admin notes to feedback',
    { id: z.string(), notes: z.string() },
    async ({ id, notes }) => {
      const { data: oldData } = await supabase.from('feedback').select('*').eq('id', id).single();
      
      const { data, error } = await supabase
        .from('feedback')
        .update({ admin_notes: notes })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update notes: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'feedback',
        record_id: id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Notes added to feedback ${id}` }]
      };
    }
  );
}
