import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logAudit } from '../utils/audit.js';

export function registerUserTools(server: McpServer) {
  server.tool(
    'list_users',
    'List users with pagination and search',
    {
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional()
    },
    async ({ page, limit, search }) => {
      const offset = (page - 1) * limit;
      
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });
        
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(`Failed to list users: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify({ data, count, page, limit }, null, 2) }]
      };
    }
  );

  server.tool(
    'get_user_detail',
    'Get full user profile details',
    { user_id: z.string() },
    async ({ user_id }) => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          couple:couple_id (*)
        `)
        .eq('id', user_id)
        .single();
        
      if (error) throw new Error(`Failed to get user details: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_user_responses',
    'Get user question responses',
    { user_id: z.string(), limit: z.number().default(50) },
    async ({ user_id, limit }) => {
      const { data, error } = await supabase
        .from('responses')
        .select(`
          *,
          question:question_id (text, intensity)
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) throw new Error(`Failed to get responses: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_user_matches',
    'Get user matches',
    { user_id: z.string() },
    async ({ user_id }) => {
      // First get couple_id
      const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user_id).single();
      
      if (!profile?.couple_id) {
        return { content: [{ type: 'text', text: 'User is not in a couple' }] };
      }

      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          question:question_id (text)
        `)
        .eq('couple_id', profile.couple_id)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(`Failed to get matches: ${error.message}`);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_user_media',
    'List user uploaded media',
    { user_id: z.string() },
    async ({ user_id }) => {
      // This is tricky as media is in storage, but usually referenced in messages
      // We'll search messages table for media_path where user_id matches
      const { data, error } = await supabase
        .from('messages')
        .select('id, media_path, created_at, match_id')
        .eq('user_id', user_id)
        .not('media_path', 'is', null)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(`Failed to get user media: ${error.message}`);
      
      // Generate public URLs for media
      const mediaWithUrls = data.map(m => {
        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(m.media_path);
          
        return {
          ...m,
          url: urlData.publicUrl
        };
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(mediaWithUrls, null, 2) }]
      };
    }
  );

  server.tool(
    'get_match_chat',
    'View chat messages for a match',
    { match_id: z.string(), limit: z.number().default(50) },
    async ({ match_id, limit }) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match_id)
        .order('created_at', { ascending: false }) // Newest first
        .limit(limit);
        
      if (error) throw new Error(`Failed to get chat: ${error.message}`);

      // Reverse to show chronological order in output if desired, but JSON is fine
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'gift_premium',
    'Give user premium access',
    {
      user_id: z.string(),
      days: z.number().default(30),
      reason: z.string().optional() // For audit log
    },
    async ({ user_id, days }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      
      const { data: oldData } = await supabase.from('profiles').select('is_premium').eq('id', user_id).single();
      
      // We update profiles table directly or insert into subscriptions?
      // Research said `profiles.is_premium` is the flag, but also mentioned `subscriptions` table.
      // Usually `subscriptions` drives `is_premium` via webhooks, but for gifting we might just set the flag 
      // OR insert a manual subscription.
      // The admin dashboard uses `auditedSupabase.insert('subscriptions', {...})`.
      
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id,
          product_id: 'admin_gift',
          status: 'active',
          expires_at: expiresAt.toISOString(),
          is_sandbox: false
        })
        .select()
        .single();
        
      if (error) throw new Error(`Failed to gift premium: ${error.message}`);

      // Also ensure profile is updated (if not handled by triggers)
      await supabase.from('profiles').update({ is_premium: true }).eq('id', user_id);

      await logAudit({
        action: 'INSERT',
        table_name: 'subscriptions',
        record_id: data.id,
        new_values: data,
        old_values: { reason: 'Premium Gift', old_is_premium: oldData?.is_premium }
      });

      return {
        content: [{ type: 'text', text: `Premium gifted to user ${user_id} until ${expiresAt.toISOString()}` }]
      };
    }
  );
}
