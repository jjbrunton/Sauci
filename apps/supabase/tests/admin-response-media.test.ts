import { assertEquals } from "std/assert/mod.ts";
import {
  canViewResponseMedia,
  getResponseMediaDescriptor,
} from "../functions/admin-response-media/helpers.ts";

Deno.test("response media access requires the response permission", () => {
  assertEquals(canViewResponseMedia("super_admin", null), true);
  assertEquals(canViewResponseMedia("pack_creator", ["view_responses"]), true);
  assertEquals(canViewResponseMedia("pack_creator", ["view_activity"]), false);
});

Deno.test("response media is derived from the stored response payload", () => {
  assertEquals(
    getResponseMediaDescriptor({
      type: "photo",
      media_path:
        "https://example.supabase.co/storage/v1/object/sign/response-media/user/question.jpg?token=secret",
    }),
    { type: "photo", path: "user/question.jpg" },
  );
  assertEquals(
    getResponseMediaDescriptor({ type: "text_answer", text: "hello" }),
    null,
  );
  assertEquals(
    getResponseMediaDescriptor({ type: "audio", media_path: "" }),
    null,
  );
});
