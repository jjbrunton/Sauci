import { describe, expect, it } from 'vitest';
import { clampDareIntensity, parseIntensityRange } from './dareIntensity';

describe('clampDareIntensity', () => {
    it('accepts values within the 1-5 range', () => {
        expect(clampDareIntensity('1')).toBe(1);
        expect(clampDareIntensity('3')).toBe(3);
        expect(clampDareIntensity('5')).toBe(5);
    });

    it('falls back to 1 for missing, non-numeric, or out-of-range values', () => {
        expect(clampDareIntensity('')).toBe(1);
        expect(clampDareIntensity('abc')).toBe(1);
        expect(clampDareIntensity('0')).toBe(1);
        expect(clampDareIntensity('6')).toBe(1);
    });

    it('falls back to a custom default when provided', () => {
        expect(clampDareIntensity('', 3)).toBe(3);
        expect(clampDareIntensity('9', 3)).toBe(3);
    });
});

describe('parseIntensityRange', () => {
    it('allows both bounds blank', () => {
        expect(parseIntensityRange('', '')).toEqual({ range: { min: null, max: null }, error: null });
    });

    it('parses valid bounds', () => {
        expect(parseIntensityRange('2', '4')).toEqual({ range: { min: 2, max: 4 }, error: null });
    });

    it('rejects a minimum outside 1-5', () => {
        const { error } = parseIntensityRange('0', '');
        expect(error).toMatch(/Minimum intensity/);
    });

    it('rejects a maximum outside 1-5', () => {
        const { error } = parseIntensityRange('', '6');
        expect(error).toMatch(/Maximum intensity/);
    });

    it('rejects a minimum greater than the maximum', () => {
        const { error } = parseIntensityRange('4', '2');
        expect(error).toMatch(/cannot be greater than/);
    });
});
