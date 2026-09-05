# repair_damage

## Android APK flow

This app is a hosted Next.js application with server routes for auth, MongoDB access, photo upload, and receipt generation. For Android packaging, use Capacitor as a thin native shell that opens the deployed HTTPS app.

### Required env

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_APP_URL=https://your-deployed-repair-app.com`
- `CAPACITOR_SERVER_URL=https://your-deployed-repair-app.com`
- `STORAGE_MODE=auto`

Keep MongoDB, Cloudinary, and Google Drive secrets on the backend only. Do not place them in the APK.

### Android setup

1. Install dependencies with `npm install`
2. Build the web app with `npm run build`
3. Add Android once with `npm run android:add`
4. Sync changes with `npm run android:sync`
5. Open Android Studio with `npm run android:open`
6. Build a debug APK first, then a signed release APK

### Photo storage

- `STORAGE_MODE=auto` tries Cloudflare R2 when configured, then Cloudinary, then Google Drive, then local file storage under `public/uploads`
- `STORAGE_MODE=local` always stores locally
- `STORAGE_MODE=r2` requires Cloudflare R2 to succeed
- `STORAGE_MODE=cloudinary` requires Cloudinary to succeed
- `STORAGE_MODE=drive` requires Google Drive to succeed

For Cloudflare R2, create a free R2 bucket and set:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `R2_UPLOAD_LIMIT_GB=9.5`
- `R2_USAGE_PREFIX=repairs/`

The app blocks new R2 uploads when stored repair photos reach `R2_UPLOAD_LIMIT_GB`. The default is `9.5`, leaving a buffer below R2's 10 GB free storage allowance.

R2 photos uploaded by the app can be deleted from the repair edit screen. Deleting an R2 photo removes the object from the R2 bucket and removes the app photo record, so storage usage drops after the next usage check.

Photo deletion requires `PHOTO_DELETE_PASSWORD`. The default is `Priyanshu`, but production should set this in the server environment.

For Cloudinary, create a free account and set:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER=repair-app/repairs`

### Mobile receipt behavior

Receipt sharing is designed to use the native share sheet when the app runs inside Capacitor. PDF download remains available from the backend receipt endpoint.
