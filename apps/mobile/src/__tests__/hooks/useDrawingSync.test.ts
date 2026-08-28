import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrawingSync } from '@/features/live-draw/hooks/useDrawingSync';
import { appDataApi } from '@/lib/appDataApi';
import { ApiError } from '@/lib/apiClient';

jest.mock('@/lib/appDataApi', () => ({ appDataApi: { getLiveDraw: jest.fn(), putLiveDraw: jest.fn() } }));
jest.mock('@/features/live-draw/utils/widgetBridge', () => ({ updateWidget: jest.fn() }));

const userId = '11111111-1111-4111-8111-111111111111';
const stroke = { id: 's1', userId, points: [{ x: 0.2, y: 0.3 }], color: '#fff', width: 2, timestamp: 1, isEraser: false };

describe('useDrawingSync API polling', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());
  it('loads, polls by revision, and persists complete drawing state', async () => {
    (appDataApi.getLiveDraw as jest.Mock)
      .mockResolvedValueOnce({ strokes: [], revision: 1, updated_at: 'one', updated_by: userId })
      .mockResolvedValueOnce({ strokes: [stroke], revision: 2, updated_at: 'two', updated_by: userId });
    (appDataApi.putLiveDraw as jest.Mock).mockResolvedValue({ strokes: [stroke], revision: 3, updated_at: 'three', updated_by: userId });
    const onLoadStrokes = jest.fn();
    const { result } = renderHook(() => useDrawingSync({
      coupleId: 'couple', userId, onStrokeStart: jest.fn(), onStrokeContinue: jest.fn(),
      onStrokeEnd: jest.fn(), onClearCanvas: jest.fn(), onUndo: jest.fn(), onRedo: jest.fn(), onLoadStrokes,
    }));
    await waitFor(() => expect(onLoadStrokes).toHaveBeenCalledWith([]));
    await act(async () => { jest.advanceTimersByTime(750); await Promise.resolve(); });
    await waitFor(() => expect(onLoadStrokes).toHaveBeenCalledWith([stroke]));
    await act(async () => result.current.persistStrokes([stroke]));
    expect(appDataApi.putLiveDraw).toHaveBeenCalledWith([stroke], 2);
  });
  it('merges a concurrent partner stroke and retries from the returned revision', async () => {
    const partnerStroke = { ...stroke, id: 'partner', userId: '22222222-2222-4222-8222-222222222222' };
    const mine = { ...stroke, id: 'mine' };
    (appDataApi.getLiveDraw as jest.Mock).mockResolvedValue({ strokes: [stroke], revision: 1, updated_at: 'one', updated_by: userId });
    (appDataApi.putLiveDraw as jest.Mock)
      .mockRejectedValueOnce(new ApiError('conflict', 409, { current_state: { strokes: [stroke, partnerStroke], revision: 2, updated_at: 'two', updated_by: partnerStroke.userId } }))
      .mockResolvedValueOnce({ strokes: [stroke, partnerStroke, mine], revision: 3, updated_at: 'three', updated_by: userId });
    const onLoadStrokes = jest.fn();
    const { result } = renderHook(() => useDrawingSync({
      coupleId: 'couple', userId, onStrokeStart: jest.fn(), onStrokeContinue: jest.fn(),
      onStrokeEnd: jest.fn(), onClearCanvas: jest.fn(), onUndo: jest.fn(), onRedo: jest.fn(), onLoadStrokes,
    }));
    await waitFor(() => expect(onLoadStrokes).toHaveBeenCalledWith([stroke]));
    await act(async () => result.current.persistStrokes([stroke, mine]));
    expect(appDataApi.putLiveDraw).toHaveBeenNthCalledWith(1, [stroke, mine], 1);
    expect(appDataApi.putLiveDraw).toHaveBeenNthCalledWith(2, [stroke, partnerStroke, mine], 2);
    expect(onLoadStrokes).toHaveBeenLastCalledWith([stroke, partnerStroke, mine]);
  });
});
