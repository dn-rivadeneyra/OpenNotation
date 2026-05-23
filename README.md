# OpenNotation Runtime (ONR)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Target: WASM](https://img.shields.io/badge/target-wasm32--unknown--unknown-blue)](https://webassembly.org/)
[![Stability: Alpha](https://img.shields.io/badge/stability-experimental-orange)](#)

OpenNotation Runtime is a headless, hyper-performance semantic runtime system for musical scores. It orchestrates notation semantics, layout intelligence, layout abstraction, interaction, and rendering independently of any single engraving engine. 

It is designed to be the foundational infrastructure layer for modern music software—**the "Linux kernel" of music notation.**

---

## 💡 The Vision: Why OpenNotation?

Building music software today is broken. Developers building interactive practice tools, AI-driven sheet music scanners, collaborative DAWs, or educational platforms must choose between two painful paths: spend years writing a buggy, monolithic notation engine from scratch, or hack brittle wrappers around existing web renderers that lag, leak memory, and crash under the weight of large orchestral scores.

OpenNotation breaks this monopoly by introducing an **embeddable, headless, and platform-agnostic runtime** that manages the brutal math of music state, history, and spatial indexing, completely decoupled from the rendering layer. 

By licensing OpenNotation under the permissive **MIT License**, we are handing the global developer community a high-performance, open standard to build the future of music technology.

### Architectural Identity
* **Chromium for Notation:** A portable, embeddable runtime layer that applications sit on top of.
* **Unity for Score Interaction:** A unified scene and collision model decoupled from the underlying renderer.
* **Ollama for Engraving Engines:** Swappable backends (Verovio, VexFlow, custom AI) hiding behind a stable, defined interface contract.

---

## 🚀 Key Architectural Breakthroughs

### 1. Entity Component System (ECS) Graph Topology
Traditional software represents music as a deeply nested tree structure (`Score -> Part -> Staff -> Measure -> Voice -> Note`). This structure breaks down instantly when handling complex edge cases like cross-staff beaming or overlapping ties. OpenNotation stores music as flat entity collections mapped by a relational graph, completely eliminating structural data corruption.

### 2. Zero-Cost State Management & Deep Undo/Redo
Powered by Rust's atomic reference counting (`Arc<HashMap<EntityID, Component>>`), the state engine utilizes **immutable snapshotting with structural sharing**. Modifying a note performs a lightweight copy-on-write operation on its specific component store while safely pointing to unchanged blocks. This guarantees instant, zero-allocation undo/redo history snapshots executing in under **< 8ms**.

### 3. Asynchronous Layout Backends & The CLT
The engine isolates third-party engraving engines into sandboxed, swappable execution workers. The runtime translates its internal state to external schemas (like MEI), parses incoming geometric bounding boxes into a unified **Canonical Layout Tree (CLT)**, and normalizes coordinates. If an engraving backend crashes or encounters a layout paradox, the core semantic data remains completely untouched.

### 4. Ultra-Fast Viewport Virtualization & GPU Pipelines
* **R-Tree Spatial Indexing:** Interactive bounding boxes are mapped to a spatial canvas index, executing mouse hit-testing in **< 1ms** completely independent of the DOM.
* **System Virtualization:** Only visible systems and measures are prepared for the screen, ensuring a consistent **60 FPS** and **< 150MB memory footprint** on massive 500-page orchestral scores.
* **GPU Instanced Atlases:** Moves away from heavy browser SVG layout thrashing to WebGL2/WebGPU texture atlases, treating musical glyph rendering like an optimized game engine.

---

## 🛠️ System Architecture & Roadmap

OpenNotation is being built in strict, deterministic phases to enforce robust type-safety boundaries and clean compiler targets.

- [x] **Phase 1–3:** Foundational Core Primitives & Target Setup
- [x] **Phase 4:** Semantic State Store (`Arc`-based ECS and Transaction Engine)
- [──] **Phase 5:** Layout & Engraving Bridge Pipeline (Current Focus 🚧)
- [ ] **Phase 6:** Spatial Indexing Engine (R-Tree Coordinate Mapping)
- [ ] **Phase 7:** Document Virtualization Pipeline
- [ ] **Phase 8:** Universal Input & Command Router
- [ ] **Phase 9:** WebGL2/WebGPU Instanced Rendering Engine

---

## 💻 Tech Stack

* **Core Engine:** 100% Systems Rust
* **Compilation Target:** `wasm32-unknown-unknown` (Zero native standard library dependencies, native performance in the browser)
* **Serialization Targets:** MEI (Music Encoding Initiative), MusicXML (planned)
* **Hardware Acceleration:** WebGL2 / WebGPU Texture Instancing

---

## 📥 Development & Compilation

To build the runtime locally, ensure you have Rust and the WebAssembly target toolchain installed.

```bash
# Clone the repository
git clone [https://github.com/yourusername/opennotation-runtime.git](https://github.com/yourusername/opennotation-runtime.git)
cd opennotation-runtime

# Run the core unit and state test suites
cargo test

# Compile for native environments
cargo build --release

# Compile explicitly for WebAssembly deployment
cargo build --target wasm32-unknown-unknown --release
```


## 📄 License
OpenNotation Runtime is open-source software licensed under the MIT License. You are free to embed, modify, distribute, and commercialize this engine in open-source projects or proprietary closed-source ecosystems without copyleft restrictions.

## 🤝 Contributing
We are currently executing the core engine architecture according to strict specification boundaries. Once the layout bridge (Phase 5) and spatial indexing (Phase 6) layers are fully compiled and green, we will open up issues for ecosystem bridges (VexFlow wrappers, Vue/React interaction bindings, and Audio Graph integration). Stay tuned!


