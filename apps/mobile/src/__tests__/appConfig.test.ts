const configPath = require.resolve("../../app.config");
const appJson = require("../../app.json");

type UpdateConfig = {
    version: string;
    runtimeVersion: string;
    updates: {
        codeSigningCertificate?: string;
        codeSigningMetadata?: Record<string, string>;
    };
};

function resolveConfig(environment: Record<string, string>): UpdateConfig {
    const previous = {
        DISABLE_CODE_SIGNING: process.env.DISABLE_CODE_SIGNING,
        RELEASE_CHANNEL: process.env.RELEASE_CHANNEL,
    };

    Object.assign(process.env, environment);
    jest.resetModules();

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return (require(configPath) as () => UpdateConfig)();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

describe("Expo OTA configuration", () => {
    it("rejects disabling code signing for a production build", () => {
        expect(() =>
            resolveConfig({ RELEASE_CHANNEL: "production", DISABLE_CODE_SIGNING: "1" }),
        ).toThrow("RELEASE_CHANNEL=production does not permit DISABLE_CODE_SIGNING");
    });

    it("keeps local development code-signing opt-out available", () => {
        const config = resolveConfig({ RELEASE_CHANNEL: "development", DISABLE_CODE_SIGNING: "1" });

        expect(config.updates.codeSigningCertificate).toBeUndefined();
        expect(config.updates.codeSigningMetadata).toBeUndefined();
    });

    it("resolves an explicit runtime version matching the public version", () => {
        const config = resolveConfig({ RELEASE_CHANNEL: "production" });

        expect(config.runtimeVersion).toBe(appJson.expo.version);
        expect(config.runtimeVersion).toBe(config.version);
    });
});
