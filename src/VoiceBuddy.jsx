import { useState, useRef, useCallback, useEffect } from "react";

const LANGUAGES = [
  { code: "auto",  label: "Auto-detect", flag: "🌐", speechCode: "",      googleCode: null, useKhaya: false },
  { code: "hi-IN", label: "Hindi",       flag: "🇮🇳", speechCode: "hi-IN", googleCode: "hi", useKhaya: false },
  { code: "ha",    label: "Hausa",       flag: "🇬🇭", speechCode: "ha",    googleCode: "ha", useKhaya: false },
  { code: "ak",    label: "Twi",         flag: "🇬🇭", speechCode: null,    googleCode: "ak", useKhaya: true  },
  { code: "ee",    label: "Ewe",         flag: "🇬🇭", speechCode: null,    googleCode: "ee", useKhaya: true  },
];

const PULSE_BARS = 14;

// Detect if running locally or on Netlify
const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const KHAYA_KEY  = import.meta.env.VITE_KHAYA_API_KEY  || "";

// ─── Translation ──────────────────────────────────────────────────────────────
async function translateText(text, googleCode) {
  const langNames = { hi: "Hindi", ha: "Hausa", ak: "Twi (Akan)", ee: "Ewe" };
  const langName  = langNames[googleCode] || googleCode || "the source language";
  const prompt    = `Translate the following ${langName} text to English. Return ONLY the English translation, no explanation, no quotes:\n\n${text}`;

  if (IS_LOCAL) {
    // Call Gemini directly in local dev
    if (!GEMINI_KEY) throw new Error("Add VITE_GEMINI_API_KEY to your .env file");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gemini error");
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  } else {
    // On Netlify — use serverless function (key stays hidden)
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sourceLang: googleCode || "hi" })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Translation failed (${res.status})`);
    }
    const data = await res.json();
    return data.translation || "";
  }
}

// ─── Khaya transcription ──────────────────────────────────────────────────────
async function transcribeKhaya(audioBlob, googleCode) {
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const endpoint = IS_LOCAL ? "https://translation-api.ghananlp.org/asr/v1/transcribe" : "/api/transcribe";

    if (IS_LOCAL) {
      // Call Khaya directly
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");
      formData.append("language", googleCode === "ak" ? "tw" : googleCode);
      const headers = {};
      if (KHAYA_KEY) headers["Ocp-Apim-Subscription-Key"] = KHAYA_KEY;
      const res = await fetch(endpoint, { method: "POST", headers, body: formData });
      if (!res.ok) throw new Error("Khaya unavailable");
      const data = await res.json();
      return { text: data.transcription || "", source: "khaya" };
    } else {
      // On Netlify — use serverless function
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64, language: googleCode })
      });
      if (!res.ok) throw new Error("Khaya request failed");
      const data = await res.json();
      return { text: data.transcription || "", source: data.source || "khaya" };
    }
  } catch {
    return { text: "", source: "fallback" };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #07070f; overflow-x: hidden; }

  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: .55; }
    100% { transform: scale(2.1); opacity: 0;   }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -400% 0; }
    100% { background-position:  400% 0; }
  }

  .pulse-ring {
    position: absolute; inset: -16px; border-radius: 50%;
    border: 1.5px solid #9060e060;
    animation: pulse-ring 1.7s ease-out infinite;
    pointer-events: none;
  }
  .pulse-ring:nth-child(2) { animation-delay: .57s; }
  .pulse-ring:nth-child(3) { animation-delay: 1.14s; }
  .fade-up    { animation: fade-up    .35s ease forwards; }
  .slide-down { animation: slide-down .25s ease forwards; }
  .shimmer-txt {
    background: linear-gradient(90deg, #b08dff, #ede9ff, #9060e0, #b08dff);
    background-size: 400% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    animation: shimmer 2.2s linear infinite;
  }
  button { font-family: "DM Sans", sans-serif; cursor: pointer; }
  .icon-btn {
    background: none; border: 1px solid #1e1e32; color: #7070a0;
    border-radius: 10px; padding: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: all .18s;
  }
  .icon-btn:hover  { border-color: #9060e055; color: #b08dff; background: #9060e010; }
  .icon-btn.active { border-color: #a855f7;   color: #c084fc; background: #a855f715; }
  .lang-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 9px 16px; border-radius: 10px;
    border: 1px solid #1e1e32; background: none;
    color: #8080a8; font-size: 13.5px; transition: all .18s; white-space: nowrap;
  }
  .lang-chip:hover  { border-color: #9060e055; color: #c4b5fd; }
  .lang-chip.active { border-color: #9060e0;   background: #9060e018; color: #c4b5fd; }
  .action-btn {
    padding: 9px 20px; border-radius: 10px;
    border: 1px solid #1e1e32; background: none;
    color: #8080a8; font-size: 13px; transition: all .18s;
  }
  .action-btn:hover   { border-color: #9060e055; color: #c4b5fd; background: #9060e010; }
  .action-btn.primary { border-color: #9060e055; color: #b08dff; }
  .copy-btn {
    background: none; border: 1px solid #1e1e3244;
    color: #50507066; border-radius: 6px; padding: 3px 10px;
    font-size: 11px; font-family: "DM Mono", monospace; transition: all .18s;
  }
  .copy-btn:hover { border-color: #9060e055; color: #b08dff; }
  .perm-btn {
    padding: 10px 18px; border-radius: 10px; font-size: 13px;
    border: 1px solid #9060e066; background: #9060e018; color: #c4b5fd;
    transition: all .18s; width: 100%;
  }
  .perm-btn:hover { background: #9060e030; }
`;

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="8"  y1="22" x2="16" y2="22"/>
  </svg>
);
const StopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="3"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function VoiceBuddy() {
  const [status,        setStatus]        = useState("idle");
  const [selectedLang,  setSelectedLang]  = useState("auto");
  const [transcript,    setTranscript]    = useState("");
  const [translation,   setTranslation]   = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [transcriptSrc, setTranscriptSrc] = useState("");
  const [volume,        setVolume]        = useState(Array(PULSE_BARS).fill(3));
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [micStatus,     setMicStatus]     = useState("unknown"); // unknown | granted | denied
  const [copied,        setCopied]        = useState(null);

  const recognitionRef       = useRef(null);
  const mediaRecorderRef     = useRef(null);
  const chunksRef            = useRef([]);
  const streamRef            = useRef(null);
  const analyserRef          = useRef(null);
  const animFrameRef         = useRef(null);
  const isListeningRef       = useRef(false);
  const browserTranscriptRef = useRef("");

  const activeLangObj = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];

  // ── PWA install prompt ───────────────────────────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstall(false);
  };

  // ── Volume visualiser ────────────────────────────────────────────────────────
  const animateVolume = useCallback(() => {
    if (!analyserRef.current || !isListeningRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = Array.from({ length: PULSE_BARS }, (_, i) => {
      const idx = Math.floor((i / PULSE_BARS) * data.length * 0.45);
      return Math.max(4, (data[idx] / 255) * 72);
    });
    setVolume(bars);
    animFrameRef.current = requestAnimationFrame(animateVolume);
  }, []);

  // ── Stop everything ──────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    isListeningRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    setVolume(Array(PULSE_BARS).fill(3));
    try { recognitionRef.current?.stop(); } catch {}
    try { if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Process audio ────────────────────────────────────────────────────────────
  const processAudio = useCallback(async (audioBlob, langObj) => {
    setStatus("processing");
    let finalTranscript = browserTranscriptRef.current;
    let src = "browser";

    // Twi/Ewe → Khaya AI transcription
    if (langObj?.useKhaya && !finalTranscript) {
      const result = await transcribeKhaya(audioBlob, langObj.googleCode);
      finalTranscript = result.text;
      src = result.source;
    }

    // Fallback: if Web Speech gave nothing (common on mobile),
    // send audio to Gemini to transcribe + translate in one shot
    if (!finalTranscript) {
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        const langName = langObj?.label || "the spoken language";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `This audio may be in ${langName}, Twi, Ewe, Hausa, or Hindi. Transcribe it then translate to English. Reply EXACTLY in this format with no extra text:\nORIGINAL: [transcribed text]\nENGLISH: [english translation]` },
                { inline_data: { mime_type: "audio/webm", data: base64 } }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
          })
        });
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const origMatch  = text.match(/ORIGINAL:\s*(.+)/i);
        const transMatch = text.match(/ENGLISH:\s*(.+)/i);
        if (origMatch?.[1])  finalTranscript = origMatch[1].trim();
        if (transMatch?.[1]) {
          setTranscript(finalTranscript || "");
          setTranslation(transMatch[1].trim());
          setTranscriptSrc("gemini");
          setStatus("done");
          return;
        }
      } catch {}
    }

    if (!finalTranscript) {
      setErrorMsg("Couldn't pick up speech. Speak clearly and closer to the mic, then try again.");
      setStatus("error");
      return;
    }

    setTranscript(finalTranscript);
    setTranscriptSrc(src);

    try {
      const translated = await translateText(finalTranscript, langObj?.googleCode);
      setTranslation(translated);
      setStatus("done");
    } catch (err) {
      setErrorMsg(`Translation failed: ${err.message}`);
      setStatus("error");
    }
  }, []);

  // ── Start listening ──────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    setStatus("listening");
    setTranscript("");
    setTranslation("");
    setErrorMsg("");
    setTranscriptSrc("");
    browserTranscriptRef.current = "";
    isListeningRef.current = true;

    const langObj = activeLangObj.code === "auto" ? LANGUAGES[1] : activeLangObj;

    try {
      // This is the real mic request — triggers browser permission popup if not yet granted
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStatus("granted");

      // Volume visualiser
      const ctx = new AudioContext();
      const srcNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      srcNode.connect(analyser);
      analyserRef.current = analyser;
      animFrameRef.current = requestAnimationFrame(animateVolume);

      // MediaRecorder (captures audio for Khaya)
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob, langObj);
      };
      recorder.start();

      // Web Speech API for Hindi / Hausa (real-time transcript)
      if (!langObj.useKhaya) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = langObj.speechCode || "";
          recognition.onresult = e => {
            let text = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              text += e.results[i][0].transcript;
            }
            browserTranscriptRef.current = text;
            setTranscript(text);
          };
          recognition.onerror = () => {};
          recognition.start();
        }
      }
    } catch (err) {
      isListeningRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      setVolume(Array(PULSE_BARS).fill(3));

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicStatus("denied");
        setErrorMsg("Microphone blocked. Click the 🔒 lock in Chrome's address bar → Site settings → Microphone → Allow → refresh.");
      } else if (err.name === "NotFoundError") {
        setErrorMsg("No microphone found. Plug in a mic or headset and try again.");
      } else if (err.name === "NotReadableError") {
        setErrorMsg("Mic is in use by another app (Zoom, Teams, etc). Close it and try again.");
      } else {
        setErrorMsg(`Mic error: ${err.message || err.name}. Try refreshing.`);
      }
      setStatus("error");
    }
  }, [activeLangObj, animateVolume, processAudio]);

  const handleMainButton = () => {
    if (status === "listening") stopAll();
    else startListening();
  };

  const handleReset = () => {
    stopAll();
    setStatus("idle");
    setTranscript("");
    setTranslation("");
    setErrorMsg("");
  };

  const handleCopy = (type, text) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 1800);
  };

  useEffect(() => () => stopAll(), [stopAll]);

  const isListening  = status === "listening";
  const isProcessing = status === "processing";
  const hasResult    = status === "done";

  const micColor = micStatus === "granted" ? "#4ade80" : micStatus === "denied" ? "#f87171" : "#60607a";
  const micLabel = micStatus === "granted" ? "Microphone allowed" : micStatus === "denied" ? "Microphone blocked" : "Will prompt when you tap Listen";

  return (
    <>
      <style>{css}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      <div style={{ minHeight: "100vh", background: "#07070f", color: "#ede9ff", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "2rem" }}>

        {/* Install Banner */}
        {showInstall && (
          <div style={{ width: "100%", maxWidth: 560, padding: "1rem 1.2rem 0" }}>
            <div style={{ background: "#0e0e1c", border: "1px solid #2a1a4a", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 500, color: "#ede9ff", marginBottom: 2 }}>Install VoiceBuddy</p>
                <p style={{ fontSize: 12, color: "#50506a" }}>Add to home screen — works offline</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleInstall} style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, border: "1px solid #9060e0", background: "#9060e018", color: "#c4b5fd", whiteSpace: "nowrap" }}>Install</button>
                <button className="icon-btn" onClick={() => setShowInstall(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div style={{ width: "100%", maxWidth: 560, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.6rem 1.2rem 0" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px" }}>
            Voice<span style={{ color: "#a855f7" }}>Buddy</span>
          </h1>
          <button className={`icon-btn ${settingsOpen ? "active" : ""}`} onClick={() => setSettingsOpen(s => !s)} aria-label="Settings">
            <SettingsIcon />
          </button>
        </div>

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="slide-down" style={{ width: "100%", maxWidth: 560, margin: "1rem 1.2rem 0", background: "#0e0e1c", border: "1px solid #1e1e32", borderRadius: 16, padding: "20px 22px" }}>
            <p style={{ fontSize: 11, color: "#50507a", fontFamily: "'DM Mono', monospace", letterSpacing: ".07em", marginBottom: 12 }}>INPUT LANGUAGE</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {LANGUAGES.map(lang => (
                <button key={lang.code} className={`lang-chip ${selectedLang === lang.code ? "active" : ""}`}
                  onClick={() => { setSelectedLang(lang.code); setSettingsOpen(false); }}>
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                  {lang.useKhaya && <span style={{ fontSize: 10, color: "#9060e080", fontFamily: "'DM Mono', monospace" }}>Khaya</span>}
                </button>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #1e1e32", paddingTop: 18 }}>
              <p style={{ fontSize: 11, color: "#50507a", fontFamily: "'DM Mono', monospace", letterSpacing: ".07em", marginBottom: 12 }}>MICROPHONE</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: micColor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: micColor }}>{micLabel}</span>
              </div>
              {micStatus === "denied" && (
                <div style={{ background: "#1a0e0e", border: "1px solid #7f1d1d44", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 12.5, color: "#fca5a5", lineHeight: 1.85 }}>
                    To unblock in Chrome:<br/>
                    1. Click the 🔒 lock in the address bar<br/>
                    2. Site settings → Microphone → Allow<br/>
                    3. Refresh the page (F5)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visualiser */}
        <div style={{ marginTop: settingsOpen ? "2rem" : "3.5rem", display: "flex", alignItems: "flex-end", gap: 3.5, height: 72, opacity: isListening ? 1 : 0.1, transition: "opacity .4s" }}>
          {volume.map((h, i) => (
            <div key={i} style={{ width: 5, borderRadius: 3, height: h, background: `hsl(${258 + i * 5}, 58%, ${46 + i * 1.5}%)`, transition: "height .08s ease" }} />
          ))}
        </div>

        {/* Mic Button */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: "2rem 0 1.2rem" }}>
          {isListening && (<><div className="pulse-ring"/><div className="pulse-ring"/><div className="pulse-ring"/></>)}
          <button onClick={handleMainButton} disabled={isProcessing} aria-label={isListening ? "Stop" : "Start listening"}
            style={{
              width: 88, height: 88, borderRadius: "50%", border: "none", color: "#fff",
              cursor: isProcessing ? "wait" : "pointer",
              background: isListening ? "linear-gradient(135deg,#6d1fa0,#a855f7)" : "linear-gradient(135deg,#3d1580,#7c3aed)",
              boxShadow: isListening ? "0 0 52px #a855f750" : "0 6px 32px #7c3aed28",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .25s, box-shadow .25s", zIndex: 1,
            }}>
            {isProcessing
              ? <div style={{ width: 26, height: 26, border: "2.5px solid #fff3", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .75s linear infinite" }} />
              : isListening ? <StopIcon /> : <MicIcon />
            }
          </button>
        </div>

        {/* Status */}
        <p style={{ fontSize: 13, color: "#50507a", fontFamily: "'DM Mono', monospace", letterSpacing: ".04em", minHeight: 22, textAlign: "center" }}>
          {status === "idle"       && "tap to start listening"}
          {status === "listening"  && <span className="shimmer-txt">listening · tap to stop</span>}
          {status === "processing" && "translating…"}
          {status === "done"       && "done · tap to listen again"}
          {status === "error"      && <span style={{ color: "#f87171" }}>something went wrong</span>}
        </p>

        {/* Language badge */}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#50506a" }}>
          <span>{activeLangObj.flag}</span>
          <span>{activeLangObj.code === "auto" ? "Auto-detect" : activeLangObj.label}</span>
          {activeLangObj.useKhaya && <span style={{ color: "#9060e055", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>· Khaya AI</span>}
          <button onClick={() => setSettingsOpen(true)} style={{ background: "none", border: "none", color: "#9060e0", fontSize: 12, padding: "0 4px" }}>change</button>
        </div>

        {/* Error */}
        {status === "error" && (
          <div className="fade-up" style={{ width: "100%", maxWidth: 560, margin: "1.5rem 1.2rem 0", background: "#140a0a", border: "1px solid #7f1d1d44", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ fontSize: 13.5, color: "#fca5a5", lineHeight: 1.75 }}>{errorMsg}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="action-btn" onClick={handleReset}>Dismiss</button>
              {micStatus === "denied" && (
                <button className="action-btn primary" onClick={() => { handleReset(); setSettingsOpen(true); }}>Open Settings</button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {(transcript || translation) && (
          <div className="fade-up" style={{ width: "100%", maxWidth: 560, padding: "0 1.2rem", marginTop: "1.8rem", display: "flex", flexDirection: "column", gap: 14 }}>
            {transcript && (
              <div style={{ background: "#0c0c1a", border: "1px solid #1a1a2e", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 10.5, color: "#40405a", fontFamily: "'DM Mono', monospace", letterSpacing: ".07em" }}>
                    ORIGINAL · {activeLangObj.label.toUpperCase()}
                    {transcriptSrc === "khaya" && <span style={{ color: "#9060e0" }}> · KHAYA AI</span>}
                  </span>
                  <button className="copy-btn" onClick={() => handleCopy("orig", transcript)}>
                    {copied === "orig" ? "✓ copied" : "copy"}
                  </button>
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "#b0acd8", fontWeight: 300 }}>{transcript}</p>
              </div>
            )}
            {translation && (
              <div style={{ background: "#0a0c18", border: "1px solid #181a2e", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 10.5, color: "#40405a", fontFamily: "'DM Mono', monospace", letterSpacing: ".07em" }}>ENGLISH TRANSLATION</span>
                  <button className="copy-btn" onClick={() => handleCopy("trans", translation)}>
                    {copied === "trans" ? "✓ copied" : "copy"}
                  </button>
                </div>
                <p style={{ fontSize: 16.5, lineHeight: 1.75, color: "#ede9ff" }}>{translation}</p>
              </div>
            )}
            {hasResult && (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="action-btn" onClick={handleReset}>↺ New</button>
                <button className="action-btn primary" onClick={startListening}>🎙 Listen again</button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer style={{ width: "100%", maxWidth: 560, padding: "4rem 1.2rem 1rem", marginTop: "auto" }}>
          <div style={{ borderTop: "1px solid #10101e", paddingTop: "1.8rem" }}>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: "#a855f7", marginBottom: 6 }}>
              VoiceBuddy <span style={{ color: "#25253a", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 400 }}>v0.1</span>
            </p>
            <p style={{ fontSize: 12, color: "#30304a", lineHeight: 1.9, fontFamily: "'DM Mono', monospace" }}>
              Speak Twi, Ewe, Hausa or Hindi — get English instantly.<br/>
              Twi &amp; Ewe via Khaya AI · Hindi &amp; Hausa via Web Speech API<br/>
              Translation powered by Gemini AI · Best in Chrome or Edge
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
