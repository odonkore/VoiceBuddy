# VoiceBuddy 🎙️
Real-time voice translation — Twi, Ewe, Hausa, Hindi → English

---

## ✅ CHECKLIST — Everything you need

### 1. Install Node.js (one time only)
- Go to https://nodejs.org → download LTS → install → restart PC
- Confirm: open VS Code terminal and type `node -v`

### 2. Add your Gemini API key (FREE)
- You already have this — starts with `AIza...`
- In the voicebuddy folder, rename `.env.example` → `.env`
- Open `.env` and change:
  ```
  GEMINI_API_KEY=your_gemini_api_key_here
  ```
  to:
  ```
  GEMINI_API_KEY=AIzaYourActualKeyHere
  ```

### 3. Run locally
```bash
npm install
npm run dev
```
Open Chrome at http://localhost:5173 — app is fully working.

---

## 🌐 Deploy to Netlify (FREE hosting)

### Step 1 — Build the app
```bash
npm run build
```
This creates a `dist` folder.

### Step 2 — Deploy
- Go to https://app.netlify.com
- Sign up free with GitHub or email
- Click "Add new site" → "Deploy manually"
- Drag and drop the `dist` folder onto the page
- Wait ~30 seconds → your app is live at a URL like:
  `https://rainbow-dolphin-abc123.netlify.app`

### Step 3 — Add your API key to Netlify
Without this step, translations won't work on the live site.
- In Netlify dashboard → your site → "Site configuration"
- Left menu → "Environment variables"
- Click "Add a variable"
- Key:   `GEMINI_API_KEY`
- Value: `AIzaYourActualKeyHere`
- Click Save
- Go to "Deploys" tab → "Trigger deploy" → "Deploy site"

Your app is now fully live and working! ✅

---

## 📱 Install as Android App (no Play Store needed)

Once your Netlify URL is live:
1. Open the URL in Chrome on your Android phone
2. Tap the three-dot menu (⋮) in Chrome
3. Tap "Add to Home screen"
4. Tap "Add"

VoiceBuddy now appears on your home screen like a real app with its own icon. It opens fullscreen with no browser bar.

---

## 📦 Real APK for Play Store (when ready)

Install Capacitor to wrap the web app into a real APK:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init VoiceBuddy com.voicebuddy.app --web-dir dist
npm run build
npx cap add android
npx cap sync
npx cap open android
```
Then in Android Studio: Build → Generate Signed APK.

---

## 🔑 APIs used
| API            | Purpose                        | Cost                  |
|----------------|--------------------------------|-----------------------|
| Gemini 1.5 Flash | Translation (all languages)  | FREE (1500 req/day)   |
| Web Speech API | Transcription Hindi & Hausa    | FREE (browser)        |
| Khaya AI       | Transcription Twi & Ewe        | FREE (research tier)  |

---

## 📁 File structure
```
voicebuddy/
├── src/
│   ├── main.jsx                   ← React entry
│   └── VoiceBuddy.jsx             ← Full app
├── netlify/
│   └── functions/
│       ├── translate.js           ← Gemini API proxy (key stays secret)
│       └── transcribe.js          ← Khaya AI proxy
├── public/
│   ├── icon-192.png               ← App icon (Android)
│   └── icon-512.png               ← App icon (splash)
├── .env                           ← YOUR KEYS GO HERE (never commit this)
├── .env.example                   ← Template
├── .gitignore                     ← Keeps .env out of git
├── netlify.toml                   ← Netlify config
├── vite.config.js                 ← Vite + PWA setup
└── index.html
```
