import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerModerationTools(server: McpServer) {
  server.tool(
    'list_flagged_messages',
    'List messages flagged by AI for review',
    {
      limit: z.number().default(20),
      offset: z.number().default(0)
    },
    async ({ limit, offset }) => {
      const { data, error, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('moderation_status', 'flagged')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) throw new Error(`Failed to list flagged messages: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count }, null, 2) }]
      };
    }
  );

  server.tool(
    'list_message_reports',
    'List user-submitted reports',
    {
      status: z.enum(['pending', 'reviewed', 'dismissed']).default('pending'),
      limit: z.number().default(20),
      offset: z.number().default(0)
    },
    async ({ status, limit, offset }) => {
      const { data, error, count } = await supabase
        .from('message_reports')
        .select(`
          *,
          message:message_id (*),
          reporter:reporter_id (name, email)
        `, { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) throw new Error(`Failed to list reports: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count }, null, 2) }]
      };
    }
  );

  server.tool(
    'mark_message_safe',
    'Mark a flagged message as safe',
    { message_id: z.string() },
    async ({ message_id }) => {
      const { data: oldData } = await supabase.from('messages').select('*').eq('id', message_id).single();
      
      const { data, error } = await supabase
        .from('messages')
        .update({ moderation_status: 'safe' })
        .eq('id', message_id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update message: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'messages',
        record_id: message_id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Message ${message_id} marked as safe` }]
      };
    }
  );

  server.tool(
    'dismiss_report',
    'Dismiss a user report',
    { report_id: z.string() },
    async ({ report_id }) => {
      const { data: oldData } = await supabase.from('message_reports').select('*').eq('id', report_id).single();

      const { data, error } = await supabase
        .from('message_reports')
        .update({ status: 'dismissed', reviewed_at: new Date().toISOString() })
        .eq('id', report_id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to dismiss report: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'message_reports',
        record_id: report_id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Report ${report_id} dismissed` }]
      };
    }
  );

  server.tool(
    'mark_report_reviewed',
    'Mark a report as reviewed (action taken)',
    { report_id: z.string() },
    async ({ report_id }) => {
      const { data: oldData } = await supabase.from('message_reports').select('*').eq('id', report_id).single();

      const { data, error } = await supabase
        .from('message_reports')
        .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
        .eq('id', report_id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update report: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'message_reports',
        record_id: report_id,
        old_values: oldData,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: `Report ${report_id} marked as reviewed` }]
      };
    }
  );
}
