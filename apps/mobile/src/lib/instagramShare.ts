import { Linking, Platform } from "react-native";
import Share, { Social } from "react-native-share";

// Instagram requires a registered Facebook App ID for the Stories share flow
// (https://developers.facebook.com/docs/instagram/sharing-to-stories/).
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

const INSTAGRAM_ANDROID_PACKAGE = "com.instagram.android";

async function isInstagramStoriesAvailable(): Promise<boolean> {
    if (!facebookAppId) return false;

    try {
        if (Platform.OS === "ios") {
            return await Linking.canOpenURL("instagram-stories://share");
        }
        if (Platform.OS === "android") {
            const { isInstalled } = await Share.isPackageInstalled(INSTAGRAM_ANDROID_PACKAGE);
            return isInstalled;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Share a locally captured image (file:// URI) to Instagram Stories as the
 * story background. Returns true when the share was handed off to Instagram,
 * false when Instagram Stories sharing is unavailable (not installed, no
 * Facebook App ID configured, or the user dismissed the native prompt) so
 * callers can fall back to the system share sheet.
 */
export async function shareToInstagramStories(imageUri: string): Promise<boolean> {
    if (!(await isInstagramStoriesAvailable())) return false;

    try {
        const result = await Share.shareSingle({
            social: Social.InstagramStories,
            appId: facebookAppId as string,
            backgroundImage: imageUri,
        });
        return result.success !== false;
    } catch (error) {
        console.error("Instagram Stories share error:", error);
        return false;
    }
}
