import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerContentTools(server: McpServer) {
  // --- Categories ---

  server.tool(
    'list_categories',
    'List all categories with pack counts',
    {},
    async () => {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          question_packs (count)
        `)
        .order('sort_order');
      
      if (error) throw new Error(`Failed to list categories: ${error.message}`);
      
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'create_category',
    'Create a new category',
    {
      name: z.string(),
      description: z.string().optional(),
      icon: z.string(),
      sort_order: z.number().optional(),
      is_public: z.boolean().default(false)
    },
    async ({ name, description, icon, sort_order, is_public }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, description, icon, sort_order: sort_order ?? 0, is_public })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to create category: ${error.message}`);

      await logAudit({
        action: 'INSERT',
        table_name: 'categories',
        record_id: data.id,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_category',
    'Update a category',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      sort_order: z.number().optional(),
      is_public: z.boolean().optional()
    },
    async ({ id, ...updates }) => {
      // Get old values for audit
      const { data: oldData } = await supabase.from('categories').select('*').eq('id', id).single();
      if (!oldData) throw new Error(`Category not found: ${id}`);

      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update category: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'categories',
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
    'delete_category',
    'Delete a category',
    { id: z.string() },
    async ({ id }) => {
      const { data: oldData } = await supabase.from('categories').select('*').eq('id', id).single();
      if (!oldData) throw new Error(`Category not found: ${id}`);

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
        
      if (error) throw new Error(`Failed to delete category: ${error.message}`);

      await logAudit({
        action: 'DELETE',
        table_name: 'categories',
        record_id: id,
        old_values: oldData
      });

      return {
        content: [{ type: 'text', text: `Category ${id} deleted successfully` }]
      };
    }
  );

  // --- Packs ---

  server.tool(
    'list_packs',
    'List packs for a category or all packs',
    { category_id: z.string().optional() },
    async ({ category_id }) => {
      let query = supabase
        .from('question_packs')
        .select(`
          *,
          questions (count)
        `)
        .order('sort_order');
        
      if (category_id) {
        query = query.eq('category_id', category_id);
      }
      
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list packs: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'create_pack',
    'Create a new question pack',
    {
      name: z.string(),
      category_id: z.string(),
      description: z.string().optional(),
      is_premium: z.boolean().default(false),
      is_public: z.boolean().default(false),
      is_explicit: z.boolean().default(false),
      sort_order: z.number().optional()
    },
    async (input) => {
      const { data, error } = await supabase
        .from('question_packs')
        .insert({ ...input, sort_order: input.sort_order ?? 0 })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to create pack: ${error.message}`);

      await logAudit({
        action: 'INSERT',
        table_name: 'question_packs',
        record_id: data.id,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_pack',
    'Update a question pack',
    {
      id: z.string(),
      name: z.string().optional(),
      category_id: z.string().optional(),
      description: z.string().optional(),
      is_premium: z.boolean().optional(),
      is_public: z.boolean().optional(),
      is_explicit: z.boolean().optional(),
      sort_order: z.number().optional()
    },
    async ({ id, ...updates }) => {
      const { data: oldData } = await supabase.from('question_packs').select('*').eq('id', id).single();
      if (!oldData) throw new Error(`Pack not found: ${id}`);

      const { data, error } = await supabase
        .from('question_packs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update pack: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'question_packs',
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
    'delete_pack',
    'Delete a question pack',
    { id: z.string() },
    async ({ id }) => {
      const { data: oldData } = await supabase.from('question_packs').select('*').eq('id', id).single();
      if (!oldData) throw new Error(`Pack not found: ${id}`);

      const { error } = await supabase.from('question_packs').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete pack: ${error.message}`);

      await logAudit({
        action: 'DELETE',
        table_name: 'question_packs',
        record_id: id,
        old_values: oldData
      });

      return {
        content: [{ type: 'text', text: `Pack ${id} deleted successfully` }]
      };
    }
  );

  // --- Questions ---

  server.tool(
    'list_questions',
    'List questions for a pack',
    { pack_id: z.string() },
    async ({ pack_id }) => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('pack_id', pack_id)
        .order('created_at'); // Questions don't strictly have a sort_order usually
        
      if (error) throw new Error(`Failed to list questions: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'create_question',
    'Create a single question',
    {
      pack_id: z.string(),
      text: z.string(),
      partner_text: z.string().optional(),
      intensity: z.number().min(1).max(5).default(1)
    },
    async (input) => {
      const { data, error } = await supabase
        .from('questions')
        .insert(input)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to create question: ${error.message}`);

      await logAudit({
        action: 'INSERT',
        table_name: 'questions',
        record_id: data.id,
        new_values: data
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'update_question',
    'Update a question',
    {
      id: z.string(),
      text: z.string().optional(),
      partner_text: z.string().optional(),
      intensity: z.number().min(1).max(5).optional(),
      pack_id: z.string().optional()
    },
    async ({ id, ...updates }) => {
      const { data: oldData } = await supabase.from('questions').select('*').eq('id', id).single();
      if (!oldData) throw new Error(`Question not found: ${id}`);

      const { data, error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new Error(`Failed to update question: ${error.message}`);

      await logAudit({
        action: 'UPDATE',
        table_name: 'questions',
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
    'delete_questions',
    'Delete one or more questions',
    { ids: z.array(z.string()) },
    async ({ ids }) => {
      const { data: oldData } = await supabase.from('questions').select('*').in('id', ids);
      
      const { error } = await supabase.from('questions').delete().in('id', ids);
      if (error) throw new Error(`Failed to delete questions: ${error.message}`);

      // Log audit for each deleted question
      if (oldData) {
        for (const record of oldData) {
          await logAudit({
            action: 'DELETE',
            table_name: 'questions',
            record_id: record.id,
            old_values: record
          });
        }
      }

      return {
        content: [{ type: 'text', text: `${ids.length} questions deleted successfully` }]
      };
    }
  );
}
