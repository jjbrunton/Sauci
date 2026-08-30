import { Linking } from "react-native";

const mockShareSingle = jest.fn();
const mockIsPackageInstalled = jest.fn();

jest.mock("react-native-share", () => ({
    __esModule: true,
    default: {
        shareSingle: (...args: unknown[]) => mockShareSingle(...args),
        isPackageInstalled: (...args: unknown[]) => mockIsPackageInstalled(...args),
    },
    Social: { InstagramStories: "instagramstories" },
}));

function loadShareToInstagramStories() {
    let shareToInstagramStories: (uri: string) => Promise<boolean>;
    jest.isolateModules(() => {
        shareToInstagramStories = require("../../lib/instagramShare").shareToInstagramStories;
    });
    return shareToInstagramStories!;
}

describe("shareToInstagramStories", () => {
    const originalAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

    afterEach(() => {
        if (originalAppId === undefined) {
            delete process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
        } else {
            process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = originalAppId;
        }
    });

    it("returns false without opening Instagram when no Facebook App ID is configured", async () => {
        delete process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
        const share = loadShareToInstagramStories();

        await expect(share("file:///tmp/card.png")).resolves.toBe(false);
        expect(mockShareSingle).not.toHaveBeenCalled();
    });

    it("returns false when Instagram is not installed", async () => {
        process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = "123456";
        jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
        const share = loadShareToInstagramStories();

        await expect(share("file:///tmp/card.png")).resolves.toBe(false);
        expect(mockShareSingle).not.toHaveBeenCalled();
    });

    it("shares the captured image as the story background when Instagram is available", async () => {
        process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = "123456";
        jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
        mockShareSingle.mockResolvedValue({ success: true });
        const share = loadShareToInstagramStories();

        await expect(share("file:///tmp/card.png")).resolves.toBe(true);
        expect(mockShareSingle).toHaveBeenCalledWith({
            social: "instagramstories",
            appId: "123456",
            backgroundImage: "file:///tmp/card.png",
        });
    });

    it("returns false when the native share fails", async () => {
        process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = "123456";
        jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
        mockShareSingle.mockRejectedValue(new Error("share failed"));
        const share = loadShareToInstagramStories();

        await expect(share("file:///tmp/card.png")).resolves.toBe(false);
    });
});
