import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { HomeScreen, SheetTarget } from './src/screens/HomeScreen';
import { PermissionScreen } from './src/screens/PermissionScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  activeCategoryNames,
  AppState as PersistedState,
  AppSettings,
  Category,
  loadAppState,
  saveCategories,
  saveSelectedOption,
  saveSettings,
  saveSheetUrl,
} from './src/storage';
import { colors } from './src/theme';

type Route =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'categories' }
  | { name: 'scan'; target: SheetTarget };

function AppContent() {
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();
  const [state, setState] = useState<PersistedState | null>(null);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const sheetUrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAppState().then(setState);
  }, []);

  // Android back: Category Data -> Settings -> Home (Scan screen handles its own back).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'categories') {
        setRoute({ name: 'settings' });
        return true;
      }
      if (route.name === 'settings') {
        setRoute({ name: 'home' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route.name]);

  const handleSheetUrlChange = useCallback((url: string) => {
    setState(s => (s ? { ...s, sheetUrl: url } : s));
    // Debounce writes while typing/pasting.
    if (sheetUrlTimer.current) {
      clearTimeout(sheetUrlTimer.current);
    }
    sheetUrlTimer.current = setTimeout(() => saveSheetUrl(url.trim()), 400);
  }, []);

  const handleSelectedOptionChange = useCallback((value: string) => {
    setState(s => (s ? { ...s, selectedOption: value } : s));
    saveSelectedOption(value);
  }, []);

  const handleSaveSettings = useCallback(async (settings: AppSettings) => {
    await saveSettings(settings);
    setState(s => (s ? { ...s, settings } : s));
  }, []);

  const handleCategoriesChange = useCallback((categories: Category[]) => {
    setState(s => (s ? { ...s, categories } : s));
    saveCategories(categories);
  }, []);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe}>
        <PermissionScreen
          canRequestPermission={canRequestPermission}
          requestPermission={requestPermission}
        />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const categoryOptions = activeCategoryNames(state.categories);
  // A category that was deactivated or deleted is no longer selectable.
  const selectedCategory = categoryOptions.includes(state.selectedOption)
    ? state.selectedOption
    : '';

  if (route.name === 'scan') {
    // Full-screen camera; manages its own safe-area insets.
    return (
      <>
        <StatusBar barStyle="light-content" />
        <ScanScreen
          settings={state.settings}
          selectedOption={selectedCategory}
          target={route.target}
          onEnd={() => setRoute({ name: 'home' })}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {route.name === 'settings' || route.name === 'categories' ? (
        <>
          {/* Kept mounted while Category Data is open so unsaved Settings edits survive. */}
          <View style={route.name === 'categories' ? styles.hidden : styles.flex}>
            <SettingsScreen
              settings={state.settings}
              categoryCount={state.categories.length}
              activeCategoryCount={categoryOptions.length}
              onOpenCategories={() => setRoute({ name: 'categories' })}
              onSave={handleSaveSettings}
              onBack={() => setRoute({ name: 'home' })}
            />
          </View>
          {route.name === 'categories' ? (
            <CategoriesScreen
              categories={state.categories}
              onChange={handleCategoriesChange}
              onBack={() => setRoute({ name: 'settings' })}
            />
          ) : null}
        </>
      ) : (
        <HomeScreen
          settings={state.settings}
          categoryOptions={categoryOptions}
          sheetUrl={state.sheetUrl}
          onSheetUrlChange={handleSheetUrlChange}
          selectedOption={selectedCategory}
          onSelectedOptionChange={handleSelectedOptionChange}
          onOpenSettings={() => setRoute({ name: 'settings' })}
          onStartScan={target => setRoute({ name: 'scan', target })}
        />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
