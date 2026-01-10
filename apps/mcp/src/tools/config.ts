import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerConfigTools(server: McpServer) {
  server.tool(
    'get_ai_config',
    'Get AI configuration',
    {},
    async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .single();
        
      if (error) throw new Error(`Failed to get AI config: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_ai_config',
    'Update AI configuration',
    {
      openrouter_api_key: z.string().optional(),
      default_model: z.string().optional(),
      classifier_enabled: z.boolean().optional(),
      classifier_model: z.string().optional(),
      classifier_prompt: z.string().optional(),
      council_enabled: z.boolean().optional()
    },
    async (updates) => {
      // Get current ID (singleton table usually has 1 row, but need ID for update)
      const { data: current, error: fetchError } = await supabase
        .from('ai_config')
        .select('*')
        .single();
        
      if (fetchError) throw new Error(`Failed to fetch current config: ${fetchError.message}`);

      const { data, error } = await supabase
        .from('ai_config')
        .update(updates)
        .eq('id', current.id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update AI config: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'ai_config',
        record_id: current.id,
        old_values: current,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_app_config',
    'Get app configuration',
    {},
    async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .single();
        
      if (error) throw new Error(`Failed to get app config: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_app_config',
    'Update app configuration',
    {
      answer_gap_threshold: z.number().optional(),
      daily_response_limit: z.number().optional()
    },
    async (updates) => {
      const { data: current, error: fetchError } = await supabase
        .from('app_config')
        .select('*')
        .single();
        
      if (fetchError) throw new Error(`Failed to fetch current config: ${fetchError.message}`);

      const { data, error } = await supabase
        .from('app_config')
        .update(updates)
        .eq('id', current.id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update app config: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'app_config',
        record_id: current.id,
        old_values: current,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );
}
