import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolate,
    withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface Props {
    question: { id: string; text: string; intensity: number; partner_text?: string | null };
    onSwipe: (direction: "left" | "right" | "up") => void;
}

export default function SwipeCard({ question, onSwipe }: Props) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    const context = useSharedValue({ x: 0, y: 0 });

    const gesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .activeOffsetY([-15, 15])
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
            scale.value = withTiming(1.05);
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
            rotation.value = interpolate(
                translateX.value,
                [-SCREEN_WIDTH / 2, SCREEN_WIDTH / 2],
                [-15, 15],
                Extrapolate.CLAMP
            );
        })
        .onEnd(() => {
            scale.value = withTiming(1);

            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                // Horizontal swipe (YES/NO)
                const direction = translateX.value > 0 ? "right" : "left";
                translateX.value = withSpring(direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5);
                runOnJS(onSwipe)(direction);
            } else if (translateY.value < -SWIPE_THRESHOLD) {
                // Vertical swipe up (MAYBE)
                translateY.value = withSpring(-SCREEN_WIDTH * 1.5);
                runOnJS(onSwipe)("up");
            } else {
                // Reset
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                rotation.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    const overlayStyle = (direction: "left" | "right" | "up", color: string) =>
        useAnimatedStyle(() => {
            let opacity = 0;
            if (direction === "right") {
                opacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]);
            } else if (direction === "left") {
                opacity = interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1]);
            } else {
                opacity = interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 1]);
            }

            return {
                opacity,
                backgroundColor: color,
            };
        });

    return (
        <View style={styles.cardWrapper}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.card, animatedStyle]}>
                    {/* Overlays */}
                    <Animated.View style={[styles.overlay, overlayStyle("right", "rgba(76, 175, 80, 0.4)")]}>
                        <Text style={styles.overlayText}>YES</Text>
                    </Animated.View>
                    <Animated.View style={[styles.overlay, overlayStyle("left", "rgba(244, 67, 54, 0.4)")]}>
                        <Text style={styles.overlayText}>NO</Text>
                    </Animated.View>
                    <Animated.View style={[styles.overlay, overlayStyle("up", "rgba(255, 152, 0, 0.4)")]}>
                        <Text style={styles.overlayText}>MAYBE</Text>
                    </Animated.View>

                    <View style={styles.content}>
                        <View style={styles.intensityContainer}>
                            {[...Array(question.intensity)].map((_, i) => (
                                <Ionicons key={i} name="flame" size={16} color="#e94560" />
                            ))}
                        </View>
                        <Text style={[styles.text, question.is_two_part ? styles.twoPartText : null]}>{question.text}</Text>
                    </View>
                </Animated.View>
            </GestureDetector>
            
            <View style={styles.footer}>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.noButton]}
                        onPress={() => onSwipe("left")}
                        activeOpacity={0.7}
                    >
                        <View style={styles.buttonInnerGlow} />
                        <Ionicons name="thumbs-down" size={24} color="#fff" style={styles.buttonIcon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.maybeButton]}
                        onPress={() => onSwipe("up")}
                        activeOpacity={0.7}
                    >
                        <View style={styles.buttonInnerGlow} />
                        <Ionicons name="help-circle" size={24} color="#fff" style={styles.buttonIcon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.yesButton]}
                        onPress={() => onSwipe("right")}
                        activeOpacity={0.7}
                    >
                        <View style={styles.buttonInnerGlow} />
                        <Ionicons name="thumbs-up" size={24} color="#fff" style={styles.buttonIcon} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        position: "absolute",
        width: SCREEN_WIDTH - 48,
        height: 500,
    },
    card: {
        width: "100%",
        height: 500,
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
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 8,
        paddingBottom: 16,
        paddingHorizontal: 8,
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.2)",
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
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
        zIndex: 21,
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
        zIndex: 22,
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
});
