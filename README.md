# repair_damage

## Android APK flow

This app is a hosted Next.js application with server routes for auth, MongoDB access, photo upload, and receipt generation. For Android packaging, use Capacitor as a thin native shell that opens the deployed HTTPS app.

### Required env

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_APP_URL=https://your-deployed-repair-app.com`
- `CAPACITOR_SERVER_URL=https://your-deployed-repair-app.com`
- `STORAGE_MODE=auto`

Keep MongoDB and Google Drive secrets on the backend only. Do not place them in the APK.

### Android setup

1. Install dependencies with `npm install`
2. Build the web app with `npm run build`
3. Add Android once with `npm run android:add`
4. Sync changes with `npm run android:sync`
5. Open Android Studio with `npm run android:open`
6. Build a debug APK first, then a signed release APK

### Photo storage

- `STORAGE_MODE=auto` tries Google Drive first, then falls back to local file storage under `public/uploads`
- `STORAGE_MODE=local` always stores locally
- `STORAGE_MODE=drive` requires Google Drive to succeed

### Mobile receipt behavior

Receipt sharing is designed to use the native share sheet when the app runs inside Capacitor. PDF download remains available from the backend receipt endpoint.
