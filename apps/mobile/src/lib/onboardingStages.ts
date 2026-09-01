export type OnboardingStage = "name" | "gender" | "purpose" | "notifications";

/** A stored display name lets onboarding begin at the next required question. */
export function initialOnboardingStage(name: string | null | undefined): OnboardingStage {
    return name?.trim() ? "gender" : "name";
}

/** A pending first-auth name is valid only for the matching signed-in subject. */
export function activeOnboardingStage(
    stage: OnboardingStage,
    storedDisplayName: string | null | undefined,
    pendingDisplayName: string | null | undefined,
): OnboardingStage {
    return stage === "name" && (storedDisplayName?.trim() || pendingDisplayName?.trim()) ? "gender" : stage;
}

/** The first reachable stage has no back action. */
export function previousOnboardingStage(
    stage: OnboardingStage,
    hasStoredDisplayName: boolean,
): OnboardingStage | null {
    switch (stage) {
        case "name":
            return null;
        case "gender":
            return hasStoredDisplayName ? null : "name";
        case "purpose":
            return "gender";
        case "notifications":
            return "purpose";
    }
}
