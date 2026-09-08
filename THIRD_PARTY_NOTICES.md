# Third-party software

Auralith Studio uses an independent FFmpeg executable for local audio processing.

FFmpeg build: 2025-12-18-git-78c75d546a-full_build-www.gyan.dev.
Copyright (c) 2000–2025 the FFmpeg developers. GPL version 3.
The complete license and original build README (including configuration and library versions) accompany this application in resources/licenses.

FFmpeg source for this build: https://github.com/FFmpeg/FFmpeg/commit/78c75d546a
Source archive: https://github.com/FFmpeg/FFmpeg/archive/78c75d546a.tar.gz
Build provider and library/source references: https://www.gyan.dev/ffmpeg/builds/

Electron is provided under its MIT license; Chromium and other bundled components have their own licenses in LICENSE.electron.txt and LICENSES.chromium.html next to the executable.
React (MIT), Motion (MIT), Lucide (ISC), adm-zip (MIT), and node-edge-tts (MIT) are included as dependencies. Their license files remain in the packaged dependencies or accompanying notices. See package-lock.json for the exact dependency graph.

Online neural speech uses the Microsoft Edge speech service through node-edge-tts. Auralith Studio is not affiliated with or endorsed by Microsoft or Apple. Liquid Glass names the selectable visual theme; the implementation uses web technologies inside Electron.
