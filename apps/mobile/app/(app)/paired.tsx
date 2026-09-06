import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { GradientBackground, GlassButton } from "../../src/components/ui";
import { colors, gradients, spacing, typography } from "../../src/theme";
import { useAuthStore, useMatchStore } from "../../src/store";
import { markPairedUnlockSeen } from "../../src/lib/pairedUnlockSeen";
import { Events } from "../../src/lib/analytics";

export const POST_PAIR_ENTRY = "/(app)/swipe" as const;
const bucket = (n: number) => n === 0 ? "0" : n <= 2 ? "1-2" : n <= 5 ? "3-5" : n <= 10 ? "6-10" : n <= 25 ? "11-25" : "26+";

export default function PairedScreen() {
    const { user, couple, partner } = useAuthStore();
    const { newMatchesCount, fetchMatches } = useMatchStore();
    const [ready, setReady] = useState(false);
    const { role: rawRole } = useLocalSearchParams<{ role?: "inviter" | "joiner" }>();
    const heading = useRef<Text>(null);
    const role = rawRole === "inviter" ? "inviter" : "joiner";

    useEffect(() => {
        void fetchMatches(true).finally(() => setReady(true));
    }, [fetchMatches]);
    useEffect(() => {
        if (!ready || !user || !couple) return;
        void markPairedUnlockSeen(user.id, couple.id);
        Events.pairingUnlockViewed(role, bucket(newMatchesCount));
        const timer = setTimeout(() => {
            if (heading.current) AccessibilityInfo.setAccessibilityFocus(heading.current as never);
        }, 250);
        return () => clearTimeout(timer);
    }, [ready, user, couple, newMatchesCount]);

    const partnerName = partner?.name?.split(" ")[0] || "your partner";
    const viewMatches = () => { Events.pairingUnlockCtaTapped(role, "view_matches"); router.replace("/(app)/matches"); };
    const start = () => { Events.pairingUnlockCtaTapped(role, "start_session"); router.replace(POST_PAIR_ENTRY); };
    const dismiss = () => { Events.pairingUnlockCtaTapped(role, "dismiss"); router.replace("/(app)"); };
    if (!ready) {
        return <GradientBackground><View style={styles.container}><ActivityIndicator size="large" color={colors.primary} /></View></GradientBackground>;
    }
    return <GradientBackground><View style={styles.container}>
        <LinearGradient colors={gradients.primary as [string, string]} style={styles.icon}><Ionicons name="heart" size={42} color={colors.text} /></LinearGradient>
        <Text ref={heading} accessibilityRole="header" style={styles.title}>You're paired with {partnerName}</Text>
        {newMatchesCount > 0 ? <><Text style={styles.count}>{newMatchesCount} thing{newMatchesCount === 1 ? "" : "s"} you already agree on</Text><Text style={styles.body}>From answers you both gave before now.</Text><GlassButton fullWidth onPress={viewMatches} testID="paired-view-matches">See what you agree on</GlassButton><GlassButton variant="secondary" fullWidth onPress={start} testID="paired-start-session">Start a session</GlassButton></> : <><Text style={styles.body}>Nothing to compare yet. Answer a few questions and anything you agree on shows up here.</Text><GlassButton fullWidth onPress={start} testID="paired-start-session">Answer your first questions</GlassButton></>}
        <TouchableOpacity onPress={dismiss} testID="paired-not-now" style={styles.dismiss}><Text style={styles.dismissText}>Not now</Text></TouchableOpacity>
    </View></GradientBackground>;
}
const styles = StyleSheet.create({ container:{flex:1,justifyContent:"center",padding:spacing.xl,gap:spacing.lg,alignItems:"center"}, icon:{width:88,height:88,borderRadius:44,alignItems:"center",justifyContent:"center"}, title:{...typography.largeTitle,color:colors.text,textAlign:"center"}, count:{...typography.title2,color:colors.premium.rose,textAlign:"center"}, body:{...typography.callout,color:colors.textSecondary,textAlign:"center"}, dismiss:{minHeight:44,justifyContent:"center",paddingHorizontal:spacing.lg}, dismissText:{...typography.subhead,color:colors.textSecondary} });
