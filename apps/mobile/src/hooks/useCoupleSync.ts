import { useCallback, useRef } from 'react';
import { appDataApi, type SyncSummary } from '../lib/appDataApi';
import { useAuthStore } from '../store/authStore';
import { useMatchStore } from '../store/matchStore';
import { useMessageStore } from '../store/messageStore';
import { usePacksStore } from '../store/packsStore';
import { useStreakStore } from '../store/streakStore';
import { usePolling } from './usePolling';

/**
 * Slower than the five-second full refresh it replaces, because the request it
 * makes is a change summary rather than five payloads: the app reacts to a
 * partner's action within this window, but pays one small query for it.
 */
export const SYNC_INTERVAL_MS = 15_000;

/**
 * Keeps cached domain data honest without re-fetching it. Each poll reads one
 * summary of the couple's state and refreshes only the domains whose markers
 * moved — and only the ones already on screen, so a view nobody has opened is
 * not loaded in the background.
 */
export function useCoupleSync(userId: string | undefined, coupleId: string | null | undefined): void {
    const previousRef = useRef<SyncSummary | null>(null);
    const identityRef = useRef<string>('');
    // `sync` is memoized on a stable callback, so `taskRef` inside usePolling
    // never has to restart the schedule on every render; it reads the current
    // identity through this ref instead of closing over the arguments from
    // whichever render created it.
    const identityValuesRef = useRef({ userId, coupleId });
    identityValuesRef.current = { userId, coupleId };

    const latestIdentity = useCallback(() => {
        const { userId, coupleId } = identityValuesRef.current;
        return `${userId ?? ''}:${coupleId ?? ''}`;
    }, []);

    const sync = useCallback(async () => {
        const identity = latestIdentity();
        if (identity !== identityRef.current) {
            // A new account's first summary must not be diffed against the prior
            // account's markers, or every domain would silently "refresh" on login.
            identityRef.current = identity;
            previousRef.current = null;
        }

        const summary = await appDataApi.syncSummary();
        // The account can change while this request is in flight. The response
        // describes the identity that asked for it, so once that is no longer the
        // current one it may not touch anything: not the badge, not the baseline
        // the next account will diff against, and not a single refresh decision.
        // Both checks matter — `identityRef` catches a newer sync that has already
        // started, and `latestIdentity()` catches a switch that has only rendered.
        if (identityRef.current !== identity || latestIdentity() !== identity) return;

        const previous = previousRef.current;
        previousRef.current = summary;

        // The badge count comes straight out of the summary, so keeping it current
        // costs nothing beyond this request.
        if (summary.unread_total !== previous?.unread_total) {
            useMessageStore.getState().setUnreadCount(summary.unread_total);
        }
        // The first poll only establishes the baseline: every screen loads its own
        // data on mount, and refreshing it again here would undo the saving.
        if (!previous) return;

        const auth = useAuthStore.getState();
        const matchStore = useMatchStore.getState();
        const refreshes: Promise<unknown>[] = [];

        if (summary.profile_updated_at !== previous.profile_updated_at || summary.couple_id !== previous.couple_id) {
            // fetchUser also refreshes the couple when one is set.
            refreshes.push(auth.fetchUser());
        } else if (summary.partner_id !== previous.partner_id || summary.partner_updated_at !== previous.partner_updated_at) {
            refreshes.push(auth.fetchCouple());
        }

        if (matchStore.loadedAt.active !== undefined && (
            summary.match_count !== previous.match_count ||
            summary.new_match_count !== previous.new_match_count ||
            summary.latest_match_at !== previous.latest_match_at ||
            // Neither count moves when a partner edits an existing match's type or
            // response summary through response editing.
            summary.match_state_fingerprint !== previous.match_state_fingerprint ||
            // `unread_total` can hold steady while unread redistributes between
            // matches (one read, another receives a message), which reorders the
            // unread-first list without moving the total.
            summary.match_unread_fingerprint !== previous.match_unread_fingerprint)) {
            refreshes.push(matchStore.fetchMatches(true, { silent: true }));
        }
        if (matchStore.loadedAt.pending !== undefined && summary.pending_yours !== previous.pending_yours) {
            refreshes.push(matchStore.fetchPendingQuestions({ silent: true }));
        }
        if (matchStore.loadedAt.their_turn !== undefined && summary.pending_theirs !== previous.pending_theirs) {
            refreshes.push(matchStore.fetchTheirTurnQuestions({ silent: true }));
        }
        // Only refresh a domain the user has actually opened, matching the rule
        // that unopened domains stay unloaded.
        if (usePacksStore.getState().enabledPacksLoadedAt !== null
            && summary.enabled_packs_fingerprint !== previous.enabled_packs_fingerprint) {
            refreshes.push(usePacksStore.getState().fetchEnabledPacks());
        }
        if (summary.streak_updated_at !== previous.streak_updated_at) {
            refreshes.push(useStreakStore.getState().refreshStreak());
        }

        await Promise.allSettled(refreshes);
    }, [latestIdentity]);

    usePolling(sync, {
        intervalMs: SYNC_INTERVAL_MS,
        enabled: Boolean(userId),
        resetKey: `${userId ?? ''}:${coupleId ?? ''}`,
    });
}
