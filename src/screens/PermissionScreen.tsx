import React, { useEffect } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme';

interface Props {
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

/** Shown until camera permission is granted. */
export function PermissionScreen({ canRequestPermission, requestPermission }: Props) {
  // Ask right away on first launch.
  useEffect(() => {
    if (canRequestPermission) {
      requestPermission();
    }
  }, [canRequestPermission, requestPermission]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera access needed</Text>
      <Text style={styles.body}>
        Warrant Form Scanner uses the camera to photograph warrant forms and read
        the "No" and "Total" fields.
      </Text>
      {canRequestPermission ? (
        <Button title="Allow camera access" onPress={requestPermission} />
      ) : (
        <>
          <Text style={styles.body}>
            Camera permission was denied. Enable it in the system settings for this
            app, then come back.
          </Text>
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
