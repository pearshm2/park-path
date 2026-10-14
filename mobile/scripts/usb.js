/**
 * Run the app on an Android phone over a USB cable: `npm run usb`.
 *
 * For networks that stop devices reaching each other (campus Wi-Fi) and for
 * demos that shouldn't depend on the room's Wi-Fi. `adb reverse` makes the
 * phone's own localhost:8000 (the API) and localhost:8081 (Expo) lead to
 * this computer through the cable, so mobile/.env can say
 * EXPO_PUBLIC_API_URL=http://localhost:8000 and nothing travels over any
 * network. It does the same for every Android device connected, the
 * emulator included, so one setting works for both.
 *
 * Needs: USB debugging on (Settings > About phone > tap Build number 7
 * times; Settings > Developer options > USB debugging), the phone plugged
 * in and "Allow" tapped, and the API running (docker compose up -d).
 *
 * Then it starts Expo; press `a` to open the app on the device. Extra
 * arguments go to Expo: `npm run usb -- -c` clears its cache.
 */

const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORTS = [8000, 8081]; // the API, and Expo's bundler

/** adb from ANDROID_HOME, Android Studio's default install, or the PATH. */
function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const homes = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk'),
  ].filter(Boolean);
  for (const home of homes) {
    const candidate = path.join(home, 'platform-tools', exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'adb';
}

const adb = findAdb();

function devices() {
  const out = execFileSync(adb, ['devices'], { encoding: 'utf8' });
  return out
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state);
}

let listed;
try {
  listed = devices();
} catch {
  console.error(`Couldn't run adb (${adb}). Is Android Studio's SDK installed?`);
  process.exit(1);
}

const ready = listed.filter(([, state]) => state === 'device');
for (const [serial, state] of listed.filter(([, s]) => s !== 'device')) {
  console.warn(
    `${serial}: ${state}.` +
      (state === 'unauthorized' ? ' Unlock the phone and tap Allow on the USB debugging prompt.' : ''),
  );
}
if (ready.length === 0) {
  console.error('No Android device connected. Plug the phone in (USB debugging on) or start the emulator.');
  process.exit(1);
}

for (const [serial] of ready) {
  for (const port of PORTS) {
    execFileSync(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  }
  console.log(`${serial}: linked to this computer on ports ${PORTS.join(' and ')}`);
}

// Expo on localhost, so the device loads the app through the cable too.
const expo = spawn('npx', ['expo', 'start', '--localhost', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
expo.on('exit', (code) => process.exit(code ?? 0));
