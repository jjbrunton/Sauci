// Dares and dare packs both gate on a 1-5 intensity scale (see
// apps/api/drizzle/0010_admin.sql and 0013_dares_loop.sql). These helpers keep
// the admin form validation consistent with that range.

export const MIN_DARE_INTENSITY = 1;
export const MAX_DARE_INTENSITY = 5;

/**
 * Clamp a raw form value to a valid dare intensity (1-5), falling back to 1
 * when the value is missing or not a finite number in range.
 */
export function clampDareIntensity(rawValue: string, fallback: number = MIN_DARE_INTENSITY): number {
    const parsed = parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_DARE_INTENSITY || parsed > MAX_DARE_INTENSITY) {
        return fallback;
    }
    return parsed;
}

export interface IntensityRange {
    min: number | null;
    max: number | null;
}

/**
 * Parse and validate an optional min/max intensity pair for a dare pack.
 * Returns the parsed range, or an error message when the values are invalid.
 */
export function parseIntensityRange(rawMin: string, rawMax: string): { range: IntensityRange; error: string | null } {
    const min = rawMin.trim() ? parseInt(rawMin, 10) : null;
    const max = rawMax.trim() ? parseInt(rawMax, 10) : null;

    if (min !== null && (!Number.isFinite(min) || min < MIN_DARE_INTENSITY || min > MAX_DARE_INTENSITY)) {
        return { range: { min: null, max: null }, error: 'Minimum intensity must be between 1 and 5' };
    }
    if (max !== null && (!Number.isFinite(max) || max < MIN_DARE_INTENSITY || max > MAX_DARE_INTENSITY)) {
        return { range: { min: null, max: null }, error: 'Maximum intensity must be between 1 and 5' };
    }
    if (min !== null && max !== null && min > max) {
        return { range: { min: null, max: null }, error: 'Minimum intensity cannot be greater than maximum intensity' };
    }

    return { range: { min, max }, error: null };
}
