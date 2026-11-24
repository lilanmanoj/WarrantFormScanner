import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  usePhotoOutput,
} from 'react-native-vision-camera';
import type { Image as NitroImage } from 'react-native-nitro-image';
import { extractWarrantFields } from '../services/gemini';
import { appendRow, parseServiceAccount } from '../services/sheets';
import type { AppSettings } from '../storage';
import { colors, spacing } from '../theme';
import { arrayBufferToBase64 } from '../utils/base64';
import type { SheetTarget } from './HomeScreen';
import { ReviewData, ReviewView } from './ReviewView';

interface Props {
  settings: AppSettings;
  selectedOption: string;
  target: SheetTarget;
  onEnd: () => void;
}

type Phase = 'camera' | 'processing' | 'review';

/** Longest side of the image sent to Gemini – plenty for reading the form. */
const MAX_UPLOAD_SIDE = 2000;

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function ScanScreen({ settings, selectedOption, target, onEnd }: Props) {
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.QHD_4_3,
    containerFormat: 'jpeg',
    quality: 0.9,
  });

  const [phase, setPhase] = useState<Phase>('camera');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [torch, setTorch] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [savedCount, setSavedCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const savedNumbers = useRef(new Set<string>()).current;
  /** Incremented to discard an in-flight Gemini request when the user cancels. */
  const requestId = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const confirmEnd = useCallback(() => {
    if (saving) {
      return;
    }
    Alert.alert('End scanning?', `${savedCount} warrant(s) saved in this session.`, [
      { text: 'Continue scanning', style: 'cancel' },
      { text: 'End scan', style: 'destructive', onPress: onEnd },
    ]);
  }, [onEnd, savedCount, saving]);

  const backToCamera = useCallback(() => {
    requestId.current++;
    setReview(null);
    setPhase('camera');
  }, []);

  // Android back button: review -> reject, processing -> cancel, camera -> end scan.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'review') {
        if (!saving) {
          backToCamera();
        }
      } else if (phase === 'processing') {
        backToCamera();
      } else {
        confirmEnd();
      }
      return true;
    });
    return () => sub.remove();
  }, [phase, saving, backToCamera, confirmEnd]);

  const handleCapture = async () => {
    if (phase !== 'camera') {
      return;
    }
    setPhase('processing');
    const myRequest = ++requestId.current;

    let imagePath = '';
    const images: NitroImage[] = [];
    try {
      // 1. Take the photo and normalise orientation.
      const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
      let image: NitroImage;
      try {
        image = await photo.toImageAsync();
      } finally {
        photo.dispose();
      }
      images.push(image);

      // 2. Downscale for a faster upload.
      const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(image.width, image.height));
      if (scale < 1) {
        image = await image.resizeAsync(
          Math.round(image.width * scale),
          Math.round(image.height * scale),
        );
        images.push(image);
      }

      imagePath = await image.saveToTemporaryFileAsync('jpg', 85);
      const encoded = await image.toEncodedImageDataAsync('jpg', 85);
      const base64 = arrayBufferToBase64(encoded.buffer);

      // 3. Ask Gemini to read the two fields.
      const result = await extractWarrantFields(
        settings.geminiApiKey,
        settings.geminiModel,
        base64,
      );
      if (myRequest !== requestId.current) {
        return; // cancelled
      }
      setReview({
        imagePath,
        warrantNo: result.warrantNo,
        total: result.total,
        message: result.notes,
        extractionFailed: false,
      });
      setPhase('review');
    } catch (e: any) {
      if (myRequest !== requestId.current) {
        return;
      }
      if (!imagePath) {
        // Capture itself failed – stay on the camera.
        Alert.alert('Capture failed', e?.message ?? String(e));
        setPhase('camera');
        return;
      }
      // AI failed – still let the user enter values manually.
      setReview({
        imagePath,
        warrantNo: '',
        total: '',
        message: e?.message ?? String(e),
        extractionFailed: true,
      });
      setPhase('review');
    } finally {
      images.forEach(img => img.dispose());
    }
  };

  const handleAccept = async (warrantNo: string, total: string) => {
    setSaving(true);
    try {
      const sa = parseServiceAccount(settings.serviceAccountJson);
      // Keep "No" numeric in the sheet unless it has a leading zero.
      const noCell: string | number = /^[1-9]\d*$/.test(warrantNo) ? Number(warrantNo) : warrantNo;
      await appendRow(sa, target.spreadsheetId, target.sheetTitle, [
        selectedOption,
        noCell,
        total,
        timestamp(),
      ]);
      savedNumbers.add(warrantNo);
      setSavedCount(c => c + 1);
      setToast(`Saved No ${warrantNo} to "${target.sheetTitle}"`);
      backToCamera();
    } catch (e: any) {
      Alert.alert('Could not save to Google Sheet', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (device == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.centerText}>Looking for the camera…</Text>
        <Pressable style={styles.endButtonStatic} onPress={onEnd}>
          <Text style={styles.endText}>End scan</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        outputs={[photoOutput]}
        isActive={appActive && phase !== 'review'}
        torchMode={torch ? 'on' : 'off'}
        enableNativeTapToFocusGesture
        enableNativeZoomGesture
        onError={e => Alert.alert('Camera error', e.message)}
      />

      {/* Framing guide */}
      <View pointerEvents="none" style={styles.guideWrap}>
        <View style={styles.guide} />
        <Text style={styles.guideText}>
          Fit the whole warrant inside the frame.{'\n'}Make sure "No" (top right) and
          "Total" (bottom right) are sharp.
        </Text>
      </View>

      {/* Floating "End scan" button */}
      <Pressable
        style={[styles.endButton, { top: insets.top + spacing.sm }]}
        onPress={confirmEnd}
        accessibilityRole="button">
        <Text style={styles.endText}>✕  End scan</Text>
      </Pressable>

      <View style={[styles.counter, { top: insets.top + spacing.sm }]}>
        <Text style={styles.counterText}>Saved: {savedCount}</Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.selectedText} numberOfLines={1}>
          {selectedOption}
        </Text>
        <View style={styles.controlsRow}>
          <Pressable
            style={styles.sideButton}
            onPress={() => setTorch(t => !t)}
            disabled={!device.hasTorch}>
            <Text style={[styles.sideText, !device.hasTorch && styles.disabledText]}>
              {torch ? 'Light on' : 'Light off'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
            onPress={handleCapture}
            disabled={phase !== 'camera'}
            accessibilityLabel="Capture warrant">
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.sideButton} />
        </View>
      </View>

      {toast ? (
        <View style={[styles.toast, { top: insets.top + 64 }]}>
          <Text style={styles.toastText}>✓ {toast}</Text>
        </View>
      ) : null}

      {phase === 'processing' ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Reading warrant…</Text>
          <Pressable onPress={backToCamera} style={styles.cancelButton}>
            <Text style={styles.endText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'review' && review ? (
        <ReviewView
          key={review.imagePath}
          data={review}
          selectedOption={selectedOption}
          saving={saving}
          savedNumbers={savedNumbers}
          onAccept={handleAccept}
          onReject={backToCamera}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  centerText: { color: '#fff' },
  guideWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    width: '86%',
    aspectRatio: 9 / 16,
    maxHeight: '72%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
  },
  guideText: {
    position: 'absolute',
    bottom: '16%',
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  endButton: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  endButtonStatic: {
    backgroundColor: colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  endText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  counter: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  counterText: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  sideButton: {
    width: 80,
    alignItems: 'center',
  },
  sideText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledText: { opacity: 0.4 },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.6 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: '90%',
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
  processing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  processingText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
