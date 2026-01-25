import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme";

export const SwipeUploadOverlay = () => (
    <View style={styles.uploadOverlay}>
        <View style={styles.uploadSpinnerContainer}>
            <ActivityIndicator size="large" color={colors.premium.gold} />
            <Text style={styles.uploadText}>Uploading...</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    uploadOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadSpinnerContainer: {
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderRadius: radius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    uploadText: {
        ...typography.subhead,
        color: colors.text,
        marginTop: spacing.sm,
    },
});
