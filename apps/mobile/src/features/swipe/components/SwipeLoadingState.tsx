import { ActivityIndicator, StyleSheet, View } from "react-native";

import { GradientBackground } from "../../../components/ui";
import { colors } from "../../../theme";

export const SwipeLoadingState = () => (
    <GradientBackground>
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    </GradientBackground>
);

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
