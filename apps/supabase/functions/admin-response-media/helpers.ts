export type ResponseMediaDescriptor = {
  type: "photo" | "audio";
  path: string;
};

export function canViewResponseMedia(
  role: unknown,
  permissions: unknown,
): boolean {
  return role === "super_admin" ||
    (Array.isArray(permissions) && permissions.includes("view_responses"));
}

export function getResponseMediaDescriptor(
  responseData: unknown,
): ResponseMediaDescriptor | null {
  if (!responseData || typeof responseData !== "object") return null;

  const data = responseData as Record<string, unknown>;
  if (data.type !== "photo" && data.type !== "audio") return null;
  if (typeof data.media_path !== "string" || !data.media_path.trim()) {
    return null;
  }

  return {
    type: data.type,
    path: normalizeResponseMediaPath(data.media_path),
  };
}

export function normalizeResponseMediaPath(mediaPath: string): string {
  if (mediaPath.startsWith("http")) {
    const parts = mediaPath.split("/response-media/");
    if (parts.length > 1) {
      return decodeURIComponent(parts[1].split("?")[0]);
    }
  }

  return mediaPath;
}
