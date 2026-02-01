import { useCallback, useRef } from 'react';
import type { SkImage } from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

interface UseCanvasCaptureReturn {
  makeSnapshot: React.MutableRefObject<(() => SkImage | null) | null>;
  saveToGallery: () => Promise<boolean>;
  captureToFile: () => Promise<string | null>;
}

export function useCanvasCapture(): UseCanvasCaptureReturn {
  const makeSnapshot = useRef<(() => SkImage | null) | null>(null);

  const captureToFile = useCallback(async (): Promise<string | null> => {
    if (!makeSnapshot.current) return null;

    try {
      const image = makeSnapshot.current();
      if (!image) return null;

      const base64 = image.encodeToBase64();
      if (!base64) return null;

      const fileUri = `${FileSystem.cacheDirectory}livedraw_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return fileUri;
    } catch (err) {
      console.error('Canvas capture error:', err);
      return null;
    }
  }, []);

  const saveToGallery = useCallback(async (): Promise<boolean> => {
    try {
      const fileUri = await captureToFile();
      if (!fileUri) return false;

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return false;

      await MediaLibrary.saveToLibraryAsync(fileUri);
      return true;
    } catch (err) {
      console.error('Canvas capture error:', err);
      return false;
    }
  }, [captureToFile]);

  return { makeSnapshot, saveToGallery, captureToFile };
}
