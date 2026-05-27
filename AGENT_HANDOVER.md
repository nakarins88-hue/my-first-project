# 🤝 Agent Handover Documentation - Jeff Bernat Cozy Lounge

Welcome! This document has been prepared to help another AI agent (such as Codex AI Agent) easily understand the architecture, completed milestones, and development guidelines of the **Jeff Bernat Cozy Music Lounge** project.

---

## 🌟 Project Overview
A premium, highly interactive client-side web application dedicated to streaming Jeff Bernat's discography. It features beautiful glassmorphism, dynamic environmental soundscapes (Late Night Rain, Cozy Café, Vintage Study), offline persistent custom audio uploads via IndexedDB, and deep accessibility compliance.

* **GitHub Repository:** `https://github.com/nakarins88-hue/my-first-project.git`
* **Live Web App:** `https://nakarins88-hue.github.io/my-first-project/`

---

## 🛠️ Tech Stack & Key Architectures

1. **Frontend Core:** Standard Vanilla HTML5, CSS3, and JavaScript (ES6+). No heavy frameworks to ensure maximum rendering performance.
2. **Audio Engines (Tri-Engine Architecture):**
   - **Local File Engine:** Plays native, high-quality audio pre-staged in the browser or uploaded.
   - **YouTube Background Engine:** Plays full songs dynamically by loading YouTube streams inside a hidden iframe, bypassing autoplay block rules.
   - **iTunes Engine:** Falls back to playing 30s official previews directly from Apple Music CDN.
3. **Client-Side Database (IndexedDB):**
   - Implemented a binary storage wrapper around IndexedDB inside `player-v8.js` to store custom songs (`Blobs`) and custom artwork offline.
   - Custom tracks survive page refreshes and browser closes without server-side dependencies.
4. **Environment Theme System (Late Night Rain, Cozy Café, Vintage Study):**
   - Modifies `:root` CSS variables dynamically depending on `.theme-rain`, `.theme-cafe`, or `.theme-study` classes attached to `<body>`.
5. **Dark & Light Mode Switcher:**
   - Appends a `.light-mode` class to the body.
   - Overrides default HSL and RGBA colors to soft, low-contrast, warm pastel colors designed specifically for eye-friendly daytime reading.
   - Preserves selection in `localStorage` via the `jeff_bernat_light_mode` state.

---

## 🚀 Key Achievements

* **IndexedDB Management Dashboard:** Users can click "จัดการ" to open a full-screen glassmorphic modal to view stats, upload local `.mp3`/`.m4a` files with title/album metadata, edit custom tracks, or hide/restore built-in tracks.
* **Premium Interactive Transitions:**
   - Smooth scrolling (`scroll-behavior: smooth !important`) throughout the page.
   - Bouncy, elastic play/pause toggles (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).
   - 3D card floating elevation (`transform: translateY(-4px)`) and organic shadow expansion.
   - Horizontal slide-out motion for list rows and ambient controls on hover.
* **Responsive Fluid Grid:** Custom media queries scale sidebars and stack forms gracefully. On narrow screens (`<850px`), the dashboard modal is full screen, and the catalog table supports swipe scrolls.
* **Lighthouse Optimization:**
   - **SEO:** Added high-relevance description meta tags in `<head>`.
   - **Performance:** Preloads LCP images (`default_cover.png`) to ensure visual rendering speed.
   - **Accessibility:** Embedded descriptive W3C `aria-label` tags into every icon button, allowing screen readers and SEO bots to evaluate the site flawlessly.

---

## 📂 File Map
* **[index.html](index.html):** Standard semantic markup, SVG icons, preloaded LCP imagery, custom audio player elements, IndexedDB forms, and the full-screen modal container.
* **[style.css](style.css):** Houses design tokens, theme color overrides (dark/light, moods), responsive layouts, keyframe animation bobs, and custom scrollbars.
* **[player-v8.js](player-v8.js):** The main logic file. Holds track objects, initializes visualizers, runs IndexedDB triggers, handles YouTube Background Iframe callbacks, hooks tab navigation, and loads local settings.

---

## 💡 Guidelines for Continuing Development

To continue coding this project, follow these instructions:
1. **Clone the Repo:**
   ```bash
   git clone https://github.com/nakarins88-hue/my-first-project.git
   cd my-first-project
   ```
2. **Run Dev Server Locally:**
   Run any static local server (e.g. `npx http-server -p 8000` or Live Server extension).
3. **Commit Guidelines:**
   Keep CSS variables clean. When implementing new features, always include custom support for both **Dark** and **Light** modes and check for mobile response constraints.
