import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrawingSync, dedupeById, mergeDrawingChanges } from '@/features/live-draw/hooks/useDrawingSync';
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

describe('useDrawingSync focus gating', () => {
  const handlers = {
    onStrokeStart: jest.fn(), onStrokeContinue: jest.fn(), onStrokeEnd: jest.fn(),
    onClearCanvas: jest.fn(), onUndo: jest.fn(), onRedo: jest.fn(),
  };
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('reads the canvas once on mount and then polls only while the screen is on top', async () => {
    (appDataApi.getLiveDraw as jest.Mock).mockResolvedValue({ strokes: [], revision: 1, updated_at: 'one', updated_by: userId });
    const onLoadStrokes = jest.fn();
    const { rerender } = renderHook<unknown, { isFocused: boolean }>(({ isFocused }) => useDrawingSync({
      coupleId: 'couple', userId, onLoadStrokes, isFocused, ...handlers,
    }), { initialProps: { isFocused: false } });

    await waitFor(() => expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(1));
    // A canvas nobody is looking at costs nothing beyond the state it loaded with.
    await act(async () => { jest.advanceTimersByTime(750 * 8); await Promise.resolve(); });
    expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(1);

    rerender({ isFocused: true });
    await act(async () => { jest.advanceTimersByTime(750); await Promise.resolve(); });
    expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(2);

    rerender({ isFocused: false });
    await act(async () => { jest.advanceTimersByTime(750 * 8); await Promise.resolve(); });
    expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(2);
  });

  it('never polls over its own write in flight', async () => {
    (appDataApi.getLiveDraw as jest.Mock).mockResolvedValue({ strokes: [], revision: 1, updated_at: 'one', updated_by: userId });
    let release: (state: unknown) => void = () => undefined;
    (appDataApi.putLiveDraw as jest.Mock).mockReturnValue(new Promise(resolve => { release = resolve; }));
    const onLoadStrokes = jest.fn();
    const { result } = renderHook(() => useDrawingSync({
      coupleId: 'couple', userId, onLoadStrokes, isFocused: true, ...handlers,
    }));
    await waitFor(() => expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(1));

    const pending = result.current.persistStrokes([stroke]);
    await act(async () => { jest.advanceTimersByTime(750 * 4); await Promise.resolve(); });
    // The write returns the authoritative state; reading over the top of it would
    // only race a revision we are about to replace.
    expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ strokes: [stroke], revision: 2, updated_at: 'two', updated_by: userId });
      await pending;
    });
    await act(async () => { jest.advanceTimersByTime(750); await Promise.resolve(); });
    expect(appDataApi.getLiveDraw).toHaveBeenCalledTimes(2);
  });
});

describe('useDrawingSync stroke deduplication', () => {
  const at = (id: string, points: number, userId = 'u1') => ({
    id, userId, points: Array.from({ length: points }, (_, i) => ({ x: i, y: i })),
    color: '#fff', width: 2, timestamp: 1, isEraser: false,
  });

  it('keeps the most complete copy of a stroke at its original z-position', () => {
    // Mid-draw writes persist a truncated copy; touch-end appends the full one.
    const out = dedupeById([at('a', 3), at('mine', 5), at('b', 3), at('mine', 40)]);
    expect(out.map(s => s.id)).toEqual(['a', 'mine', 'b']);
    expect(out[1].points).toHaveLength(40);
  });

  it('leaves a set of unique strokes untouched', () => {
    const input = [at('a', 1), at('b', 1)];
    expect(dedupeById(input)).toEqual(input);
  });

  it('never emits duplicate ids after a conflict merge', () => {
    const merged = mergeDrawingChanges(
      [at('a', 2)],
      [at('a', 2), at('mine', 3), at('mine', 30)],
      [at('a', 2), at('partner', 4)],
    );
    expect(merged.map(s => s.id)).toEqual(['a', 'partner', 'mine']);
    expect(merged.find(s => s.id === 'mine')!.points).toHaveLength(30);
  });

  it('still drops strokes removed locally', () => {
    const merged = mergeDrawingChanges([at('a', 2), at('gone', 2)], [at('a', 2)], [at('a', 2), at('gone', 2)]);
    expect(merged.map(s => s.id)).toEqual(['a']);
  });
});
