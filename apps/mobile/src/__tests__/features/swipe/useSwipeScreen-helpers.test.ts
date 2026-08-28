import { calculateEffectiveTotal } from "@/features/swipe/utils/useSwipeScreen-helpers";
import type { DailyLimitInfo } from "@/features/swipe/types";

const limit = (overrides: Partial<DailyLimitInfo> = {}): DailyLimitInfo => ({
    responses_today: 0,
    limit_value: 10,
    remaining: 10,
    reset_at: "2026-08-29T00:00:00.000Z",
    is_blocked: false,
    ...overrides,
});

describe("calculateEffectiveTotal", () => {
    it("clamps the progress bar to the quota left today", () => {
        expect(calculateEffectiveTotal(50, null, limit({ responses_today: 8, remaining: 2 }), 3)).toBe(5);
    });

    it("shows the last card as the last card when one answer remains", () => {
        expect(calculateEffectiveTotal(50, null, limit({ responses_today: 9, remaining: 1 }), 7)).toBe(8);
    });

    it("leaves the total alone when the meter is disabled", () => {
        expect(calculateEffectiveTotal(50, null, limit({ limit_value: 0, remaining: 0 }), 3)).toBe(50);
        expect(calculateEffectiveTotal(50, null, null, 3)).toBe(50);
    });

    it("ignores the quota once blocked, since the limit screen takes over", () => {
        expect(calculateEffectiveTotal(50, null, limit({ responses_today: 10, remaining: 0, is_blocked: true }), 3)).toBe(50);
    });

    it("takes whichever of the answer gap and the quota binds first", () => {
        const gap = { unanswered: 8, threshold: 10 };
        expect(calculateEffectiveTotal(50, gap, limit({ remaining: 5 }), 2)).toBe(4);
        expect(calculateEffectiveTotal(50, gap, limit({ remaining: 1 }), 2)).toBe(3);
    });

    it("never runs fewer questions than the quota allows", () => {
        expect(calculateEffectiveTotal(3, null, limit({ remaining: 10 }), 0)).toBe(3);
    });
});
