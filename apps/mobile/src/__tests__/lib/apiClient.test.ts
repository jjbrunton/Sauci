import { ApiError, apiRequest, apiRequestWithAccessToken } from "@/lib/apiClient";
import { authClient } from "@/lib/authClient";

function response(status: number, body?: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: jest.fn(async () => body === undefined ? "" : JSON.stringify(body)),
    } as unknown as Response;
}

describe("apiClient", () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = fetchMock;
        (authClient.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { access_token: "hosted-auth-token" } },
            error: null,
        });
    });

    it("injects the current Supabase access token", async () => {
        fetchMock.mockResolvedValue(response(200, { profile: { id: "user-1" } }));
        await apiRequest("/v1/me");

        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:3003/v1/me",
            expect.objectContaining({ headers: expect.any(Headers) }),
        );
        const headers = fetchMock.mock.calls[0][1].headers as Headers;
        expect(headers.get("Authorization")).toBe("Bearer hosted-auth-token");
    });

    it("fails closed when there is no authenticated session", async () => {
        (authClient.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });

        await expect(apiRequest("/v1/me")).rejects.toMatchObject({ status: 401 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses an explicitly captured bearer without reading a mutable auth session", async () => {
        fetchMock.mockResolvedValue(response(200, { profile: { id: "user-1" } }));
        (authClient.auth.getSession as jest.Mock).mockClear();

        await apiRequestWithAccessToken("/v1/me", "captured-token");

        const headers = fetchMock.mock.calls[0][1].headers as Headers;
        expect(headers.get("Authorization")).toBe("Bearer captured-token");
        expect(authClient.auth.getSession).not.toHaveBeenCalled();
    });

    it("preserves API status and error details", async () => {
        fetchMock.mockResolvedValue(response(403, {
            error: { message: "Couple access denied", code: "FORBIDDEN" },
        }));

        await expect(apiRequest("/v1/me")).rejects.toEqual(
            expect.objectContaining<ApiError>({
                name: "ApiError",
                message: "Couple access denied",
                status: 403,
                details: { error: { message: "Couple access denied", code: "FORBIDDEN" } },
            }),
        );
    });
});
