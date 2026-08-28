import { accountOperationsApi } from '../../lib/accountOperationsApi';
import { apiClient } from '../../lib/apiClient';

jest.mock('../../lib/apiClient', () => ({
    apiClient: {
        delete: jest.fn(),
        post: jest.fn(),
    },
}));

describe('accountOperationsApi', () => {
    it('routes destructive and subscription operations through the standalone API', async () => {
        await accountOperationsApi.deleteRelationship();
        await accountOperationsApi.resetProgress();
        await accountOperationsApi.deleteAccount();
        await accountOperationsApi.syncSubscription();

        expect(apiClient.delete).toHaveBeenNthCalledWith(1, '/v1/couple/data');
        expect(apiClient.delete).toHaveBeenNthCalledWith(2, '/v1/couple/progress');
        expect(apiClient.delete).toHaveBeenNthCalledWith(3, '/v1/me');
        expect(apiClient.post).toHaveBeenCalledWith('/v1/me/subscription/sync');
    });
});

