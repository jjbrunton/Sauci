import { colors } from "../../../theme";
import { SwipeInfoStateLayout } from "./SwipeInfoStateLayout";

interface SwipeNoPartnerStateProps {
    hasCouple: boolean;
    onPairPress: () => void;
}

export const SwipeNoPartnerState = ({ hasCouple, onPairPress }: SwipeNoPartnerStateProps) => {
    const accent = colors.premium.rose;

    return (
        <SwipeInfoStateLayout
            accentColor={accent}
            icon="heart"
            label={hasCouple ? "ALMOST THERE" : "CONNECT"}
            title={hasCouple ? "Waiting" : "Pair Up"}
            badgeText={hasCouple ? "INVITE SENT" : "MADE FOR TWO"}
            description={hasCouple
                ? "Share your invite code so they can join you. Once paired, you'll both answer questions and discover what you agree on!"
                : "Sauci is made for two! Connect with your partner to start answering questions together and discover what you have in common."
            }
            features={[
                { icon: "lock-closed-outline", text: "Private and secure", color: accent },
                { icon: "sparkles", text: "Discover hidden desires", color: accent },
                { icon: "chatbubble-ellipses-outline", text: "Chat about your matches", color: accent },
            ]}
            teaser={hasCouple ? "Your partner is just a code away" : "Begin your intimate journey together"}
            action={{
                label: hasCouple ? "View Invite Code" : "Pair Now",
                onPress: onPairPress,
            }}
        />
    );
};
