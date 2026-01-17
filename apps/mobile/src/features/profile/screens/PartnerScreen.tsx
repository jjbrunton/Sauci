import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { useAuthStore } from '../../../store';
import { useCoupleManagement } from '../hooks';
import { ScreenHeader, CoupleStatus, RelationshipDangerZone } from '../components';

/**
 * Partner/relationship management sub-screen.
 */
export function PartnerScreen() {
    const { partner, couple } = useAuthStore();
    const {
        handleUnpair,
        handleDeleteRelationship,
        handleResetProgress,
        navigateToPairing,
    } = useCoupleManagement();

    return (
        <GradientBackground>
            <ScreenHeader title="Partner" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Partner Info */}
                <CoupleStatus
                    partner={partner}
                    couple={couple}
                    onUnpair={handleUnpair}
                    onPairingPress={navigateToPairing}
                />

                {/* Relationship Danger Zone - only show if in a relationship */}
                {couple && (
                    <>
                        <View style={styles.spacer} />
                        <RelationshipDangerZone
                            onResetProgress={handleResetProgress}
                            onDeleteRelationship={handleDeleteRelationship}
                        />
                    </>
                )}
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    spacer: {
        height: spacing.lg,
    },
});

export default PartnerScreen;
