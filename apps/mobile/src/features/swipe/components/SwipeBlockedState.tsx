import { colors } from "../../../theme";
import { SwipeInfoStateLayout } from "./SwipeInfoStateLayout";

interface SwipeBlockedStateProps {
    unansweredCount: number;
    onCheckAgain: () => void;
}

export const SwipeBlockedState = ({ unansweredCount, onCheckAgain }: SwipeBlockedStateProps) => {
    const accent = colors.premium.rose;

    return (
        <SwipeInfoStateLayout
            accentColor={accent}
            icon="hourglass-outline"
            label="PATIENCE"
            title="Waiting"
            badgeText={`${unansweredCount} UNANSWERED`}
            description={`You're ahead by ${unansweredCount} questions. Give your partner some time to catch up so you can discover matches together.`}
            features={[
                { icon: "heart-outline", text: "Matches happen together", color: accent },
                { icon: "notifications-outline", text: "We'll notify your partner", color: accent },
                { icon: "refresh-outline", text: "Check back anytime", color: accent },
            ]}
            teaser="Good things come to those who wait"
            action={{
                label: "Check Again",
                onPress: onCheckAgain,
                variant: "secondary",
            }}
        />
    );
};
