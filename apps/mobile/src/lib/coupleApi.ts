import type { Couple, Profile } from "@/types";
import { apiRequest } from "./apiClient";

export interface CoupleStateResponse {
    couple: Couple | null;
    partner: Profile | null;
}

export interface CoupleMutationResponse {
    success: true;
    couple_id: string | null;
    invite_code?: string;
}

export const coupleApi = {
    getState: () => apiRequest<CoupleStateResponse>("/v1/couple"),
    create: () => apiRequest<CoupleMutationResponse>("/v1/couple", { method: "POST", body: {} }),
    join: (inviteCode: string) => apiRequest<CoupleMutationResponse>("/v1/couple", {
        method: "POST",
        body: { invite_code: inviteCode },
    }),
    cancel: () => apiRequest<CoupleMutationResponse>("/v1/couple", { method: "DELETE" }),
};
