import { apiClient } from "./apiClient";
import type { DareCatalog, DareItem, DareStats, SendDarePayload, SentDare } from "../features/dares/types";

const dare = (dareId: string) => `/v1/dares/${encodeURIComponent(dareId)}`;

export const daresApi = {
    catalog: () => apiClient.get<DareCatalog>("/v1/dares/packs"),
    packDares: (packId: string) =>
        apiClient.get<{ dares: DareItem[] }>(`/v1/dares/packs/${encodeURIComponent(packId)}/dares`),
    list: (filter: "active" | "history") =>
        apiClient.get<{ dares: SentDare[] }>(`/v1/dares?filter=${filter}`),
    stats: () => apiClient.get<DareStats>("/v1/dares/stats"),
    send: (payload: SendDarePayload) => apiClient.post<{ dare: SentDare }>("/v1/dares", payload),
    respond: (dareId: string, action: "accept" | "decline") =>
        apiClient.post<{ dare: SentDare }>(`${dare(dareId)}/respond`, { action }),
    submit: (dareId: string) => apiClient.post<{ dare: SentDare }>(`${dare(dareId)}/submit`),
    complete: (dareId: string) => apiClient.post<{ dare: SentDare }>(`${dare(dareId)}/complete`),
    cancel: (dareId: string) => apiClient.post<{ dare: SentDare }>(`${dare(dareId)}/cancel`),
};
