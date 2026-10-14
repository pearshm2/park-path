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
 * Then it starts Expo; press `a` to open the app on the device. While it
 * runs, it checks every few seconds and restores the links for any device
 * that reconnects or is newly plugged in. Extra arguments go to Expo:
 * `npm run usb -- -c` clears its cache.
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

/** adb, but giving up after a while: a stuck adb server otherwise hangs silently. */
function run(args) {
  return execFileSync(adb, args, { encoding: 'utf8', timeout: 20_000 });
}

function devices() {
  const out = run(['devices']);
  return out
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state);
}

console.log('Looking for Android devices...');
let listed;
try {
  listed = devices();
} catch (error) {
  console.error(
    error.code === 'ETIMEDOUT'
      ? [
          "adb isn't responding (its server is stuck). Restart it, then try again:",
          '  taskkill //F //IM adb.exe   (Git Bash; in PowerShell: taskkill /F /IM adb.exe)',
        ].join('\n')
      : `Couldn't run adb (${adb}). Is Android Studio's SDK installed?`,
  );
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

/** The serials linked so far, and the links each had last time we looked. */
const linked = new Map();

function link(serial) {
  for (const port of PORTS) {
    run(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  }
}

for (const [serial] of ready) {
  link(serial);
  linked.set(serial, true);
  console.log(`${serial}: linked to this computer on ports ${PORTS.join(' and ')}`);
}

// A phone that reconnects (a loose cable, the screen locking on some
// phones) loses its links, and pressing `a` only brings back Expo's own,
// so the app loads but can't reach the API. Keep checking while Expo runs
// and put any missing links back, for new devices too.
setInterval(() => {
  let current;
  try {
    current = devices().filter(([, state]) => state === 'device');
  } catch {
    return; // adb busy; try again next time
  }
  for (const [serial] of current) {
    let links = '';
    try {
      links = run(['-s', serial, 'reverse', '--list']);
    } catch {
      continue;
    }
    const missing = PORTS.filter((port) => !links.includes(`tcp:${port}`));
    if (missing.length === 0) continue;
    try {
      link(serial);
      console.log(
        `${serial}: ${linked.has(serial) ? 'reconnected, links restored' : 'connected, linked'} (ports ${PORTS.join(' and ')})`,
      );
      linked.set(serial, true);
    } catch {
      // It went away again; the next check will catch it.
    }
  }
}, 4000).unref();

// Expo on localhost, so the device loads the app through the cable too.
// adb reverse connects to 127.0.0.1, but Node resolves "localhost" to the
// IPv6 ::1 first, which would leave Expo listening where the cable can't
// reach it; ipv4first makes it listen on 127.0.0.1.
const expo = spawn('npx', ['expo', 'start', '--localhost', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--dns-result-order=ipv4first'].filter(Boolean).join(' '),
  },
});
expo.on('exit', (code) => process.exit(code ?? 0));
