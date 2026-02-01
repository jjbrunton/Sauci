import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Linking,
  Share,
  Image,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { colors, gradients, radius, typography, spacing, blur } from '../../../theme';

const logo = require('../../../../assets/logo.png');

const MAX_CARD_WIDTH = 340;

interface DrawingShareModalProps {
  visible: boolean;
  onClose: () => void;
  drawingUri: string | null;
}

export function DrawingShareModal({
  visible,
  onClose,
  drawingUri,
}: DrawingShareModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 64, MAX_CARD_WIDTH);
  const shareViewRef = useRef<ViewShot>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Capture the branded card when modal becomes visible and drawing is ready
  useEffect(() => {
    if (visible && drawingUri && shareViewRef.current) {
      setIsCapturing(true);
      const timer = setTimeout(async () => {
        try {
          const uri = await shareViewRef.current?.capture?.();
          if (uri) {
            setCapturedUri(uri);
          }
        } catch (error) {
          console.error('Error capturing share image:', error);
        } finally {
          setIsCapturing(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, drawingUri]);

  useEffect(() => {
    if (!visible) {
      setCapturedUri(null);
    }
  }, [visible]);

  const handleInstagramShare = async () => {
    if (!capturedUri) return;

    try {
      const instagramUrl = 'instagram://app';
      const canOpenInstagram = await Linking.canOpenURL(instagramUrl);

      if (canOpenInstagram && Platform.OS === 'ios') {
        const instagramStoriesUrl = `instagram-stories://share?source_application=com.sauci.app`;
        await Linking.openURL(instagramStoriesUrl);
      } else {
        await handleMoreShare();
      }
    } catch (error) {
      console.error('Instagram share error:', error);
      await handleMoreShare();
    }
  };

  const handleMessagesShare = async () => {
    if (!capturedUri) {
      await Share.share({ message: 'Check out our drawing on sauci.app' });
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(capturedUri, {
          mimeType: 'image/png',
          UTI: 'public.png',
        });
      } else {
        await handleMoreShare();
      }
    } catch (error) {
      console.error('Messages share error:', error);
      await Share.share({ message: 'Check out our drawing on sauci.app' });
    }
  };

  const handleMoreShare = async () => {
    if (!capturedUri) {
      await Share.share({ message: 'Check out our drawing on sauci.app' });
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(capturedUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share drawing',
        });
      } else {
        await Share.share({ message: 'Check out our drawing on sauci.app' });
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const useBlur = Platform.OS === 'ios';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          {useBlur ? (
            <BlurView
              intensity={blur.heavy}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.backdropFallback} />
          )}
        </Animated.View>

        {/* Content */}
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.duration(200)}
          style={[styles.content, { paddingTop: insets.top }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Share</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Branded Card Preview */}
          <View style={styles.previewContainer}>
            <ViewShot
              ref={shareViewRef}
              options={{
                format: 'png',
                quality: 1,
                result: 'tmpfile',
              }}
            >
              <View style={[styles.shareableCard, { width: cardWidth }]}>
                <LinearGradient
                  colors={gradients.primary as [string, string]}
                  style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                {/* Drawing image */}
                {drawingUri && (
                  <View style={styles.drawingContainer}>
                    <Image
                      source={{ uri: drawingUri }}
                      style={styles.drawingImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* Branding footer */}
                <View style={styles.branding}>
                  <Image source={logo} style={styles.brandingLogo} />
                  <Text style={styles.brandingText}>sauci.app</Text>
                </View>
              </View>
            </ViewShot>
          </View>

          {/* Share Actions */}
          <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <ShareActionButton
              icon="logo-instagram"
              label="Instagram"
              buttonColors={['#833AB4', '#FD1D1D', '#F77737']}
              onPress={handleInstagramShare}
              disabled={isCapturing}
            />
            <ShareActionButton
              icon="chatbubble-ellipses"
              label="Messages"
              buttonColors={['#34C759', '#30D158']}
              onPress={handleMessagesShare}
              disabled={isCapturing}
            />
            <ShareActionButton
              icon="share-outline"
              label="More"
              buttonColors={[colors.glass.backgroundLight, colors.glass.backgroundLight]}
              onPress={handleMoreShare}
              disabled={isCapturing}
              isOutline
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ShareActionButton({
  icon,
  label,
  buttonColors,
  onPress,
  disabled,
  isOutline,
}: {
  icon: string;
  label: string;
  buttonColors: string[];
  onPress: () => void;
  disabled?: boolean;
  isOutline?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[
        styles.actionIconContainer,
        isOutline && styles.actionIconOutline,
      ]}>
        {!isOutline && (
          <LinearGradient
            colors={buttonColors as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <Ionicons
          name={icon as any}
          size={28}
          color={colors.text}
        />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropFallback: {
    flex: 1,
    backgroundColor: 'rgba(13, 13, 26, 0.95)',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.headline,
    color: colors.text,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  shareableCard: {
    aspectRatio: 0.7,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  drawingContainer: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  drawingImage: {
    flex: 1,
    width: '100%',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  brandingLogo: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  brandingText: {
    ...typography.subhead,
    color: colors.text,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionIconOutline: {
    backgroundColor: colors.glass.backgroundLight,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  actionLabel: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '500',
  },
});
