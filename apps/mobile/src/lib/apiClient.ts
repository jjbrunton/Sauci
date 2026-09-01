import { authClient } from "./authClient";

const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!isTestEnv && !configuredApiUrl) {
    throw new Error("Missing required environment variable: EXPO_PUBLIC_API_URL. App cannot start.");
}

export const apiUrl = (configuredApiUrl || "http://127.0.0.1:3003").replace(/\/$/, "");

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
    body?: unknown;
};

async function parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;

    const text = await response.text();
    if (!text) return undefined;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export async function apiRequestWithAccessToken<T>(
    path: string,
    accessToken: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${accessToken}`);

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(options.body);
    }

    const response = await fetch(`${apiUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...options,
        headers,
        body,
    });
    const responseBody = await parseResponse(response);

    if (!response.ok) {
        let message = `API request failed with status ${response.status}`;
        if (typeof responseBody === "object" && responseBody !== null && "error" in responseBody) {
            const apiError = (responseBody as { error: unknown }).error;
            if (typeof apiError === "string") {
                message = apiError;
            } else if (
                typeof apiError === "object" &&
                apiError !== null &&
                "message" in apiError &&
                typeof (apiError as { message: unknown }).message === "string"
            ) {
                message = (apiError as { message: string }).message;
            }
        }
        throw new ApiError(message, response.status, responseBody);
    }

    return responseBody as T;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { data, error } = await authClient.auth.getSession();
    const accessToken = data.session?.access_token;

    if (error || !accessToken) {
        throw new ApiError("An authenticated session is required", 401, error);
    }

    return apiRequestWithAccessToken(path, accessToken, options);
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { data, error } = await authClient.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) throw new ApiError("An authenticated session is required", 401, error);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${apiUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
}

export const apiClient = {
    get: <T>(path: string) => apiRequest<T>(path),
    getWithAccessToken: <T>(path: string, accessToken: string) => apiRequestWithAccessToken<T>(path, accessToken),
    post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
    put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
    patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
    delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
