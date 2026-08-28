import { apiClient } from './apiClient';

export interface AccountOperationResponse {
    success: true;
    message: string;
}

export interface SubscriptionSyncResponse {
    success: true;
    is_premium: boolean;
}

export const accountOperationsApi = {
    deleteRelationship: () => apiClient.delete<AccountOperationResponse>('/v1/couple/data'),
    resetProgress: () => apiClient.delete<AccountOperationResponse>('/v1/couple/progress'),
    deleteAccount: () => apiClient.delete<AccountOperationResponse>('/v1/me'),
    syncSubscription: () => apiClient.post<SubscriptionSyncResponse>('/v1/me/subscription/sync'),
};

