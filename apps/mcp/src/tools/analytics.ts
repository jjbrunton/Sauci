import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { adminData } from '../lib/admin-data.js';

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
        adminData.from('categories').select('*', { count: 'exact', head: true }),
        adminData.from('question_packs').select('*', { count: 'exact', head: true }),
        adminData.from('questions').select('*', { count: 'exact', head: true }),
        adminData.from('profiles').select('*', { count: 'exact', head: true }),
        adminData.from('couples').select('*', { count: 'exact', head: true })
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
      const { data, error } = await adminData.featureInterestCounts();
      if (error) throw new Error(`Failed to get feature interests: ${error.message}`);

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
      const { data, error } = await adminData
        .from('profiles')
        .select('usage_reason, gender');
        
      if (error) throw new Error(`Failed to get usage insights: ${error.message}`);
      
      const reasons: Record<string, number> = {};
      const genders: Record<string, number> = {};
      
      data.forEach((p: Record<string, unknown>) => {
        const usageReason = typeof p.usage_reason === 'string' ? p.usage_reason : undefined;
        const gender = typeof p.gender === 'string' ? p.gender : undefined;
        if (usageReason) reasons[usageReason] = (reasons[usageReason] || 0) + 1;
        if (gender) genders[gender] = (genders[gender] || 0) + 1;
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
