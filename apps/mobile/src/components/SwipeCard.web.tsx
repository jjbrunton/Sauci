import { useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, PanResponder, TouchableOpacity, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { QuestionFeedbackModal } from "./QuestionFeedbackModal";

const MAX_CARD_WIDTH = 400;
const SWIPE_THRESHOLD = 100;

interface Props {
    question: { id: string; text: string; intensity: number; partner_text?: string | null };
    onSwipe: (direction: "left" | "right" | "up" | "down") => void;
}

/**
 * Web-compatible SwipeCard using React Native's built-in PanResponder
 * instead of react-native-gesture-handler which doesn't work on web.
 */
export default function SwipeCard({ question, onSwipe }: Props) {
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = Math.min(screenWidth - 48, MAX_CARD_WIDTH);

    const [dismissed, setDismissed] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    const rotation = translateX.interpolate({
        inputRange: [-cardWidth / 2, cardWidth / 2],
        outputRange: ["-15deg", "15deg"],
        extrapolate: "clamp",
    });

    const rightOverlayOpacity = translateX.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    const leftOverlayOpacity = translateX.interpolate({
        inputRange: [-SWIPE_THRESHOLD, 0],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const upOverlayOpacity = translateY.interpolate({
        inputRange: [-SWIPE_THRESHOLD, 0],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const downOverlayOpacity = translateY.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (_, gestureState) => {
                // Don't activate if touch is in footer area (bottom 100px)
                const CARD_HEIGHT = 500;
                const FOOTER_START_Y = CARD_HEIGHT - 100;
                return gestureState.y0 < FOOTER_START_Y;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Don't activate if touch is in footer area
                const CARD_HEIGHT = 500;
                const FOOTER_START_Y = CARD_HEIGHT - 100;
                return gestureState.y0 < FOOTER_START_Y && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5);
            },
            onPanResponderGrant: () => {
                Animated.timing(scale, {
                    toValue: 1.05,
                    duration: 100,
                    useNativeDriver: true,
                }).start();
            },
            onPanResponderMove: (_, gestureState) => {
                translateX.setValue(gestureState.dx);
                translateY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }).start();

                if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
                    // Horizontal swipe
                    const direction = gestureState.dx > 0 ? "right" : "left";
                    const targetX = direction === "right" ? screenWidth * 1.5 : -screenWidth * 1.5;

                    Animated.spring(translateX, {
                        toValue: targetX,
                        useNativeDriver: true,
                    }).start(() => {
                        setDismissed(true);
                        onSwipe(direction);
                    });
                } else if (gestureState.dy < -SWIPE_THRESHOLD) {
                    // Vertical swipe up
                    Animated.spring(translateY, {
                        toValue: -screenWidth * 1.5,
                        useNativeDriver: true,
                    }).start(() => {
                        setDismissed(true);
                        onSwipe("up");
                    });
                } else if (gestureState.dy > SWIPE_THRESHOLD) {
                    // Vertical swipe down - skip
                    Animated.spring(translateY, {
                        toValue: screenWidth * 1.5,
                        useNativeDriver: true,
                    }).start(() => {
                        setDismissed(true);
                        onSwipe("down");
                    });
                } else {
                    // Reset position
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                        }),
                        Animated.spring(translateY, {
                            toValue: 0,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }
            },
        })
    ).current;

    if (dismissed) {
        return null;
    }

    return (
        <>
            <Animated.View
                style={[
                    styles.card,
                    {
                        width: cardWidth,
                        transform: [
                            { translateX },
                            { translateY },
                            { rotate: rotation },
                            { scale },
                        ],
                    },
                ]}
                {...panResponder.panHandlers}
            >
                {/* Feedback Button */}
                <TouchableOpacity
                    style={styles.feedbackButton}
                    onPress={() => setShowFeedbackModal(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="flag-outline" size={18} color="#888" />
                </TouchableOpacity>

                {/* Overlays */}
                <Animated.View
                    style={[
                        styles.overlay,
                        { opacity: rightOverlayOpacity, backgroundColor: "rgba(76, 175, 80, 0.4)" },
                    ]}
                >
                    <Text style={styles.overlayText}>YES</Text>
                </Animated.View>
                <Animated.View
                    style={[
                        styles.overlay,
                        { opacity: leftOverlayOpacity, backgroundColor: "rgba(244, 67, 54, 0.4)" },
                    ]}
                >
                    <Text style={styles.overlayText}>NO</Text>
                </Animated.View>
                <Animated.View
                    style={[
                        styles.overlay,
                        { opacity: upOverlayOpacity, backgroundColor: "rgba(255, 152, 0, 0.4)" },
                    ]}
                >
                    <Text style={styles.overlayText}>MAYBE</Text>
                </Animated.View>
                <Animated.View
                    style={[
                        styles.overlay,
                        { opacity: downOverlayOpacity, backgroundColor: "rgba(108, 117, 125, 0.4)" },
                    ]}
                >
                    <Text style={styles.overlayText}>SKIP</Text>
                </Animated.View>

                <View style={styles.content}>
                    <View style={styles.intensityContainer}>
                        {[...Array(question.intensity)].map((_, i) => (
                            <Ionicons key={i} name="flame" size={16} color="#e94560" />
                        ))}
                    </View>
                    <Text style={[styles.text, question.is_two_part ? styles.twoPartText : null]}>{question.text}</Text>
                </View>

                <View style={styles.footer}>
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.noButton,
                                hoveredButton === "no" && styles.buttonHovered,
                            ]}
                            onPress={() => onSwipe("left")}
                            onMouseEnter={() => setHoveredButton("no")}
                            onMouseLeave={() => setHoveredButton(null)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.buttonInnerGlow} />
                            <Ionicons name="thumbs-down" size={24} color="#fff" style={styles.buttonIcon} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.maybeButton,
                                hoveredButton === "maybe" && styles.buttonHovered,
                            ]}
                            onPress={() => onSwipe("up")}
                            onMouseEnter={() => setHoveredButton("maybe")}
                            onMouseLeave={() => setHoveredButton(null)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.buttonInnerGlow} />
                            <Ionicons name="help-circle" size={24} color="#fff" style={styles.buttonIcon} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.yesButton,
                                hoveredButton === "yes" && styles.buttonHovered,
                            ]}
                            onPress={() => onSwipe("right")}
                            onMouseEnter={() => setHoveredButton("yes")}
                            onMouseLeave={() => setHoveredButton(null)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.buttonInnerGlow} />
                            <Ionicons name="thumbs-up" size={24} color="#fff" style={styles.buttonIcon} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>

            <QuestionFeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                questionId={question.id}
                questionText={question.text}
            />
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        position: "absolute",
        height: 500,
        maxWidth: MAX_CARD_WIDTH,
        backgroundColor: "#16213e",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#0f3460",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        overflow: "hidden",
        cursor: "grab",
    },
    feedbackButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    intensityContainer: {
        flexDirection: "row",
        marginBottom: 24,
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    text: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        lineHeight: 32,
    },
    twoPartText: {
        fontSize: 20,
        lineHeight: 28,
    },
    footer: {
        paddingTop: 8,
        paddingBottom: 16,
        paddingHorizontal: 8,
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.2)",
    },
    hint: {
        color: "#666",
        fontSize: 12,
        marginBottom: 4,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    overlayText: {
        fontSize: 48,
        fontWeight: "900",
        color: "#fff",
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        transform: [{ rotate: "-15deg" }],
        borderWidth: 4,
        borderColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    partnerContainer: {
        width: "100%",
        alignItems: "center",
    },
    divider: {
        height: 1,
        width: "80%",
        backgroundColor: "rgba(255,255,255,0.1)",
        marginVertical: 24,
        position: "relative",
        justifyContent: "center",
        alignItems: "center",
    },
    dividerText: {
        color: "#666",
        backgroundColor: "#16213e",
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: "bold",
        position: "absolute",
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 32,
        paddingVertical: 16,
        gap: 20,
    },
    actionButton: {
        alignItems: "center",
        justifyContent: "center",
        width: 64,
        height: 64,
        borderRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 2,
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    noButton: {
        backgroundColor: "#E74C3C",
        borderColor: "rgba(255, 255, 255, 0.3)",
    },
    maybeButton: {
        backgroundColor: "#F39C12",
        borderColor: "rgba(255, 255, 255, 0.3)",
    },
    yesButton: {
        backgroundColor: "#2ECC71",
        borderColor: "rgba(255, 255, 255, 0.3)",
    },
    buttonInnerGlow: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "50%",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    buttonIcon: {
        zIndex: 1,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    buttonHovered: {
        transform: [{ scale: 1.1 }],
        shadowOpacity: 0.6,
        shadowRadius: 12,
    },
});
