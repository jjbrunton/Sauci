import { colors } from "../../../theme";
import { SwipeInfoStateLayout } from "./SwipeInfoStateLayout";

interface SwipeNoPacksStateProps {
    onBrowsePacks: () => void;
}

export const SwipeNoPacksState = ({ onBrowsePacks }: SwipeNoPacksStateProps) => {
    const accent = colors.premium.rose;

    return (
        <SwipeInfoStateLayout
            accentColor={accent}
            icon="layers-outline"
            label="GET STARTED"
            title="Choose Packs"
            badgeText="NO PACKS ENABLED"
            description="Select the question packs that interest you and your partner. Each pack explores different aspects of your relationship."
            features={[
                { icon: "flame-outline", text: "From playful to passionate", color: accent },
                { icon: "shield-checkmark-outline", text: "Safe space to explore", color: accent },
                { icon: "infinite-outline", text: "New packs added regularly", color: accent },
            ]}
            teaser="Your journey of discovery awaits"
            action={{
                label: "Browse Packs",
                onPress: onBrowsePacks,
            }}
        />
    );
};
