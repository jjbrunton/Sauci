import { pickRecommendedPacks, RECOMMENDED_PACKS_LIMIT } from "@/features/home/recommendedPacks";
import type { Category, QuestionPack } from "@/types";

function makeCategory(overrides: Partial<Category>): Category {
    return {
        id: "cat-1",
        name: "Category",
        description: null,
        icon: null,
        color: null,
        sort_order: 0,
        created_at: "",
        is_public: true,
        ...overrides,
    };
}

function makePack(overrides: Partial<QuestionPack>): QuestionPack {
    return {
        id: "pack-1",
        name: "Pack",
        description: null,
        icon: null,
        is_premium: false,
        is_public: true,
        is_explicit: false,
        sort_order: 0,
        category_id: null,
        ...overrides,
    } as QuestionPack;
}

describe("pickRecommendedPacks", () => {
    const categories: Category[] = [
        makeCategory({ id: "quality-time", name: "Quality Time" }),
        makeCategory({ id: "romance", name: "Romance & Sensuality" }),
        makeCategory({ id: "kink-lab", name: "The Kink Lab" }),
        makeCategory({ id: "adventure", name: "Adventure & Travel" }),
    ];

    const packs: QuestionPack[] = [
        makePack({ id: "p-quality-1", category_id: "quality-time" }),
        makePack({ id: "p-quality-2", category_id: "quality-time" }),
        makePack({ id: "p-romance-1", category_id: "romance" }),
        makePack({ id: "p-kink-1", category_id: "kink-lab" }),
        makePack({ id: "p-adventure-1", category_id: "adventure" }),
        makePack({ id: "p-uncategorized", category_id: null }),
    ];

    it("returns an empty list when there is no usage reason", () => {
        expect(pickRecommendedPacks(packs, categories, null)).toEqual([]);
        expect(pickRecommendedPacks(packs, categories, undefined)).toEqual([]);
    });

    it("prioritizes packs from the categories mapped to the usage reason, in order", () => {
        const result = pickRecommendedPacks(packs, categories, "reconnect");

        // "reconnect" maps to quality time, long distance, romance (in that order);
        // only quality time and romance exist in this catalog.
        expect(result.map((pack) => pack.id)).toEqual([
            "p-quality-1",
            "p-quality-2",
            "p-romance-1",
        ]);
    });

    it("matches a different usage reason to a different category set", () => {
        const result = pickRecommendedPacks(packs, categories, "spice_up_intimacy");

        expect(result.map((pack) => pack.id)).toEqual(["p-kink-1"]);
    });

    it("returns an empty list when no catalog category matches the mapped keywords", () => {
        const noMatchCategories: Category[] = [makeCategory({ id: "misc", name: "Miscellaneous" })];
        const result = pickRecommendedPacks(packs, noMatchCategories, "have_fun");

        expect(result).toEqual([]);
    });

    it("caps the recommended list at RECOMMENDED_PACKS_LIMIT", () => {
        const manyPacks = Array.from({ length: RECOMMENDED_PACKS_LIMIT + 5 }, (_, i) =>
            makePack({ id: `p-${i}`, category_id: "quality-time" })
        );

        const result = pickRecommendedPacks(manyPacks, categories, "strengthen_relationship");

        expect(result).toHaveLength(RECOMMENDED_PACKS_LIMIT);
    });
});
