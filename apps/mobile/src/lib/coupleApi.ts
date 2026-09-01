import type { Couple, Profile } from "@/types";
import { apiRequest, apiRequestWithAccessToken } from "./apiClient";

export interface CoupleStateResponse {
    couple: Couple | null;
    partner: Profile | null;
    /** Count of this user's banked answers with no couple yet (couple_id IS NULL). */
    sealed_count: number;
}

export interface CoupleMutationResponse {
    success: true;
    couple_id: string | null;
    invite_code?: string;
}

export const coupleApi = {
    getState: () => apiRequest<CoupleStateResponse>("/v1/couple"),
    getStateWithAccessToken: (accessToken: string) =>
        apiRequestWithAccessToken<CoupleStateResponse>("/v1/couple", accessToken),
    create: () => apiRequest<CoupleMutationResponse>("/v1/couple", { method: "POST", body: {} }),
    join: (inviteCode: string) => apiRequest<CoupleMutationResponse>("/v1/couple", {
        method: "POST",
        body: { invite_code: inviteCode },
    }),
    cancel: () => apiRequest<CoupleMutationResponse>("/v1/couple", { method: "DELETE" }),
};
