<p align="center"><img src="docs/Meetily-6.png" width="320" alt="Meetily" /></p>

# Meetily 🎙️ - Private AI meeting notes: record, transcribe, summarize on your machine

<p align="center">
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri_2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri 2"></a>
  <a href="https://www.rust-lang.org"><img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust"></a>
  <a href="https://github.com/ggerganov/whisper.cpp"><img src="https://img.shields.io/badge/whisper.cpp-4B5563?style=for-the-badge" alt="whisper.cpp"></a>
  <a href="frontend/package.json"><img src="https://img.shields.io/github/package-json/v/asidko/meetily?filename=frontend%2Fpackage.json&style=for-the-badge&label=version&color=F59E0B" alt="Version"></a>
  <a href="https://github.com/asidko/meetily/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/asidko/meetily/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center"><img src="docs/meetily_demo.gif" width="720" alt="Meetily demo" /></p>

Records mic and system audio, transcribes live with Whisper or Parakeet, summarizes with the LLM you pick. Nothing leaves the machine unless you choose a cloud model.

Fork of [Zackriya-Solutions/meetily](https://github.com/Zackriya-Solutions/meetily). Tracks upstream `main`, adds a live in-meeting assistant.

## Install

- **Download (recommended)**: [macOS Apple Silicon .dmg](https://github.com/asidko/meetily/releases/latest/download/meetily-macos-arm64.dmg) or [Linux x86_64 .deb](https://github.com/asidko/meetily/releases/latest/download/meetily-linux-x86_64.deb), checksums in [Releases](https://github.com/asidko/meetily/releases/latest).
- **Build from source**: Windows, Intel Mac, CUDA. See below.

The macOS app is ad-hoc signed, not notarized. After dragging it to Applications, run `xattr -dr com.apple.quarantine /Applications/meetily.app` once. It needs microphone and screen-recording permission (that is how system audio is captured).

## Quickstart

1. First launch downloads a transcription model. Whisper `base` is fine to start.
2. Pick a summary engine: built-in local model, Ollama, or a cloud key (OpenAI, Claude, Groq, OpenRouter, custom OpenAI-compatible).
3. Choose mic and system-audio device, press Record. Stop when done, open the meeting, generate the summary.

## What's new in v1.1.0

- Live assistant is on by default, with a progress bar showing when the next tip is due; Suggest now always asks for one.
- Chat with the assistant during the call: answers come from the transcript with clickable timestamps, and clicking a suggestion asks about it.
- Local models no longer stall during nonstop speech: transcription pauses while the model thinks and catches up after.
- Clearer assistant settings: a "Same as summary model" checkbox and a line showing which key, URL or server is used. Cloud providers wait for permission given right in the panel.

## Roadmap

- **Claude Code as provider**: your own Claude Code login, tools disabled, no session files.

## Features

Live transcription on device (Whisper with Metal/CUDA/Vulkan/ROCm, or Parakeet on CPU), VAD so only speech hits the model.

<p align="center"><img src="docs/home.png" width="720" alt="Live transcription" /></p>

Live assistant beside the transcript: questions and tips cited to transcript moments, plus a chat about the call so far. Design: [docs/LIVE_ASSISTANT_DESIGN.md](docs/LIVE_ASSISTANT_DESIGN.md).

Summaries from templates (standard, standup, retro, client call), editable in place.

<p align="center"><img src="docs/summary.png" width="720" alt="Summary" /></p>

Import an audio file, or re-transcribe a meeting with another model or language.

<p align="center"><img src="docs/meetily-export.gif" width="720" alt="Import and re-transcribe" /></p>

Mic and system audio mixed with ducking and clip protection; everything stored as files plus one SQLite database.

<p align="center"><img src="docs/audio.png" width="720" alt="Devices" /></p>

## How it compares

- Otter, Fireflies, Granola: better diarization and integrations, cloud processing and storage.
- MacWhisper, raw whisper.cpp: great local transcription, no system-audio capture, mixing or summaries.
- Meetily: the whole pipeline, local by default, model is your choice. No bot, no diarization yet.

## Configuration

All settings are in the app. Data lives in the Tauri app data dir (`~/Library/Application Support/com.meetily.ai`, `%APPDATA%\com.meetily.ai`, `~/.local/share/com.meetily.ai`): `meeting_minutes.sqlite`, `models/`, and a recordings folder with one directory per meeting.

Custom summary templates: JSON files in `Meetily/templates/` under the user data dir (same name as a bundled template overrides it). Schema: [templates/README.md](frontend/src-tauri/templates/README.md).

## Build from source

Rust stable, Node 20, pnpm 9.15.9, CMake. Linux adds clang and libasound2-dev; Windows adds VS Build Tools C++ workload.

```bash
git clone https://github.com/asidko/meetily
cd meetily/frontend
pnpm install --frozen-lockfile
./dev-gpu.sh      # dev run, auto-detects GPU, builds the llama sidecar
./build-gpu.sh    # release bundle in ../target/release/bundle/
```

Windows: `.\dev-gpu.ps1` / `.\build-gpu.ps1`. Force a backend with `TAURI_GPU_FEATURE=cuda|vulkan|hipblas|metal|coreml|openblas|none`. Details: [docs/BUILDING.md](docs/BUILDING.md), [docs/GPU_ACCELERATION.md](docs/GPU_ACCELERATION.md).

Tests: `pnpm test` in `frontend/` (one Bun process per file), `cargo test -p meetily` at the root. Lint: `pnpm lint`.

## Architecture

One Tauri 2 process. Rust owns audio capture, mixing and VAD, transcription (whisper-rs, ONNX Runtime), SQLite, and every LLM call. The UI is a static Next.js export that talks to Rust only via Tauri commands and events; its CSP blocks all network except localhost, so cloud calls can only come from Rust. Sidecars: `llama-helper` (local summaries) and `ffmpeg` (import decoding). More: [CLAUDE.md](CLAUDE.md), [docs/architecture.md](docs/architecture.md).

## License

MIT, see [LICENSE.md](LICENSE.md). Upstream by [Zackriya Solutions](https://github.com/Zackriya-Solutions); code borrowed from [whisper.cpp](https://github.com/ggerganov/whisper.cpp), [Screenpipe](https://github.com/mediar-ai/screenpipe), [transcribe-rs](https://crates.io/crates/transcribe-rs); Parakeet by NVIDIA, ONNX conversion by [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx).
