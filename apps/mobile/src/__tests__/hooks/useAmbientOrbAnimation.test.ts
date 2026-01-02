import { renderHook } from '@testing-library/react-native';
import { useAmbientOrbAnimation } from '@/hooks/useAmbientOrbAnimation';

describe('useAmbientOrbAnimation', () => {
    it('returns two animated styles', () => {
        const { result } = renderHook(() => useAmbientOrbAnimation());
        expect(result.current.orbStyle1).toBeTruthy();
        expect(result.current.orbStyle2).toBeTruthy();
    });

    it('accepts configuration overrides', () => {
        const { result } = renderHook(() =>
            useAmbientOrbAnimation({
                opacityRange1: [0.1, 0.2],
                opacityRange2: [0.2, 0.3],
                driftDistance: 10,
                scaleRange: [1, 1.05],
            })
        );

        expect(result.current.orbStyle1).toBeTruthy();
        expect(result.current.orbStyle2).toBeTruthy();
    });
});
