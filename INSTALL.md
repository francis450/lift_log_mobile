# Installing Lift Log on your phone

Lift Log installs as an APK you copy to your Android phone ("sideloading"). A Play Store listing
can come later from the same code.

## 1. Make sure the server is ready

On `dashboard.erpkenya.com` (bench folder):

```bash
cd apps/lift_log && git pull && cd ../..
bench setup requirements --python          # installs the anthropic SDK if missing
bench --site dashboard.erpkenya.com migrate
bench --site dashboard.erpkenya.com execute lift_log.setup.seed.run
bench restart
```

Then in desk:

- **User > your user > Roles:** tick **Lift Log User**.
- **LL Settings:** paste your Anthropic API key. Leave the model names unless you mean to change them.
- Optional, once: move the old web log in (docs/06):
  `bench --site dashboard.erpkenya.com execute lift_log.setup.migrate_web_log.run --kwargs "{'folder': '/path/to/export', 'user': '<your login email>'}"`

## 2. Build the APK (about 15 minutes, in Expo's cloud)

You need a free Expo account (expo.dev). On your PC, in `lift-log-mobile`:

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

The first build asks to create the EAS project and an Android signing key: answer yes to both.
EAS keeps the key; every later build is signed with it, so updates install over the old app.

When the build finishes, the terminal prints a link and a QR code to the `.apk`.

## 3. Install it

1. On the phone, open the link (or scan the QR code) and download the APK.
2. Open it. Android asks to allow installs from your browser or Files app: allow it for that app.
3. Tap **Install**, then **Open**.
4. Sign in with `https://dashboard.erpkenya.com` and your ERPNext login.
5. Allow notifications when asked; Lift Log uses them for the workout, dinner and check-in reminders.
   They can be switched off one by one in Settings.

To update later, build again and install the new APK over the old one. Your data lives on the
server, and anything logged offline stays on the phone until it syncs.

## 4. If something goes wrong

| What you see | What to do |
|---|---|
| "This account isn't set up for Lift Log yet." | Give your user the **Lift Log User** role (step 1). |
| "Invalid login credentials" | Use your ERPNext login. The built-in admin user's name is `Administrator`, not an email. |
| "AI features aren't set up on your server" | Add the API key in **LL Settings**. |
| "App not installed" when updating | The new APK was signed with a different key. Uninstall the old one first (data on the server is kept; unsynced changes on the phone are lost). |
| No reminders | Settings > Apps > Lift Log > Notifications: allow them, and turn off battery optimisation for Lift Log if reminders arrive late. |
