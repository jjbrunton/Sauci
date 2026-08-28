import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { ApiError, apiClient, authenticatedFetch } from './apiClient';

export type MediaKind = 'avatar' | 'response' | 'chat' | 'feedback';
export interface UploadMediaOptions { kind: MediaKind; mimeType: string; questionId?: string; matchId?: string }
export interface MediaUploadResponse { reference: string; media: { id: string; mime_type: string; byte_size: number }; message?: Record<string, unknown> }

export async function readMediaBody(uri: string): Promise<ArrayBuffer | Blob> {
    if (Platform.OS === 'web') return (await fetch(uri)).blob();
    return decode(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
}

export async function uploadMedia(uri: string, options: UploadMediaOptions): Promise<MediaUploadResponse> {
    const query = new URLSearchParams();
    if (options.questionId) query.set('questionId', options.questionId);
    if (options.matchId) query.set('matchId', options.matchId);
    const suffix = query.toString() ? `?${query}` : '';
    const response = await authenticatedFetch(`/v1/media/${options.kind}${suffix}`, {
        method: 'POST', headers: { 'Content-Type': options.mimeType }, body: await readMediaBody(uri),
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) throw new ApiError(body?.error?.message ?? 'Media upload failed', response.status, body);
    return body as MediaUploadResponse;
}

export function mediaId(reference: string): string | null {
    const value = reference.startsWith('media:') ? reference.slice(6) : reference;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export const getMediaUrl = (reference: string) => {
    const id = mediaId(reference);
    return id ? apiClient.get<{ url: string; expires_at: string }>(`/v1/media/${id}/url`) : Promise.resolve({ url: reference, expires_at: new Date(Date.now()+3600_000).toISOString() });
};
