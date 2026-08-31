import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
    hasSeenMatchesTutorial,
    markMatchesTutorialSeen,
    resetMatchesTutorial,
} from "@/lib/matchesTutorialSeen";

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(),
}));

describe("matchesTutorialSeen", () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        jest.mocked(SecureStore.getItemAsync).mockReset();
        jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    });

    it("persists a dismissal for the signed-in account", async () => {
        await markMatchesTutorialSeen("user-1");

        await expect(hasSeenMatchesTutorial("user-1")).resolves.toBe(true);
    });

    it("does not dismiss the tutorial for another account on the same device", async () => {
        await markMatchesTutorialSeen("user-1");

        await expect(hasSeenMatchesTutorial("user-2")).resolves.toBe(false);
    });

    it("migrates an existing legacy dismissal into durable account storage", async () => {
        jest.mocked(SecureStore.getItemAsync).mockResolvedValue("true");

        await expect(hasSeenMatchesTutorial("user-1")).resolves.toBe(true);
        await expect(AsyncStorage.getItem("matches_tutorial_seen_user-1")).resolves.toBe("true");
    });

    it("lets the development reset show the tutorial for the current account again", async () => {
        await markMatchesTutorialSeen("user-1");
        await resetMatchesTutorial("user-1");

        await expect(hasSeenMatchesTutorial("user-1")).resolves.toBe(false);
    });
});
