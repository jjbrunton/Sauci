import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY = "skipped_questions";
const SKIP_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SkippedQuestion {
    id: string;
    skippedAt: number;
}

async function getStorage(): Promise<SkippedQuestion[]> {
    try {
        let data: string | null = null;

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                data = window.localStorage.getItem(STORAGE_KEY);
            }
        } else {
            data = await SecureStore.getItemAsync(STORAGE_KEY);
        }

        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading skipped questions:", error);
    }
    return [];
}

async function setStorage(questions: SkippedQuestion[]): Promise<void> {
    try {
        const data = JSON.stringify(questions);

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(STORAGE_KEY, data);
            }
        } else {
            await SecureStore.setItemAsync(STORAGE_KEY, data);
        }
    } catch (error) {
        console.error("Error saving skipped questions:", error);
    }
}

export async function skipQuestion(questionId: string): Promise<void> {
    const skipped = await getStorage();
    const now = Date.now();

    // Remove old entries (older than SKIP_DURATION_MS)
    const filtered = skipped.filter(q => now - q.skippedAt < SKIP_DURATION_MS);

    // Add new skipped question (or update timestamp if already exists)
    const existingIndex = filtered.findIndex(q => q.id === questionId);
    if (existingIndex >= 0) {
        filtered[existingIndex].skippedAt = now;
    } else {
        filtered.push({ id: questionId, skippedAt: now });
    }

    await setStorage(filtered);
}

export async function getSkippedQuestionIds(): Promise<Set<string>> {
    const skipped = await getStorage();
    const now = Date.now();

    // Return only question IDs that are still within the skip duration
    const validSkipped = skipped.filter(q => now - q.skippedAt < SKIP_DURATION_MS);

    return new Set(validSkipped.map(q => q.id));
}
