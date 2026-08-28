import { appDataApi } from '@/lib/appDataApi';
import { apiClient } from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn() } }));

describe('appDataApi', () => {
  beforeEach(() => jest.clearAllMocks());
  it('routes pack and match reads through the authenticated Node API', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({});
    await appDataApi.packQuestions('pack id'); await appDataApi.packTeaser('pack id'); await appDataApi.matchContext('match id');
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/v1/packs/pack%20id/questions');
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/v1/packs/pack%20id/teaser');
    expect(apiClient.get).toHaveBeenNthCalledWith(3, '/v1/matches/match%20id/context');
  });
  it('persists media view and drawing state without accepting a couple ID', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({}); (apiClient.put as jest.Mock).mockResolvedValue({});
    await appDataApi.markMediaViewed('m1', null); await appDataApi.putLiveDraw([], 7);
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/messages/m1/media-viewed', { expires_at: null });
    expect(apiClient.put).toHaveBeenCalledWith('/v1/live-draw', { strokes: [], base_revision: 7 });
  });
});
