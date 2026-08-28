import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { adminData } from '../lib/admin-data.js';
import { getAdminApi } from '../lib/admin-api.js';

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
      
      let query = adminData
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
      const { data, error } = await adminData
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
      const { data, error } = await adminData
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
      const { data: profile } = await adminData.from('profiles').select('couple_id').eq('id', user_id).single();
      
      if (!profile?.couple_id) {
        return { content: [{ type: 'text', text: 'User is not in a couple' }] };
      }

      const { data, error } = await adminData
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
      // Files remain private; the admin API issues short-lived signed URLs.
      const { data, error } = await adminData
        .from('media_objects')
        .select('*')
        .eq('owner_id', user_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
        
      if (error) throw new Error(`Failed to get user media: ${error.message}`);
      
      const mediaWithUrls = await Promise.all(data.map(async (media: Record<string, any>) => ({
        ...media,
        ...(await getAdminApi().mediaUrl(media.id)),
      })));

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
      const { data, error } = await adminData
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
    async ({ user_id, days, reason }) => {
      const { expires_at: expiresAt } = await getAdminApi().giftPremium(user_id, days, reason);

      return {
        content: [{ type: 'text', text: `Premium gifted to user ${user_id} until ${expiresAt}` }]
      };
    }
  );
}
