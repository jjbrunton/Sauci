import { SwipeInfoStateLayout } from "../../swipe/components/SwipeInfoStateLayout";
import { colors } from "../../../theme";

interface QuizWaitingStateProps {
    onNudgePartner: () => void;
    onRefresh: () => void;
}

export function QuizWaitingState({ onNudgePartner, onRefresh }: QuizWaitingStateProps) {
    return (
        <SwipeInfoStateLayout
            accentColor={colors.premium.rose}
            icon="checkmark-circle"
            label="NICE WORK"
            title="Your answers are in"
            badgeText="WAITING ON YOUR PARTNER"
            description="Nudge your partner to finish the quiz so you can both see how well you know each other."
            features={[
                { icon: "hourglass-outline", text: "Results unlock once you both finish" },
                { icon: "heart-outline", text: "Share your match score together" },
            ]}
            teaser="Almost there"
            action={{ label: "Nudge your partner", onPress: onNudgePartner }}
            secondaryAction={{ label: "Refresh", onPress: onRefresh, icon: "refresh-outline" }}
        />
    );
}
