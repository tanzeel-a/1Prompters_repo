# Learn C - Class 10 UP Board Learning App

A production-quality, responsive single-page application (SPA) designed to teach C programming to Class 10 UP Board students. Features a soft clay-style UI, SM-2 spaced repetition, and valid C syllabus content.

## 🚀 How to Run

No build step or server required!

1.  **Clone or Download** this folder.
2.  **Open `index.html`** in any modern web browser (Chrome, Firefox, Safari, Edge).
3.  That's it! The app runs entirely client-side.

> **Note**: For the best experience with loading JSON data, it is recommended to use a local development server (like Live Server in VS Code) to avoid CORS restrictions on `file://` protocol in some browsers.
>
> **Using Python (optional):**
> ```bash
> python3 -m http.server
> # Then open http://localhost:8000
> ```

## 📚 Syllabus & Content

Content is mapped to **UP Board Class 10 Computer Syllabus (2025-26)**.

| Unit | Topic | Count |
|------|-------|-------|
| 1 | Introduction to Programming | 100 |
| 2 | C Language Syntax | 80 |
| 3-6 | Variables, Operators, Control Flow, Loops | 410 |
| 7-9 | Functions, Arrays, Strings | 280 |
| 10-12 | Pointers, Files, Debugging | 130 |
| **Total** | | **1000** |

## 🛠 Developer Guide

### Project Structure
```
.
├── index.html              # Main entry point (Semantic HTML5)
├── styles.css              # Design system (Clay UI, CSS Variables)
├── app.js                  # App logic (Modules, IndexedDB, SM-2)
├── data/
│   └── questions-1000.json # Question bank
├── tests/
│   ├── generator.js        # Script to generate questions
│   └── validator.js        # Script to validate JSON schema
└── assets/                 # Icons and textures
```

### Teacher Mode
- Access via the **"Teacher Mode"** link in the footer.
- **Default PIN:** `1234`
- Features: View stats, browse questions, export/import question banks.

### Extending the App
1.  **Add Questions**: Edit `data/questions-1000.json` directly or use the Teacher Mode verify logic.
2.  **Modify Units**: Update `UNITS` array in `app.js` and `manifest` in JSON.
3.  **Run Tests**:
    ```bash
    node tests/validator.js
    ```

### Privacy & Storage
- **Local-Only**: All progress is stored in the browser's **IndexedDB** (`CLearnDB`).
- **Privacy**: No data is sent to any external server.
- **Backup**: Use the "Export Progress" feature in the generic dashboard.

## 🎨 Design System
- **Theme**: Soft pink (`#e8a4b8`) & Cream (`#fdf8f5`) with tactile "Claymorphism".
- **Typography**: Nunito (UI) and Fira Code (Code).
- **Accessibility**: High contrast mode, reduced motion support, ARIA landmarks.
