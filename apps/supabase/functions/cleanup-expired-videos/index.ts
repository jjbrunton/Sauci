import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Cleanup expired videos from storage.
 * This function is called by pg_cron daily at 3 AM UTC.
 * It finds videos where media_expires_at has passed, deletes the files from storage,
 * and marks the messages as expired.
 */
Deno.serve(async (req) => {
    // Only allow POST requests (from cron) or GET (for manual testing)
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        // Get expired videos that still have files
        const { data: expiredVideos, error: fetchError } = await supabase
            .from("messages")
            .select("id, media_path")
            .eq("media_type", "video")
            .eq("media_expired", false)
            .not("media_path", "is", null)
            .lt("media_expires_at", new Date().toISOString());

        if (fetchError) {
            console.error("Error fetching expired videos:", fetchError);
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!expiredVideos || expiredVideos.length === 0) {
            return new Response(
                JSON.stringify({ deleted: 0, message: "No expired videos found" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Delete files from storage
        const paths = expiredVideos.map((v) => v.media_path).filter(Boolean) as string[];

        if (paths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from("chat-media")
                .remove(paths);

            if (storageError) {
                console.error("Error deleting from storage:", storageError);
                // Continue anyway to mark as expired - files may already be deleted
            }
        }

        // Mark messages as expired
        const ids = expiredVideos.map((v) => v.id);
        const { error: updateError } = await supabase
            .from("messages")
            .update({ media_expired: true, media_path: null })
            .in("id", ids);

        if (updateError) {
            console.error("Error marking messages as expired:", updateError);
            return new Response(
                JSON.stringify({ error: updateError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`Cleaned up ${expiredVideos.length} expired videos`);

        return new Response(
            JSON.stringify({
                deleted: expiredVideos.length,
                paths: paths,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Unexpected error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
