import { hasSeenAvatarPrompt, markAvatarPromptSeen } from "@/lib/avatarPromptSeen";

jest.mock("expo-secure-store", () => {
    const store = new Map<string, string>();
    return {
        __store: store,
        getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStore = require("expo-secure-store") as { __store: Map<string, string> };

describe("avatarPromptSeen", () => {
    beforeEach(() => {
        secureStore.__store.clear();
    });

    it("reports unseen until marked seen for that user", async () => {
        expect(await hasSeenAvatarPrompt("user-1")).toBe(false);

        await markAvatarPromptSeen("user-1");

        expect(await hasSeenAvatarPrompt("user-1")).toBe(true);
    });

    it("tracks the seen flag per user, so a shared device does not skip the prompt for a new account", async () => {
        await markAvatarPromptSeen("user-1");

        expect(await hasSeenAvatarPrompt("user-1")).toBe(true);
        expect(await hasSeenAvatarPrompt("user-2")).toBe(false);
    });
});
