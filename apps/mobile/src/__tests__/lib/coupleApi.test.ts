import { apiRequest } from "../../lib/apiClient";
import { coupleApi } from "../../lib/coupleApi";

jest.mock("../../lib/apiClient", () => ({ apiRequest: jest.fn() }));

const request = apiRequest as jest.Mock;

describe("coupleApi", () => {
    beforeEach(() => request.mockResolvedValue({ success: true }));

    it("uses the authenticated standalone API for the complete pairing lifecycle", async () => {
        await coupleApi.getState();
        await coupleApi.create();
        await coupleApi.join("ABCD2345");
        await coupleApi.cancel();

        expect(request.mock.calls).toEqual([
            ["/v1/couple"],
            ["/v1/couple", { method: "POST", body: {} }],
            ["/v1/couple", { method: "POST", body: { invite_code: "ABCD2345" } }],
            ["/v1/couple", { method: "DELETE" }],
        ]);
    });
});
