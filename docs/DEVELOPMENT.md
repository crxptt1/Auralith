# Auralith Studio 2

Local Windows audio studio: English by default, Polish in Settings → Interface language. Electron + React + TypeScript; no Python or local web server in the installed app.

## Features

- Classic, Forced, Spell and combined Forced + Spell writing templates; editable A/B/C script, explicit name placeholders, duplicate detection and session duplication.
- Online Microsoft neural speech, installed Windows offline voice, lossless microphone capture and audio imports. TTS files are stored as PCM WAV; online source quality still depends on the upstream service.
- Named tracks, mute/solo, gain, pan, full-content pitch-preserving tempo, reverse and offsets. Music background import, brown/pink noise, optional background pulse and continuous looping.
- Common engine for 30-second preview and export. WAV PCM24/48kHz/stereo default; FLAC24 and MP3 320kbps. Loudness/peak/format and band-limited mono/stereo QC measured from actual outputs.
- CLEAR/LOW/MASKED export batch, CONTROL background-only version, ten-trial randomized A/B preference comparison using LUFS attenuation, per-export recipe/report JSON.
- Atomic local project saves, undo/redo, portable .auralith bundles with used media, legacy JSON script/settings import.
- Liquid Glass and opaque Focus materials, spring-based controls, an app-specific Full/Reduced motion setting independent of Windows.

## Development

Use a supported Node.js LTS release. Install dependencies with `npm ci`. Put the FFmpeg executable matching `vendor/FFmpeg-README.txt` at `vendor/ffmpeg.exe`. This binary is included in release applications; source archives omit it. To rebuild the icon on Windows, run `powershell -NoProfile -File scripts/build-icon.ps1`.

`npm test` runs model, locale, PCM recording, storage and real FFmpeg tests. Audio tests use `FFMPEG_PATH` when provided, otherwise vendor/ffmpeg.exe. `npm run build` typechecks and generates the renderer plus shared native model. `npm start` launches the production build. `npm run package` builds portable and per-user NSIS targets into `release/`.

For development preview, run `npm run dev` and launch Electron with `AURALITH_DEV_URL=http://127.0.0.1:5178` (see vite.config.ts for port). Browser preview supports interface/project editing only; native audio functions require Electron.

Test launches can use `AURALITH_DATA_DIR` for an isolated library. Production stores projects and managed audio under the Electron userData directory displayed in Settings. Portable refers to the executable; project data remains in the user's profile. Export a .auralith bundle to move a session and its media.

## Practical limits

Windows x64, 10 or later. Up to32 tracks,500 script lines, one-hour sessions; individual source recordings and microphone capture up to10 minutes. Neural synthesis accepts up to12,000 characters per role. Microphone capture requests48kHz and writes the actual AudioContext rate as24-bit PCM; hardware quality and upstream lossy files cannot be improved merely by changing the output container. Large sessions need space for disk intermediates. Mono/stereo QC samples a12kHz downmix (up to6kHz band), and true peak is an FFmpeg estimate.

Forced and Spell describe creative writing modes, independently of audio mixing. The app does not emulate proprietary creator formulas. Third-party licenses and build provenance are in THIRD_PARTY_NOTICES.md and vendor/.

## Script import

TXT and Markdown imports recognize explicit A/B/C roles: `a) I am calm`, `B: I choose focus`, `[C] I imagine success`, named Identity/Intention/Imagination sections, bullets and role tables. The import help button shows examples. Unmarked lines inherit the current section (A initially).

## Source layout

Use this directory as the GitHub repository root, not its parent and not just src/. `src/` contains the React interface, `desktop/` the Electron bridge and audio engine, `tests/` verification, `public/` static assets and `scripts/` build helpers. Do not upload node_modules/, release/, dist/, work/, personal recordings or vendor/ffmpeg.exe. The source archive includes all build configuration and dependency lockfiles.

Original application code uses the custom Auralith Source-Available License; see LICENSE. Private builds and modifications are allowed, while public distribution of modified versions requires written permission. Dependencies and the separately bundled FFmpeg binary retain their own licenses; see THIRD_PARTY_NOTICES.md. Optional Ko-fi and PayPal support links are in Settings and unlock no features.
## 2.1.1

- Read an affirmation: select a script line and keep it visible while recording. The take uses its text as its name and joins the matching A/B/C layer.
- Remove recordings from the voice library. Existing project tracks retain their audio files.
- Recording workflow check: `node scripts/check-recording.mjs` after `npm run build` (uses a simulated microphone).
