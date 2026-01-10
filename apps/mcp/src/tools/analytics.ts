import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { supabase } from '../lib/supabase.js';

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_dashboard_stats',
    'Get high-level dashboard statistics',
    {},
    async () => {
      // Parallel fetch for counts
      const [
        { count: categories },
        { count: packs },
        { count: questions },
        { count: profiles },
        { count: couples }
      ] = await Promise.all([
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('question_packs').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('couples').select('*', { count: 'exact', head: true })
      ]);

      return {
        content: [{ type: 'text', text: JSON.stringify({
          counts: {
            categories,
            packs,
            questions,
            profiles,
            couples
          }
        }, null, 2) }]
      };
    }
  );

  server.tool(
    'get_feature_interests',
    'Get feature interest stats',
    {},
    async () => {
      const { data, error } = await supabase.rpc('get_feature_interest_counts');
      
      // Fallback if RPC doesn't exist or fails, query table directly if possible
      if (error) {
        // Try raw query on feature_interests table
        const { data: rawData, error: rawError } = await supabase
          .from('feature_interests')
          .select('feature_name');
          
        if (rawError) throw new Error(`Failed to get feature interests: ${rawError.message}`);
        
        // Manual aggregation
        const counts: Record<string, number> = {};
        rawData.forEach((r: any) => {
          counts[r.feature_name] = (counts[r.feature_name] || 0) + 1;
        });
        
        return {
          content: [{ type: 'text', text: JSON.stringify(counts, null, 2) }]
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  server.tool(
    'get_usage_insights',
    'Get usage insights (join reasons, etc)',
    {},
    async () => {
      // Aggregating onboarding data from profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('usage_reason, gender');
        
      if (error) throw new Error(`Failed to get usage insights: ${error.message}`);
      
      const reasons: Record<string, number> = {};
      const genders: Record<string, number> = {};
      
      data.forEach((p) => {
        if (p.usage_reason) reasons[p.usage_reason] = (reasons[p.usage_reason] || 0) + 1;
        if (p.gender) genders[p.gender] = (genders[p.gender] || 0) + 1;
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ reasons, genders }, null, 2) }]
      };
    }
  );

  server.tool(
    'get_question_analytics',
    'Get question performance stats',
    {},
    async () => {
      // Limit to top 50 most answered questions
      // This is heavy, ideally we'd have an RPC or materialized view
      // For now, we'll just return a placeholder or simple query
      
      // Let's get response counts per question
      // Using .rpc if available would be best. 
      // I'll assume we don't have a specific RPC for this yet and do a lightweight check.
      
      return {
        content: [{ type: 'text', text: "Question analytics requires complex aggregation. Please use the 'list_questions' tool to inspect specific questions." }]
      };
    }
  );
}
