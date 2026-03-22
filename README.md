# FocusPal

[![CI](https://github.com/RavenPENG/FocusPal/actions/workflows/ci.yml/badge.svg)](https://github.com/RavenPENG/FocusPal/actions/workflows/ci.yml)

A System-Aware Digital Life on Your Desktop.

Tauri 2.0 + Rust + Vue 3 + TypeScript | Pixel Art 32×32 | Hybrid AI (Local SLM + Cloud)

## Features

- Transparent, frameless, always-on-top desktop companion
- System awareness: CPU, memory, battery, keyboard/mouse activity via Rust sidecar
- System tray with quick actions
- Cross-platform: Windows, macOS, Linux

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vite
- **Backend:** Tauri 2.0 + Rust (sysinfo, battery, rdev)
- **AI:** Hybrid local Qwen2.5-1.5B + DeepSeek API (planned)
- **Visual:** Canvas 32×32 pixel art (planned)

## License

MIT © RavenPENG
