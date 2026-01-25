import { colors } from "../../../theme";
import { SwipeInfoStateLayout, type FeatureItem } from "./SwipeInfoStateLayout";

interface SwipeCaughtUpStateProps {
    isPendingMode: boolean;
    isPackMode: boolean;
    packName?: string | null;
    onViewMatches: () => void;
    onBackToHome: () => void;
    onRefresh: () => void;
}

export const SwipeCaughtUpState = ({
    isPendingMode,
    isPackMode,
    packName,
    onViewMatches,
    onBackToHome,
    onRefresh,
}: SwipeCaughtUpStateProps) => {
    const accent = colors.premium.rose;

    const label = isPendingMode ? 'QUEUE COMPLETE' : isPackMode ? 'PACK COMPLETE' : 'COMPLETE';
    const title = isPendingMode ? 'All Caught Up!' : isPackMode ? packName || 'Pack Complete' : 'All Caught Up';
    const badgeText = isPendingMode ? 'YOUR TURN COMPLETE' : isPackMode ? 'ALL QUESTIONS ANSWERED' : "YOU'RE AHEAD";
    const description = isPendingMode
        ? "You've answered all the questions your partner swiped on. Nice work! Check back later for more."
        : isPackMode
        ? "You've answered all questions in this pack. Head home to discover more!"
        : "You've answered all available questions. New questions are added regularly, or explore different packs from home.";
    const teaser = isPendingMode
        ? 'Your partner will love that you caught up'
        : isPackMode
        ? 'Discover more ways to connect'
        : 'More ways to connect are on the way';

    const features: FeatureItem[] = isPendingMode
        ? [
            { icon: 'heart', text: 'Check your matches', color: accent },
            { icon: 'chatbubbles-outline', text: 'Chat about discoveries', color: accent },
            { icon: 'sparkles', text: 'Keep exploring together', color: accent },
        ]
        : [
            { icon: 'sparkles', text: 'New questions weekly', color: accent },
            { icon: 'home-outline', text: 'Explore from home', color: accent },
            { icon: 'chatbubbles-outline', text: 'Chat about your matches', color: accent },
        ];

    const action = isPendingMode
        ? { label: 'View Matches', onPress: onViewMatches }
        : isPackMode
        ? { label: 'Back to Home', onPress: onBackToHome }
        : { label: 'Refresh Questions', onPress: onRefresh, variant: 'secondary' as const };

    return (
        <SwipeInfoStateLayout
            accentColor={accent}
            icon="checkmark"
            label={label}
            title={title}
            badgeText={badgeText}
            description={description}
            features={features}
            teaser={teaser}
            action={action}
        />
    );
};
