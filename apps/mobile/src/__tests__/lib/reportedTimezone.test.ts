import { profileSettingsApi } from "@/lib/profileSettingsApi";
import { syncTimezone } from "@/lib/reportedTimezone";

jest.mock("@/lib/profileSettingsApi", () => ({
    profileSettingsApi: { updateProfile: jest.fn() },
}));

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

const withZone = (zone: string | undefined) => {
    jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
        resolvedOptions: () => ({ timeZone: zone }),
    } as never);
};

describe("syncTimezone", () => {
    beforeEach(() => {
        secureStore.__store.clear();
        jest.mocked(profileSettingsApi.updateProfile).mockResolvedValue({ updated: true });
    });

    it("reports the device zone once and not again until it changes", async () => {
        withZone("Europe/London");
        await syncTimezone("user-1");
        await syncTimezone("user-1");

        expect(profileSettingsApi.updateProfile).toHaveBeenCalledTimes(1);
        expect(profileSettingsApi.updateProfile).toHaveBeenCalledWith({ timezone: "Europe/London" });

        withZone("Pacific/Auckland");
        await syncTimezone("user-1");
        expect(profileSettingsApi.updateProfile).toHaveBeenNthCalledWith(2, { timezone: "Pacific/Auckland" });
    });

    it("tracks zones per user, so a shared device does not skip the second account", async () => {
        withZone("Europe/London");
        await syncTimezone("user-1");
        await syncTimezone("user-2");
        expect(profileSettingsApi.updateProfile).toHaveBeenCalledTimes(2);
    });

    it("does nothing when the platform cannot resolve a zone", async () => {
        withZone(undefined);
        await syncTimezone("user-1");
        expect(profileSettingsApi.updateProfile).not.toHaveBeenCalled();
    });

    it("retries on the next launch when the report fails", async () => {
        withZone("Europe/London");
        jest.mocked(profileSettingsApi.updateProfile).mockRejectedValueOnce(new Error("offline"));
        await syncTimezone("user-1");

        jest.mocked(profileSettingsApi.updateProfile).mockResolvedValue({ updated: true });
        await syncTimezone("user-1");
        expect(profileSettingsApi.updateProfile).toHaveBeenCalledTimes(2);
    });
});
