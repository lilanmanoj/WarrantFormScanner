import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Everything the app persists between restarts.
 * Stored in AsyncStorage (app-private storage on the device).
 */
export interface AppSettings {
  /** Gemini API key (from Google AI Studio). */
  geminiApiKey: string;
  /** Gemini model id, e.g. "models/gemini-2.5-flash". */
  geminiModel: string;
  /** Google Cloud service-account key JSON used to write to Google Sheets. */
  serviceAccountJson: string;
}

/** A predefined value for the Category dropdown, managed on the Category Data screen. */
export interface Category {
  id: string;
  name: string;
  /** Only active categories are offered on the home screen. */
  active: boolean;
}

export interface AppState {
  settings: AppSettings;
  /** In the user's sort order. */
  categories: Category[];
  sheetUrl: string;
  /** Name of the selected category. */
  selectedOption: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  geminiModel: '',
  serviceAccountJson: '',
};

const KEYS = {
  settings: 'wfs.settings.v1',
  categories: 'wfs.categories.v1',
  sheetUrl: 'wfs.sheetUrl.v1',
  selectedOption: 'wfs.selectedOption.v1',
} as const;

export function newCategoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Active categories, in the user's order. */
export function activeCategoryNames(categories: Category[]): string[] {
  return categories.filter(c => c.active).map(c => c.name);
}

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined; // Corrupt value – caller falls back to defaults.
  }
}

export async function loadAppState(): Promise<AppState> {
  const stored = await AsyncStorage.getMany([
    KEYS.settings,
    KEYS.categories,
    KEYS.sheetUrl,
    KEYS.selectedOption,
  ]);

  const rawSettings = parseJson<Partial<AppSettings> & { dropdownOptions?: string[] }>(
    stored[KEYS.settings],
  );
  const { dropdownOptions: legacyOptions, ...settingsRest } = rawSettings ?? {};
  const settings: AppSettings = { ...DEFAULT_SETTINGS, ...settingsRest };

  let categories = parseJson<Category[]>(stored[KEYS.categories]);
  if (!Array.isArray(categories)) {
    // Migrate values from the earlier "Dropdown values" setting, if any.
    categories = (legacyOptions ?? []).map(name => ({
      id: newCategoryId(),
      name,
      active: true,
    }));
  }

  return {
    settings,
    categories,
    sheetUrl: stored[KEYS.sheetUrl] ?? '',
    selectedOption: stored[KEYS.selectedOption] ?? '',
  };
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function saveCategories(categories: Category[]): Promise<void> {
  return AsyncStorage.setItem(KEYS.categories, JSON.stringify(categories));
}

export function saveSheetUrl(url: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.sheetUrl, url);
}

export function saveSelectedOption(value: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.selectedOption, value);
}
