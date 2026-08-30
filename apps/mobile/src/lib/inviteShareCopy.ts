/**
 * Builds the message shared when inviting a partner to pair. Once the inviter has
 * sealed answers banked (answered questions solo, before a partner joined), the
 * copy leads with that earned value instead of a plain invite, because it gives
 * the recipient a concrete reason to join right away.
 */
export function buildInviteShareMessage(inviteCode: string, sealedCount: number): string {
    const link = `https://sauci.app/join/${inviteCode} (or enter code ${inviteCode} in the app)`;
    if (sealedCount > 0) {
        const noun = sealedCount === 1 ? "question" : "questions";
        return `Join me on Sauci! I have already answered ${sealedCount} ${noun} about us. Tap this link to unlock them: ${link}`;
    }
    return `Join me on Sauci! Tap this link to pair up instantly: ${link}`;
}
