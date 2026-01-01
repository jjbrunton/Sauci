import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

export default function PacksLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "fade",
                animationDuration: 150,
            }}
        />
    );
}
