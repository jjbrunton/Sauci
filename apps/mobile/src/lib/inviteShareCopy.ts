/**
 * Builds the message shared when inviting a partner to pair. Once the inviter has
 * sealed answers banked (answered questions solo, before a partner joined), the
 * copy leads with that earned value instead of a plain invite, because it gives
 * the recipient a concrete reason to join right away.
 */
export function buildInviteShareMessage(inviteCode: string, sealedCount: number): string {
    const link = `https://sauci.app/join/${inviteCode}`;
    if (sealedCount > 0) {
        const noun = sealedCount === 1 ? "question" : "questions";
        return `Join me on Sauci! I've answered ${sealedCount} ${noun} about us. Join and we'll both see what we agree on. ${link} If the link does not open the app, enter code ${inviteCode} in Sauci.`;
    }
    return `Join me on Sauci! ${link} If the link does not open the app, enter code ${inviteCode} in Sauci.`;
}
