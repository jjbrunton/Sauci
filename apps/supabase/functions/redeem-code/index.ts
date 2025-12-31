import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedeemCodeBody {
    email: string;
    code: string;
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Use service role for database operations since this is unauthenticated
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Parse request body
        const { email, code }: RedeemCodeBody = await req.json();

        if (!email || typeof email !== "string" || email.trim() === "") {
            return new Response(
                JSON.stringify({ success: false, error: "Please enter your email address" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!code || typeof code !== "string" || code.trim() === "") {
            return new Response(
                JSON.stringify({ success: false, error: "Please enter a redemption code" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Call the database function to redeem the code
        const { data, error } = await supabase.rpc("redeem_code_by_email", {
            p_email: email.trim(),
            p_code: code.trim(),
        });

        if (error) {
            console.error("RPC error:", error);
            return new Response(
                JSON.stringify({ success: false, error: "Failed to redeem code. Please try again." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // The RPC returns a JSONB object with success, error, or message
        return new Response(
            JSON.stringify(data),
            {
                status: data.success ? 200 : 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
