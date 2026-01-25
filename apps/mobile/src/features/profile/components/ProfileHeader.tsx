import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../../components/ui';
import { colors, featureColors, spacing, typography } from '../../../theme';
import { Profile } from '../../../types';

const ACCENT_GRADIENT = featureColors.profile.gradient as [string, string];

export interface ProfileHeaderProps {
    user: Profile | null;
    isUploadingAvatar: boolean;
    isEditingName: boolean;
    newName: string;
    isUpdatingName: boolean;
    onAvatarPress: () => void;
    onNewNameChange: (text: string) => void;
    onUpdateName: () => void;
    onCancelEditName: () => void;
    onStartEditingName: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    user,
    isUploadingAvatar,
    isEditingName,
    newName,
    isUpdatingName,
    onAvatarPress,
    onNewNameChange,
    onUpdateName,
    onCancelEditName,
    onStartEditingName,
}) => {
    return (
        <Animated.View
            entering={FadeInDown.delay(200).duration(500)}
            style={styles.profileSection}
        >
            <GlassCard variant="elevated">
                <View style={styles.profileContent}>
                    <TouchableOpacity
                        onPress={onAvatarPress}
                        disabled={isUploadingAvatar}
                        activeOpacity={0.7}
                        style={styles.avatarTouchable}
                    >
                        <LinearGradient
                            colors={ACCENT_GRADIENT}
                            style={styles.avatarGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {user?.avatar_url ? (
                                <Image
                                    source={{ uri: user.avatar_url }}
                                    style={styles.avatarImage}
                                    cachePolicy="disk"
                                    transition={200}
                                />
                            ) : (
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {user?.name?.[0]?.toUpperCase() || "U"}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                        {isUploadingAvatar ? (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator size="large" color={colors.text} />
                            </View>
                        ) : (
                            <View style={styles.avatarEditBadge}>
                                <Ionicons name="camera" size={14} color={colors.text} />
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={styles.profileInfo}>
                        {isEditingName ? (
                            <View style={styles.editNameContainer}>
                                <TextInput
                                    style={styles.nameInput}
                                    value={newName}
                                    onChangeText={onNewNameChange}
                                    placeholder="Enter your name"
                                    placeholderTextColor={colors.textTertiary}
                                    autoFocus
                                    editable={!isUpdatingName}
                                    onSubmitEditing={onUpdateName}
                                    returnKeyType="done"
                                />
                                <View style={styles.editNameButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelEditButton}
                                        onPress={onCancelEditName}
                                        disabled={isUpdatingName}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="close" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.saveEditButton}
                                        onPress={onUpdateName}
                                        disabled={isUpdatingName}
                                        activeOpacity={0.7}
                                    >
                                        {isUpdatingName ? (
                                            <ActivityIndicator size="small" color={colors.text} />
                                        ) : (
                                            <Ionicons name="checkmark" size={20} color={colors.text} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.nameContainer}
                                onPress={onStartEditingName}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.name}>{user?.name || "User"}</Text>
                                <View style={styles.editNameIcon}>
                                    <Ionicons name="pencil" size={14} color={colors.textTertiary} />
                                </View>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.email}>{user?.email}</Text>
                    </View>
                </View>
            </GlassCard>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    profileSection: {
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarTouchable: {
        marginRight: spacing.md,
    },
    avatarGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
        // Removed shadows for flat look
    },
    // ...
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.backgroundLight,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    // ...
    cancelEditButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.backgroundLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        backgroundColor: colors.background,
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        ...typography.title1,
        fontSize: 32,
        color: colors.text,
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    profileInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    name: {
        ...typography.title2,
        color: colors.text,
        marginRight: spacing.xs,
    },
    editNameIcon: {
        padding: 4,
    },
    email: {
        ...typography.body,
        color: colors.textSecondary,
        fontSize: 14,
    },
    editNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameInput: {
        ...typography.title2,
        color: colors.text,
        flex: 1,
        paddingVertical: 0,
        paddingHorizontal: 0,
        marginRight: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: featureColors.profile.accent,
    },
    editNameButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    saveEditButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: featureColors.profile.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.xs,
    },

});
