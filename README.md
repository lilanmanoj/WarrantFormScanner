# Warrant Form Scanner

A React Native app that scans Sri Lanka Government Railway **Passenger Warrant** forms
with the phone camera. It reads two fields, either on the phone (built-in reader) or with
Google Gemini, lets you review and fix them, and adds them as a new row in a Google Sheet.
Warrants can also be typed in by hand with **Manual Enter**.

| Field     | Where on the form                                        | Example   |
|-----------|----------------------------------------------------------|-----------|
| **No**    | Printed, top-right, after `D/1`                          | `282681`  |
| **Total** | Handwritten, bottom-right, "Total" row in the Amount column (Rs : c) | `2050:00` |

## How it works

1. **Camera permission.** The app asks for it at launch and only continues once it is granted.
2. **Home screen**
   - **Category** dropdown: the category written to every row. Only *active* categories appear, in your chosen order.
   - **Google Sheet URL**: paste the sheet link. Rows go to the tab in the URL (`#gid=…`), or to the first tab.
   - **Settings**, **Start scan** and **Manual Enter** buttons.
3. **Scan.** Fit the warrant in the frame and press the shutter. The selected reader (see below) reads the photo.
4. **Review.** The photo, the selected category, and editable *No* / *Total* fields are shown.
   - **Accept** appends a row to the sheet, then returns to the camera for the next warrant.
   - **Reject** discards the photo and returns to the camera.
5. **End scan.** The floating button at the top of the camera view returns to the home screen.
6. **Manual Enter.** A form with *Category*, *No* and *Total*.
   - **Next** adds the row to the sheet and clears No / Total for the next warrant.
   - The category starts as the home-screen selection. Changing it here also changes it on the home screen.
   - **Done Edit** (top right) returns to the home screen. It asks first if there is unsaved input.

### Scan readers (Settings → Scan reader)

| | Built-in (on-device) | Gemini AI |
|---|---|---|
| **No** (printed) | ✅ read on the phone, typically under a second | ✅ |
| **Total** (handwritten) | ❌ you type it; the cursor starts in the Total field | ✅ |
| Internet / API key | Not needed | Needed |
| Speed | Fast | A few seconds per scan |

The built-in reader uses Google ML Kit text recognition, with the model bundled in the app,
on a zoomed crop of the form's top-right corner. It read the No correctly on all 8 sample
warrants. ML Kit's on-device model only reads printed text: on the samples it misread or
missed the handwritten Totals (for example `3300` read as `930`). So the built-in reader
leaves Total empty rather than pre-filling a wrong amount. The built-in reader is Android-only.

Settings, categories, the sheet URL and the selected category are kept in AsyncStorage, so they survive app restarts.

### Row format

| A (Category)    | B (No)   | C (Total) | D (Scanned at)        |
|-----------------|----------|-----------|-----------------------|
| category        | 282681   | 2050:00   | 2026-11-24 15:10:02   |

Values are written with `valueInputOption=RAW`, so `2050:00` is stored exactly as typed
instead of being turned into a time. *No* is stored as a number.

## One-time setup

### 1. Gemini API key (only for the Gemini AI reader)

1. Go to <https://aistudio.google.com/apikey> and create an API key.
   This is the same key the Gemini CLI reads from `GEMINI_API_KEY`.
2. In the app, open **Settings**, paste the key, and press **Save**. The app connects,
   lists the models your key can use, and picks the newest stable *Flash* model.
   You can choose a different model in the dropdown and press **Save** again.

> The Gemini CLI is a desktop terminal tool and cannot run inside a phone app, so the
> app calls the Gemini API directly with your API key.

### 2. Google Sheets access (service account)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one).
2. Enable the **Google Sheets API** (APIs & Services → Library).
3. Go to IAM & Admin → Service Accounts → **Create service account** (no roles needed).
4. Open the service account → **Keys** → Add key → **JSON**. A `.json` file downloads.
5. Copy the whole content of that file into **Settings → Service account key (JSON)** and press **Save**.
   The app signs in and shows the service account email (`…@….iam.gserviceaccount.com`).
6. Open your Google Sheet → **Share**, and add that email as an **Editor**.

> The key is stored on the device in the app's private storage. Use a service account
> made only for this app, with access only to the sheets it needs.

### 3. Categories

Open **Settings → Category Data**:

- Type a name in the top field and tap **＋** to add it. It is added as *Active* at the end of the list.
- Drag a row by its **☰** handle to reorder. The home dropdown uses this order.
- Set **Active / Inactive** on each row. Inactive categories are hidden from the home dropdown but kept.
- Tap **✕** to delete a category.

Changes are saved immediately; there is no Save button on this screen.

## Development

Requirements: Node ≥ 22.18, JDK 17, Android SDK (see the
[React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)).

```sh
npm install
npm start            # Metro bundler
npm run android      # build & run on a connected device / emulator
```

iOS: `bundle install && cd ios && bundle exec pod install && cd .. && npm run ios`.

Use a real device for camera testing. Emulators only provide a simulated camera.

### Tests

```sh
npm test                     # unit tests (parsing, normalisation, JWT signing)
npx tsc --noEmit && npm run lint
```

To try the Gemini extraction prompt on sample photos without building the app:

```sh
GEMINI_API_KEY=your-key npm run test:extraction -- ~/Documents/warrant_samples [models/<model-id>]
```

## Project layout

```
App.tsx                      permission gate, persistence, screen routing
src/storage.ts               AsyncStorage persistence
src/services/gemini.ts       Gemini API: list models, extract No/Total (prompt lives here)
src/services/sheets.ts       service-account JWT auth + Sheets append
src/screens/HomeScreen.tsx   dropdown, sheet URL, Settings / Start scan
src/screens/SettingsScreen.tsx
src/screens/CategoriesScreen.tsx  add / reorder / activate categories
src/components/SortableList.tsx   drag-to-reorder list (PanResponder, no native deps)
src/screens/ScanScreen.tsx   camera, capture, Gemini call, save, End scan
src/screens/ReviewView.tsx   editable review with Accept / Reject
scripts/test-extraction.mts  run Gemini extraction against a folder of images
src/screens/ManualEntryScreen.tsx  type-in form (Next / Done Edit)
src/services/ocr/            built-in reader: native call + "No" parser
specs/NativeWarrantOcr.ts    TurboModule spec for the native OCR module
android/app/src/main/java/com/warrantformscanner/ocr/   ML Kit OCR (Kotlin)
android/app/src/debug/…/OcrDebugActivity.kt  debug-only OCR harness (see below)
```

### Tuning the built-in reader

`OcrDebugActivity` (debug builds only) runs the native OCR over sample photos and saves the
raw ML Kit output. `__tests__/fixtures/mlkit-top-right.json` holds the top-right region of that
output for the 8 sample warrants, and `__tests__/ocr.test.ts` checks the No parser against it.

```sh
adb push photo.jpeg /data/local/tmp/ws/
adb shell run-as com.warrantformscanner sh -c 'mkdir -p files/samples && cp /data/local/tmp/ws/*.jpeg files/samples/'
adb shell am start -n com.warrantformscanner/.OcrDebugActivity
adb exec-out run-as com.warrantformscanner cat files/ocr/photo.json
```

If Jest fails with a Watchman "inotify" error, run `npx jest --no-watchman`.
