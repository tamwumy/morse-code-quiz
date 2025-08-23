import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";

// ========= Utility: Morse maps =========
const MORSE_MAP = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};

const INVERSE_MORSE_MAP = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([k, v]) => [v, k])
);

function encodeToMorse(text) {
  return text
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/[^A-Z0-9]/g, "")
        .split("")
        .map((ch) => MORSE_MAP[ch] ?? "")
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join(" / ");
}

function decodeFromMorse(morse) {
  return morse
    .trim()
    .replace(/\|/g, "/")
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((code) => INVERSE_MORSE_MAP[code] ?? "?")
        .join("")
    )
    .join(" ");
}

// ========= Typewriter =========
function Typewriter({ text, speed = 40, className = "" }) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    setDisplay("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={className}>{display}</span>;
}

// ========= Telegraph (audio) =========
function useTelegraph() {
  const ctxRef = useRef(null);
  const oscillatorsRef = useRef([]);

  const ensureCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Closer to classic telegraph sidetone: square wave through band-pass, snappy ADSR
  const beep = async (ms = 70, freq = 700, vol = 0.5) => {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    oscillatorsRef.current.push(osc);

    osc.type = "square"; // buzzy telegraph-like tone
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq, ctx.currentTime);
    bp.Q.setValueAtTime(10, ctx.currentTime);

    const now = ctx.currentTime;
    const attack = 0.005, decay = 0.03, sustain = vol * 0.35, release = 0.05;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);

    osc.connect(bp).connect(gain).connect(ctx.destination);
    osc.start(now);

    const stopAt = now + ms / 1000;
    gain.gain.setValueAtTime(sustain, stopAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt + release);
    osc.stop(stopAt + release + 0.01);

    await sleep(ms + release * 1000 + 20);
    oscillatorsRef.current = oscillatorsRef.current.filter((o) => o !== osc);
  };

  const stopAll = () => {
    try { oscillatorsRef.current.forEach((o) => { try { o.stop(); } catch {} }); }
    finally { oscillatorsRef.current = []; }
  };

  const playMorseString = async (morse, unit = 80) => {
    const DOT = unit, DASH = unit * 3, GAP_INTRA = unit, GAP_LETTER = unit * 3, GAP_WORD = unit * 7;
    const parts = morse.trim().split(" ");
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      if (token === "/") { await sleep(GAP_WORD - GAP_INTRA); continue; }
      for (let j = 0; j < token.length; j++) {
        await beep(token[j] === '-' ? DASH : DOT);
        if (j < token.length - 1) await sleep(GAP_INTRA);
      }
      if (i < parts.length - 1) await sleep(GAP_LETTER);
    }
  };

  return { playMorseString, stopAll };
}

const DEFAULT_WORDS = [
  "CODE", "MORSE", "HELLO", "WORLD", "QUIZ", "DOT", "DASH", "RADIO", "PYTHON", "RUST",
];

const MODES = { EN_TO_MORSE: "EN_TO_MORSE", MORSE_TO_EN: "MORSE_TO_EN", MIXED: "MIXED" };

function ModeButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-mono border transition active:scale-[.98] shadow-sm ${
        active
          ? "bg-white text-black border-white/80"
          : "bg-black text-white border-white/30 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-black text-white font-mono border border-white/10">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}

export default function MorseCodeQuiz() {
  const [mode, setMode] = useState(MODES.MIXED);
  const [words] = useState(DEFAULT_WORDS);
  const [promptEN, setPromptEN] = useState("");
  const [promptMorse, setPromptMorse] = useState("");
  const [answer, setAnswer] = useState("");
  const [canonicalAnswer, setCanonicalAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [total, setTotal] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [allowDigits, setAllowDigits] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const { playMorseString, stopAll } = useTelegraph();
  const [allowSound, setAllowSound] = useState(false);

  const pickWord = useCallback(() => {
    let pool = words.filter((w) =>
      allowDigits ? /^[A-Z0-9]+$/i.test(w) : /^[A-Z]+$/i.test(w)
    );
    if (pool.length === 0) pool = DEFAULT_WORDS;
    return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
  }, [words, allowDigits]);

  const nextQuestion = useCallback((specifiedMode) => {
    const actualMode = specifiedMode ??
      (mode === MODES.MIXED ? (Math.random() < 0.5 ? MODES.EN_TO_MORSE : MODES.MORSE_TO_EN) : mode);
    setFeedback(null);
    setAnswer("");
    const word = pickWord();
    if (actualMode === MODES.EN_TO_MORSE) {
      setPromptEN(word);
      setPromptMorse("");
      setCanonicalAnswer(encodeToMorse(word));
    } else {
      setPromptEN("");
      const morse = encodeToMorse(word);
      setPromptMorse(morse);
      setCanonicalAnswer(word);
      // no auto-play; explicit Play button only
    }
  }, [mode, pickWord]);

  useEffect(() => { nextQuestion(); }, [mode, allowDigits, nextQuestion]);

  const normalizedMorse = (s) => s.trim().replace(/\s+/g, " ");
  const normalizedEN = (s) => s.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "");

  const onCheck = async () => {
    const activeMode = promptEN ? MODES.EN_TO_MORSE : MODES.MORSE_TO_EN;
    let ok = false;
    if (activeMode === MODES.EN_TO_MORSE) ok = normalizedMorse(answer) === normalizedMorse(canonicalAnswer);
    else ok = normalizedEN(answer) === normalizedEN(canonicalAnswer);
    setTotal((t) => t + 1);
    if (ok) {
      setCorrect((c) => c + 1);
      // no auto-play; explicit Play button only
    }
    setFeedback(ok ? "correct" : "wrong");
  };

  const accuracy = useMemo(() => (total ? Math.round((100 * correct) / total) : 0), [correct, total]);

  // --- Lightweight self-tests (console only) ---
  useEffect(() => {
    try {
      console.assert(encodeToMorse('SOS') === '... --- ...', 'encode SOS');
      console.assert(decodeFromMorse('... --- ...') === 'SOS', 'decode SOS');
      const h = encodeToMorse('HELLO');
      console.assert(decodeFromMorse(h) === 'HELLO', 'roundtrip HELLO');
      console.assert(encodeToMorse('2019') === '..--- ----- .---- ----.', 'digits 2019');
      console.assert(decodeFromMorse('-- --- .-. ... . / -.-. --- -.. .') === 'MORSE CODE', 'multi-word');
      console.assert(decodeFromMorse('...-.-') === '?', 'unknown code maps to ?');
      console.assert(encodeToMorse('A B') === '.- / -...', 'word separator /');
      console.log('Morse self-tests: PASS');
    } catch (e) {
      console.error('Morse self-tests: FAIL', e);
    }
  }, []);

  const onPlayClick = async () => {
    if (!allowSound) return;
    try {
      if (promptMorse) {
        await playMorseString(promptMorse);
      } else if (promptEN) {
        await playMorseString(canonicalAnswer || encodeToMorse(promptEN));
      }
    } catch (e) {}
  };

  return (
    <div className="min-h-screen w-full bg-black text-white font-mono">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Morse Code Quiz</h1>
          <p className="text-white/60 mt-1">Practice English and Morse code conversion. Choose a mode and start!</p>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex gap-2">
            <ModeButton active={mode === MODES.EN_TO_MORSE} onClick={() => setMode(MODES.EN_TO_MORSE)}>English → Morse</ModeButton>
            <ModeButton active={mode === MODES.MORSE_TO_EN} onClick={() => setMode(MODES.MORSE_TO_EN)}>Morse → English</ModeButton>
            <ModeButton active={mode === MODES.MIXED} onClick={() => setMode(MODES.MIXED)}>Eng ⇄ Morse (Mixed)</ModeButton>
          </div>
          <div className="flex gap-3">
            <Stat label="Correct" value={correct} />
            <Stat label="Total" value={total} />
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <button onClick={() => { stopAll(); setShowTable(true); }} className="px-3 py-2 rounded-xl bg-black border border-white/20 hover:bg-white/10">Chart</button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-white/70 select-none">
            <input type="checkbox" checked={allowDigits} onChange={(e) => setAllowDigits(e.target.checked)} className="rounded border-white/30 bg-black" />Allow digits 0–9
          </label>
          <button onClick={() => { setTotal(0); setCorrect(0); setFeedback(null); }} className="text-sm px-3 py-1.5 rounded-lg border bg-black border-white/20 hover:bg-white/10" title="Reset stats">Reset</button>
          <button onClick={() => setAllowSound((v) => !v)} className={`text-sm px-3 py-1.5 rounded-lg border ${allowSound ? 'bg-white text-black border-white/80' : 'bg-black border-white/20 hover:bg-white/10'}`} title="Toggle sound">{allowSound ? '🔊 Sound On' : '🔇 Sound Off'}</button>
        </div>

        <div className="bg-black border border-white/20 rounded-2xl shadow-sm p-5">
          {promptEN ? (
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-white/60">Translate English to Morse</div>
                <button onClick={onPlayClick} className="px-2 py-1 rounded-lg border border-white/30 bg-black hover:bg-white/10 text-xs">▶ Play</button>
              </div>
              <div className="mt-1 text-4xl font-bold tracking-wider select-text">
                <Typewriter text={promptEN} />
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-white/60">Translate Morse to English</div>
                <button onClick={onPlayClick} className="px-2 py-1 rounded-lg border border-white/30 bg-black hover:bg-white/10 text-xs">▶ Play</button>
              </div>
              <div className="mt-1 text-2xl font-semibold break-words select-text">
                <Typewriter text={promptMorse} />
              </div>
            </div>
          )}

          <label className="block text-sm text-white/70 mb-1">Your answer</label>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={promptEN ? "Use . and - , space between letters" : "Type English word"}
            className={`w-full rounded-xl border px-3 py-2 font-medium focus:outline-none focus:ring-2 transition ${
              feedback === "correct" ? "border-white ring-white/40" : feedback === "wrong" ? "border-white ring-white/40" : "border-white/30 focus:ring-white/30"
            } bg-black text-white`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCheck(); }
              if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); nextQuestion(); }
            }}
          />

          <p className="text-xs text-white/60 mt-2">Eng→Morse: use <span className="font-mono">.</span> and <span className="font-mono">-</span>, separate letters with a space; use <span className="font-mono">/</span> between words.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onCheck} className="px-4 py-2 rounded-xl bg-white text-black font-semibold shadow-sm hover:bg-white/90 active:scale-[.98]">Check (Enter)</button>
            <button onClick={() => nextQuestion()} className="px-4 py-2 rounded-xl bg-black border border-white/20 hover:bg-white/10">Next (Shift+Enter)</button>
            <button onClick={() => setAnswer(canonicalAnswer)} className="px-4 py-2 rounded-xl bg-black border border-white/20 hover:bg-white/10">Show Answer</button>
          </div>

          {feedback && (
            <div className={`mt-4 p-3 rounded-xl border ${feedback === "correct" ? "bg-white/10 border-white/30 text-white" : "bg-white/10 border-white/30 text-white"}`}>
              {feedback === "correct" ? (
                <span>✅ Correct!</span>
              ) : (
                <span>
                  ❌ Try again. Correct answer: {promptEN ? (
                    <span className="ml-1 font-mono">{canonicalAnswer}</span>
                  ) : (
                    <span className="ml-1 font-bold tracking-wide">{canonicalAnswer}</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {showTable && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
            <div className="bg-black border border-white/20 rounded-2xl p-6 max-w-4xl w-[92%] text-sm">
              <h2 className="text-2xl font-extrabold mb-4">Morse Code Chart</h2>
              <div className="border border-white/20 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-10 gap-px bg-white/10">
                  <div className="col-span-10 bg-black text-center py-1.5 font-bold text-sm">Numbers</div>
                  {["0","1","2","3","4","5","6","7","8","9"].map((d) => (
                    <div key={d} className="bg-black px-2 py-2 flex flex-col items-center justify-center gap-1 border border-white/10">
                      <span className="font-bold leading-none">{d}</span>
                      <span className="font-mono leading-none">{MORSE_MAP[d]}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-px bg-white/10 mt-2">
                  <div className="col-span-13 bg-black text-center py-1.5 font-bold text-sm">Letters</div>
                  {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map((ch) => (
                    <div key={ch} className="bg-black px-2 py-2 flex flex-col items-center justify-center gap-1 border border-white/10">
                      <span className="font-bold leading-none">{ch}</span>
                      <span className="font-mono leading-none">{MORSE_MAP[ch]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 text-right">
                <button onClick={() => { setShowTable(false); }} className="px-4 py-2 rounded bg-black border border-white/20 hover:bg-white/10">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
