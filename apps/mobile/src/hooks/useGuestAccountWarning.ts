import { useCallback, useEffect, useRef, useState } from "react";
import { hasSeenGuestAccountWarning, markGuestAccountWarningSeen } from "../lib/guestAccountWarningSeen";

type GuestAccountWarningOptions = {
    isAuthenticated: boolean;
    isAnonymous: boolean;
    userId: string | null | undefined;
    pathname: string | null;
};

/**
 * Shows the account recovery warning at most once for each anonymous account
 * during a mounted app session. A dismissal is applied in memory before the
 * durable write completes, so a slow storage operation cannot reopen it.
 */
export function useGuestAccountWarning({
    isAuthenticated,
    isAnonymous,
    userId,
    pathname,
}: GuestAccountWarningOptions) {
    const [visible, setVisible] = useState(false);
    const checkedUserIds = useRef(new Set<string>());
    const dismissedUserIds = useRef(new Set<string>());

    const isEligible = Boolean(
        isAuthenticated
        && isAnonymous
        && userId
        && !pathname?.startsWith("/(auth)"),
    );

    useEffect(() => {
        if (!isEligible || !userId) {
            return;
        }

        if (checkedUserIds.current.has(userId) || dismissedUserIds.current.has(userId)) {
            return;
        }

        checkedUserIds.current.add(userId);
        let isCurrent = true;

        void hasSeenGuestAccountWarning(userId).then((seen) => {
            if (isCurrent && !seen && !dismissedUserIds.current.has(userId)) {
                setVisible(true);
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [isEligible, userId]);

    const dismiss = useCallback(async () => {
        if (!userId) {
            setVisible(false);
            return;
        }

        dismissedUserIds.current.add(userId);
        setVisible(false);
        await markGuestAccountWarningSeen(userId);
    }, [userId]);

    return { visible: isEligible && visible, dismiss };
}
