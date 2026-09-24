import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  HelpCircle,
  Info,
  Instagram,
  Loader2,
  Lock,
  Mail,
  Mic,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  UploadCloud,
  Users,
  Volume2,
  Waves
} from "lucide-react";
import { adminFetch, adminLogin, getHealth, getNextParticipantId, getSessionContent, uploadRecording } from "./api";
import { getPending, removePending, saveLocalTest, savePending } from "./db";

const initialParticipant = {
  participant_id: "",
  age_group: "18-25",
  gender_category: "",
  native_language: "Urdu",
  environment: "E1",
  consent: false
};

const genderLabels = { female: "Female", male: "Male", unspecified: "Prefer not to say / Other" };
const classLabels = { D: "Distress", A: "Stern / Aggressive Lines", N: "Everyday Talking" };

function isValidParticipantId(value, gender) {
  const prefix = { female: "F", male: "M", unspecified: "U" }[gender];
  if (!prefix) return false;
  const match = value.trim().toUpperCase().match(new RegExp(`^${prefix}(\\d{2,3})$`));
  if (!match) return false;
  const number = Number(match[1]);
  return gender === "female" ? number >= 1 && number <= 75 : gender === "male" ? number >= 1 && number <= 20 : number >= 1 && number <= 99;
}

export function InstagramPill({ className = "", compact = false }) {
  return (
    <a
      href="https://www.instagram.com/shealertai"
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative inline-flex items-center gap-2.5 rounded-full text-white font-bold tracking-wide shadow-md transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] ${
        compact ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-xs sm:text-sm"
      } ${className}`}
      style={{
        background: "linear-gradient(90deg, #3b1262 0%, #85166f 55%, #e62872 100%)",
        boxShadow: "0 4px 14px rgba(133, 22, 111, 0.35)"
      }}
      title="Follow @shealertai on Instagram"
    >
      <Instagram size={compact ? 16 : 18} className="shrink-0 transition-transform duration-200 group-hover:rotate-6 text-white" strokeWidth={2.2} />
      <span className="font-semibold uppercase tracking-wider">FOLLOW @shealertai</span>
    </a>
  );
}

export function ContactSupportBanner() {
  return (
    <div className="rounded-2xl border border-purple-200/70 bg-gradient-to-r from-purple-50/90 via-pink-50/60 to-purple-50/80 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-gradient-to-br from-brand-indigo via-brand-purple to-brand-pink p-2.5 text-white shadow-sm shrink-0 mt-0.5">
            <Mail size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-purple">Have Questions or Queries?</span>
              <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-brand-pink">24/7 Support</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
              Email us at{" "}
              <a href="mailto:shealertai@gmail.com" className="font-bold text-brand-pink hover:underline">
                shealertai@gmail.com
              </a>{" "}
              or DM us on Instagram{" "}
              <a href="https://www.instagram.com/shealertai" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-purple hover:underline">
                @shealertai
              </a>
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 sm:self-center">
          <InstagramPill compact />
        </div>
      </div>
    </div>
  );
}

function Header({ onAdmin, health }) {
  const isDriveConnected = health?.google_drive_connected;
  return (
    <header className="sticky top-0 z-30 border-b border-purple-100/90 bg-white/95 backdrop-blur-md transition-all shadow-[0_1px_3px_rgba(43,17,84,0.05)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <a href="/" className="group flex items-center gap-3 focus:outline-none">
            <div className="relative flex items-center justify-center">
              <img
                src="/logo.png"
                alt="SheAlert Logo"
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-pink opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-pink"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#2b1154] via-[#7c1a6e] to-[#e11d74] bg-clip-text text-transparent">
                  SheAlert
                </span>
                {health && (
                  <span
                    title={isDriveConnected ? "Google Drive auto-sync is active" : "Recordings are stored safely on the server"}
                    className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isDriveConnected
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isDriveConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {isDriveConnected ? "Drive Connected" : "Local Server Mode"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Urdu Audio Dataset Collection</p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <InstagramPill compact />
          </div>
          <button
            onClick={onAdmin}
            className="rounded-xl border border-purple-200/80 bg-purple-50/50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-brand-purple transition hover:bg-purple-100/70 hover:text-brand-indigo"
          >
            Researcher Dashboard
          </button>
        </div>
      </div>
    </header>
  );
}

function Notice({ children, tone = "info" }) {
  const styles = {
    info: "border-purple-200 bg-purple-50/80 text-brand-purple",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700"
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles[tone]}`}>{children}</div>;
}

function ParticipantForm({ participant, setParticipant, onContinue, pending, onRetryPending, environments }) {
  const [isManual, setIsManual] = useState(false);
  const [loadingId, setLoadingId] = useState(false);
  const [idError, setIdError] = useState("");
  const [activeTab, setActiveTab] = useState("why");

  const update = (key) => (event) => {
    const val = event.target.type === "checkbox" ? event.target.checked : key === "participant_id" ? event.target.value.toUpperCase() : event.target.value;
    setParticipant((prev) => ({ ...prev, [key]: val }));
  };

  const fetchNextId = useCallback(async (gender) => {
    if (!gender) return;
    setLoadingId(true);
    setIdError("");
    try {
      const res = await getNextParticipantId(gender);
      if (res.participant_id) {
        setParticipant((prev) => ({ ...prev, participant_id: res.participant_id }));
      }
    } catch {
      setIdError("Auto-assignment unavailable. Please enter an ID manually.");
      setIsManual(true);
    } finally {
      setLoadingId(false);
    }
  }, [setParticipant]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get("id");
    if (urlId) {
      const upper = urlId.trim().toUpperCase();
      let detected = "";
      if (upper.startsWith("F")) detected = "female";
      else if (upper.startsWith("M")) detected = "male";
      else if (upper.startsWith("U")) detected = "unspecified";
      setParticipant((prev) => ({
        ...prev,
        participant_id: upper,
        ...(detected ? { gender_category: detected } : {})
      }));
      setIsManual(true);
    }
  }, [setParticipant]);

  const handleGenderChange = (gender) => {
    setParticipant((prev) => ({ ...prev, gender_category: gender }));
    if (!isManual && gender) {
      fetchNextId(gender);
    } else if (isManual && !participant.participant_id && gender) {
      fetchNextId(gender);
    }
  };

  const validId = isValidParticipantId(participant.participant_id, participant.gender_category);
  const valid = validId && participant.gender_category && participant.consent;
  const idHint = participant.gender_category === "male" ? "M01–M20" : participant.gender_category === "female" ? "F01–F75" : participant.gender_category === "unspecified" ? "U01–U99" : "F01–F75, M01–M20, or U01–U99";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-200/80 bg-gradient-to-br from-[#1b0a33] via-[#321259] to-[#601356] p-6 sm:p-10 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-pink/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 -mb-16 w-56 h-56 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md text-pink-200 border border-white/10">
              <Sparkles size={13} className="text-pink-300" />
              Air University · BS AI Research
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              <ShieldCheck size={13} />
              100% Zero-PII Anonymous
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
                Help Us Build <span className="bg-gradient-to-r from-pink-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">Safer AI Technology</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-purple-100/90 leading-relaxed">
                SheAlert is developing an automatic distress detection system for women in Pakistan. By recording short Urdu audio clips, you directly train the AI model that can save lives during acute emergencies.
              </p>
            </div>
            <div className="shrink-0 flex md:flex-col items-center gap-3">
              <img
                src="/logo.png"
                alt="SheAlert Shield Logo"
                className="h-20 w-20 sm:h-24 sm:w-24 object-contain filter drop-shadow-[0_10px_20px_rgba(225,29,116,0.4)] transition-transform hover:scale-105"
              />
              <InstagramPill compact />
            </div>
          </div>
        </div>
      </div>

      {/* Pending Uploads Alert */}
      {pending.length > 0 && (
        <Notice>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <span className="font-bold">{pending.length} pending upload{pending.length > 1 ? "s" : ""}</span> from an earlier session remain safely stored on this device.
            </span>
            <button
              onClick={onRetryPending}
              className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-indigo transition"
            >
              Retry saved uploads
            </button>
          </div>
        </Notice>
      )}

      {/* Purpose & Motivation Cards: Why Your Voice Matters */}
      <div className="rounded-3xl border border-purple-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Heart className="text-brand-pink fill-brand-pink" size={22} />
              Why Your Voice Matters
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Understanding why both female and male voices are required to build an accurate safety model.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("why")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "why" ? "bg-white text-brand-purple shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Voices Needed
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("privacy")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "privacy" ? "bg-white text-brand-purple shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Privacy & Ethics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guide")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "guide" ? "bg-white text-brand-purple shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Recording Tips
            </button>
          </div>
        </div>

        {activeTab === "why" && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Female Contribution Card */}
            <div className="rounded-2xl border border-pink-200/80 bg-gradient-to-br from-pink-50/70 via-rose-50/40 to-white p-5 sm:p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-extrabold text-brand-pink border border-pink-200">
                  Target: 75 Volunteers (F01–F75)
                </span>
                <span className="text-2xl">👩</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                For Female Contributors: Acute Distress Detection
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                SheAlert is building Pakistan’s first acoustic distress dataset for Urdu phrases like <span className="font-semibold text-slate-800">"Bachao"</span>, <span className="font-semibold text-slate-800">"Madad karo"</span>, and <span className="font-semibold text-slate-800">"Choro mujhe"</span>.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                When someone is being grabbed or frozen in fear, they often cannot touch their phone. The model listens for authentic vocal patterns to trigger an automated SOS. Diverse pitches and regional accents ensure the system never misses a cry for help.
              </p>
              <div className="mt-4 pt-3 border-t border-pink-100 flex items-center gap-2 text-xs font-semibold text-brand-pink">
                <CheckCircle2 size={15} /> 20 short takes (~10 minutes total)
              </div>
            </div>

            {/* Male Contribution Card */}
            <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-white p-5 sm:p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-extrabold text-brand-purple border border-purple-200">
                  Target: 20 Volunteers (M01–M20)
                </span>
                <span className="text-2xl">👨</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                For Male Contributors: Contrast & False-Alarm Prevention
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Why are male voices needed? To prevent false alarms! The AI requires acoustic contrast data—including aggressive commands, stern tones, and everyday conversational Urdu.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Your recordings train the AI to distinguish between real distress calls and background speech or attacker threats, preventing unnecessary alerts while ensuring absolute reliability in crises.
              </p>
              <div className="mt-4 pt-3 border-t border-purple-100 flex items-center gap-2 text-xs font-semibold text-brand-purple">
                <CheckCircle2 size={15} /> 30 short takes (~15 minutes total)
              </div>
            </div>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-100 p-3 text-brand-purple shrink-0">
                <Lock size={22} />
              </div>
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Zero-PII & Complete Privacy Guarantee
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>No Personal Information:</strong> We do NOT ask for or store your name, phone number, CNIC, email, or any personal identifier.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Anonymous Identifiers:</strong> You are identified solely by a random research code (e.g. F07 or M08).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Academic Research Only:</strong> Conducted under faculty supervision at Air University (Dept. of Creative Technologies) in accordance with research ethics protocols.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Right to Withdraw:</strong> You can stop recording or request deletion at any time without giving any reason.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === "guide" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-purple text-xs text-white font-bold">1</span>
                Distance: ~30 cm
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hold or place your phone about 30 cm (approx. one foot) from your mouth. This prevents audio distortion and breath pops.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-pink text-xs text-white font-bold">2</span>
                Simulation & Acting
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                All lines are simulated acting—there is no real danger! Express the designated tone (Mild or Urgent) naturally without straining your voice.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white font-bold">3</span>
                Test & Re-record
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                You will record a 5-second test clip first. During the session, you can always listen back and re-record any take until satisfied.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Participant Form Card */}
      <div className="rounded-3xl border border-purple-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Volunteer Setup</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select your voice category to automatically receive your reserved anonymous volunteer ID.
          </p>
        </div>

        {/* 1. Voice Category Selector Cards */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">
            Select Voice / Gender Category <span className="text-brand-pink">*</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleGenderChange("female")}
              className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                participant.gender_category === "female"
                  ? "border-pink-500 bg-pink-50/50 shadow-md ring-2 ring-pink-500/20"
                  : "border-slate-200 hover:border-pink-300 hover:bg-slate-50"
              }`}
            >
              <div className={`rounded-xl p-3 text-xl ${participant.gender_category === "female" ? "bg-brand-pink text-white" : "bg-pink-100 text-pink-700"}`}>
                👩
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Female Voice</p>
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-extrabold text-brand-pink">
                    F01 – F75
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  20 clips · Distress calls (Bachao, Madad karo), stern lines, and casual speech.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleGenderChange("male")}
              className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                participant.gender_category === "male"
                  ? "border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20"
                  : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
              }`}
            >
              <div className={`rounded-xl p-3 text-xl ${participant.gender_category === "male" ? "bg-brand-purple text-white" : "bg-purple-100 text-purple-700"}`}>
                👨
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Male Voice</p>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-extrabold text-brand-purple">
                    M01 – M20
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  30 clips · Acoustic contrast control, aggressive lines, and casual Urdu speech.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Anonymous Volunteer ID */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-slate-800">
              Anonymous Volunteer ID <span className="text-brand-pink">*</span>
            </label>
            {participant.gender_category && (
              <button
                type="button"
                onClick={() => setIsManual(!isManual)}
                className="text-xs font-semibold text-brand-purple hover:underline"
              >
                {isManual ? "Switch to Auto-Assign" : "Have a specific assigned ID? Enter manually"}
              </button>
            )}
          </div>

          {!participant.gender_category ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-center text-sm text-slate-500">
              Please choose your voice category above to generate your unique ID.
            </div>
          ) : isManual ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  required
                  value={participant.participant_id}
                  onChange={update("participant_id")}
                  placeholder={idHint}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-lg font-bold uppercase outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(false);
                    fetchNextId(participant.gender_category);
                  }}
                  className="shrink-0 rounded-2xl border border-purple-300 bg-purple-50 px-4 py-3 text-xs font-bold text-brand-purple hover:bg-purple-100 transition"
                >
                  Auto-assign
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Format: {idHint}</span>
                {validId && <span className="font-semibold text-emerald-600">✓ Valid ID format</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-purple-200/90 bg-gradient-to-r from-purple-50/60 to-pink-50/40 p-4">
              <div className="flex items-center gap-3.5">
                {loadingId ? (
                  <Loader2 className="animate-spin text-brand-purple" size={24} />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-brand-purple font-bold">
                    <CheckCircle2 size={22} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-black tracking-wider text-brand-indigo">
                      {loadingId ? "Assigning…" : participant.participant_id || "None"}
                    </span>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-brand-purple">
                      Auto-assigned · Conflict-free
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reserved automatically so your data never clashes with other volunteers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchNextId(participant.gender_category)}
                disabled={loadingId}
                title="Generate another available ID"
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <RefreshCw size={16} className={loadingId ? "animate-spin" : ""} />
              </button>
            </div>
          )}
          {idError && <p className="mt-1.5 text-xs text-red-600">{idError}</p>}
        </div>

        {/* 3. Additional Metadata Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Age Group</label>
            <select
              value={participant.age_group}
              onChange={update("age_group")}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            >
              <option>Under 18</option>
              <option>18-25</option>
              <option>26-35</option>
              <option>36-50</option>
              <option>51+</option>
              <option>Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Native Language</label>
            <input
              value={participant.native_language}
              onChange={update("native_language")}
              placeholder="e.g. Urdu, Punjabi, Pashto, Sindhi"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-800 mb-2">Recording Environment</label>
            <select
              value={participant.environment}
              onChange={update("environment")}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            >
              {Object.entries(environments).map(([code, label]) => (
                <option key={code} value={code}>
                  {code} — {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Select the real setting where you are recording this session.
            </span>
          </div>
        </div>

        {/* 4. Consent Agreement */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 sm:p-5 text-sm leading-6 text-slate-700">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-purple" />
            Informed Research Consent
          </p>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
            I understand that my voice recordings will be collected anonymously for academic research and training the SheAlert women-safety system, labeled strictly under my anonymous ID without personal data.
          </p>
          <label className="mt-3.5 flex cursor-pointer items-start gap-3 font-medium text-slate-900">
            <input
              type="checkbox"
              checked={participant.consent}
              onChange={update("consent")}
              className="mt-1 h-5 w-5 rounded accent-brand-purple cursor-pointer"
            />
            <span className="text-xs sm:text-sm">
              I agree to participate and allow my anonymous voice recordings to be used for this safety research dataset.
            </span>
          </label>
        </div>

        {/* 5. Submit CTA */}
        <button
          disabled={!valid}
          onClick={onContinue}
          className="group flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: valid
              ? "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
              : "#cbd5e1"
          }}
        >
          <span className="text-base sm:text-lg">Continue to Recording Session</span>
          <ChevronRight size={22} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Contact & Support Banner */}
      <ContactSupportBanner />
    </main>
  );
}

let sharedAudioContext = null;
function getSharedAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

function Recorder({ item, participant, filename, localOnly = false, onSuccess }) {
  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [quietWarning, setQuietWarning] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const peakRef = useRef(0);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const disconnectAudioNodes = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch {}
      analyserRef.current = null;
    }
  };

  const watchLevel = () => {
    if (!analyserRef.current) return;
    const values = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(values);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      const norm = (values[i] - 128) / 128;
      sum += norm * norm;
    }
    const rms = Math.sqrt(sum / values.length);
    const current = Math.min(100, Math.round(rms * 220));
    peakRef.current = Math.max(peakRef.current, current);
    setLevel(current);
    animationRef.current = requestAnimationFrame(watchLevel);
  };

  const start = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone recording.");
      return;
    }
    try {
      disconnectAudioNodes();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;
      peakRef.current = 0;
      setQuietWarning(false);

      const context = getSharedAudioContext();
      if (context) {
        if (context.state === "suspended") {
          await context.resume();
        }
        audioContextRef.current = context;

        const source = context.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        watchLevel();
      }

      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((candidate) =>
        MediaRecorder.isTypeSupported(candidate)
      ) || "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(audioBlob);
        const isSuspiciouslyQuiet = peakRef.current === 0 && audioBlob.size < 4000;
        setQuietWarning(isSuspiciouslyQuiet);
      };

      recorder.start(100);
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } catch (startError) {
      setError(startError.message || "Microphone access was denied or failed.");
      stopTracks();
      disconnectAudioNodes();
    }
  };

  const stop = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    stopTracks();
    disconnectAudioNodes();
    setStatus("ready");
  };

  const rerecord = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    stopTracks();
    disconnectAudioNodes();
    setStatus("idle");
    setSeconds(0);
    setLevel(0);
    setBlob(null);
    setError("");
    setPendingId(null);
    setQuietWarning(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Playback error:", err);
          setIsPlaying(false);
          setError("Audio playback error. Your recording may be silent or unsupported.");
        });
    }
  };

  useEffect(() => {
    if (!blob) {
      setAudioUrl(null);
      setIsPlaying(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const submit = async () => {
    if (!blob || status === "submitting") return;
    if (localOnly && seconds < 5) {
      setError("Please record the full 5-second test clip.");
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    const id = pendingId || crypto.randomUUID();
    setPendingId(id);
    if (localOnly) {
      await saveLocalTest({
        id,
        participant_id: participant.participant_id,
        environment: participant.environment,
        blob,
        createdAt: Date.now()
      });
      setStatus("done");
      onSuccess();
      return;
    }
    const metadata = {
      ...participant,
      recording_id: id,
      phrase_id: item.phrase_code,
      phrase_text: item.word,
      translation: item.meaning || item.prompt || item.word,
      category: item.category,
      section_class: item.section_class,
      take_code: item.take.code,
      recording_number: item.recordingNumber,
      consent: true
    };
    const pendingItem = { id, metadata, blob, filename: `${filename}.webm`, createdAt: Date.now() };
    try {
      await savePending(pendingItem);
    } catch {}
    setStatus("submitting");
    try {
      const res = await uploadRecording(pendingItem);
      await removePending(id);
      setUploadResult(res);
      setStatus("done");
    } catch (uploadError) {
      setStatus("ready");
      setError(uploadError.message || "Upload failed. Your recording has not been lost.");
    }
  };

  useEffect(() => {
    setStatus("idle");
    setSeconds(0);
    setLevel(0);
    setBlob(null);
    setError("");
    setPendingId(null);
    setQuietWarning(false);
    setUploadResult(null);
  }, [filename]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
      stopTracks();
      disconnectAudioNodes();
    };
  }, []);

  return (
    <section className="rounded-3xl border border-purple-100 bg-white p-6 sm:p-10 shadow-sm">
      {/* Title & Script Presentation */}
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider bg-purple-100 text-brand-purple border border-purple-200">
          {localOnly ? "Pre-session test" : `Section ${item.section_class} · ${classLabels[item.section_class]}`}
        </span>

        {localOnly ? (
          <>
            <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold text-slate-900">5-Second Audio Test Clip</h1>
            <p className="mt-3 max-w-md mx-auto text-sm text-slate-600 leading-relaxed">
              Verify your microphone clarity before starting. This test clip is saved locally and is never sent to the server.
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 text-3xl font-black text-slate-900 sm:text-5xl tracking-wide font-urdu">
              {item.word}
            </p>
            {item.prompt && (
              <p className="mt-3 text-base sm:text-lg font-bold text-brand-purple">
                Ask or Answer in Casual Urdu
              </p>
            )}
            <p className="mt-2 text-sm sm:text-base text-slate-600 font-medium">
              {item.prompt || item.meaning}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {item.take?.label && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {item.take.label}
                </span>
              )}
              {item.intensity && (
                <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-brand-pink border border-pink-200">
                  Target Tone: {item.intensity}
                </span>
              )}
              {item.loudness && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-brand-purple border border-purple-200">
                  Loudness: {item.loudness}
                </span>
              )}
            </div>

            {item.direction && (
              <p className="mt-3 text-xs sm:text-sm font-semibold text-brand-purple bg-purple-50/70 inline-block px-4 py-1.5 rounded-full border border-purple-100">
                Direction: {item.direction}
              </p>
            )}
            {item.prompt && (
              <p className="mt-3 text-xs text-slate-500 max-w-md mx-auto">
                Answer in your own words for about 5 to 7 seconds. You do not need to read a rigid script for this section.
              </p>
            )}
          </>
        )}
      </div>

      {/* Live VU / Audio Level Meter */}
      <div className="mb-8 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/40 via-white to-pink-50/30 p-5">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2">
            <Volume2 size={16} className={status === "recording" ? "text-brand-pink animate-pulse" : "text-slate-400"} />
            {status === "recording"
              ? "Recording in progress…"
              : status === "submitting"
              ? "Uploading securely…"
              : status === "done"
              ? "Saved successfully!"
              : "Microphone ready"}
          </span>
          <span className="font-mono text-base font-bold text-brand-purple">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </span>
        </div>

        {/* Visual Bar */}
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/80 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${status === "recording" ? Math.max(level, 4) : Math.min(100, (seconds / (localOnly ? 5 : 15)) * 100)}%`,
              background: level > 85 ? "#e11d74" : "linear-gradient(90deg, #3b1262 0%, #85166f 50%, #e62872 100%)"
            }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500 font-medium">
          Microphone Level · Hold phone approximately 30 cm from mouth.
        </p>
      </div>

      {/* Error or Warning notices */}
      {error && (
        <div className="mb-6">
          <Notice tone="error">
            {error} {pendingId && !localOnly && <span className="font-bold">Clip saved safely on device for retry.</span>}
          </Notice>
        </div>
      )}

      {quietWarning && (
        <div className="mb-6">
          <Notice tone="info">
            Notice: Audio signal appears very quiet. Please ensure your microphone is unobstructed and speak clearly.
          </Notice>
        </div>
      )}

      {/* Action Controls */}
      {status === "done" ? (
        <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
          <div className="flex items-center gap-2 text-lg font-bold text-emerald-700">
            <CheckCircle2 size={24} />
            <span>
              {localOnly
                ? "Test clip saved on this device only!"
                : uploadResult?.drive_file_id
                ? "Take submitted & backed up to Google Drive!"
                : "Take submitted & saved safely on research server!"}
            </span>
          </div>
          {!localOnly && !uploadResult?.drive_file_id && (
            <p className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
              Note: Remote Google Drive upload is pending or unconfigured. Audio is safely stored on the local server.
            </p>
          )}
          <button
            onClick={onSuccess}
            className="flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
            style={{
              background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
            }}
          >
            Continue to Next Take <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {status === "idle" && (
            <button
              onClick={start}
              className="flex min-h-14 items-center justify-center gap-2.5 rounded-2xl px-8 py-4 font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
              }}
            >
              <Mic size={20} />
              <span>Start Recording</span>
            </button>
          )}

          {status === "recording" && (
            <button
              onClick={stop}
              className="relative flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-brand-pink px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-pink-700 active:scale-95"
            >
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </span>
              <Square size={18} fill="currentColor" />
              <span>Stop Recording</span>
            </button>
          )}

          {status === "ready" && (
            <>
              <button
                type="button"
                onClick={togglePlayback}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-6 py-4 font-bold transition ${
                  isPlaying
                    ? "border-purple-600 bg-purple-100 text-brand-purple"
                    : "border-slate-300 hover:bg-slate-50 text-slate-700"
                }`}
              >
                {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} />}
                <span>{isPlaying ? "Pause Playback" : "Play Recording"}</span>
              </button>

              <button
                onClick={rerecord}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-6 py-4 font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <RefreshCw size={18} />
                <span>Record Again</span>
              </button>

              <button
                onClick={submit}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl px-7 py-4 font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
                }}
              >
                {localOnly ? (
                  "Save Test Locally"
                ) : (
                  <>
                    <UploadCloud size={18} />
                    <span>Submit Take</span>
                  </>
                )}
              </button>
            </>
          )}

          {status === "submitting" && (
            <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-300 px-8 py-4 font-bold text-white">
              <Loader2 className="animate-spin" />
              <span>Uploading Take…</span>
            </button>
          )}
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onEnded={() => setIsPlaying(false)}
          onError={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </section>
  );
}

function Session({ participant, content, onDone }) {
  const contentGender = participant.gender_category === "male" ? "male" : "female";
  const sections = content[contentGender].sections;
  const items = useMemo(() => {
    let recordingNumber = 0;
    return sections.flatMap((section) =>
      section.items.flatMap((item) =>
        item.takes.map((take) => ({
          ...item,
          ...take,
          phrase_code: item.code,
          take,
          section_class: section.class,
          category: section.title,
          instruction: section.instruction,
          recordingNumber: ++recordingNumber
        }))
      )
    );
  }, [sections]);

  const [index, setIndex] = useState(-1);
  const [testDone, setTestDone] = useState(false);
  const item = items[index];
  const paddedId = participant.participant_id
    ? `${participant.participant_id[0]}${String(Number(participant.participant_id.slice(1))).padStart(3, "0")}`
    : "";
  const filename = item
    ? `SHEA_${paddedId}_${item.section_class}_${item.phrase_code}_${item.take.code}_E${String(Number(participant.environment.slice(1))).padStart(2, "0")}`
    : "";
  const section = item && sections.find((value) => value.class === item.section_class);

  if (!testDone)
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-6">
        <div className="rounded-3xl border border-purple-100 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-purple">
              Pre-Session Check
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Prepare Your Recording</h1>
          <p className="mt-2 text-sm text-slate-600">
            Follow these simple steps before beginning the research collection to ensure high audio quality:
          </p>

          <div className="mt-5 space-y-3 rounded-2xl border border-purple-100 bg-purple-50/30 p-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">1</span>
              <span><strong>Anonymity:</strong> Your assigned ID is <strong className="font-mono text-brand-purple">{participant.participant_id}</strong>. Your real identity is never recorded.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">2</span>
              <span><strong>Simulated Acting:</strong> All spoken lines are acting. There is zero real danger. Take breaths whenever you need.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">3</span>
              <span><strong>Distance:</strong> Hold or place your device ~30 cm away from your mouth in your selected setting ({participant.environment}).</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">4</span>
              <span><strong>Test Clip:</strong> Record a 5-second test clip below to check that your microphone is working clearly.</span>
            </div>
          </div>
        </div>

        <Recorder localOnly participant={participant} item={{}} filename="test" onSuccess={() => setTestDone(true)} />
      </main>
    );

  if (index === -1)
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center space-y-6">
        <div className="rounded-3xl border border-purple-100 bg-white p-8 sm:p-12 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Microphone Verified!</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-md mx-auto">
            Your audio test succeeded. The session consists of <strong className="text-brand-purple">{content[contentGender].clips} clips</strong> ({content[contentGender].approx_time}).
          </p>
          <button
            onClick={() => setIndex(0)}
            className="mt-8 flex w-full sm:w-auto mx-auto items-center justify-center gap-2.5 rounded-2xl px-10 py-4 font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
            }}
          >
            <span>Start Section {sections[0]?.class} ({sections[0]?.title})</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </main>
    );

  if (!item)
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center space-y-6">
        <div className="rounded-3xl border border-purple-100 bg-white p-8 sm:p-10 shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-indigo to-brand-pink text-white mb-6 shadow-md">
            <Heart size={40} className="fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Shukriya! Thank You!</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            You have successfully completed all audio clips for volunteer <strong className="font-mono text-brand-purple">{participant.participant_id}</strong>. Your contribution brings us one step closer to safer women in Pakistan.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <InstagramPill />
            <button
              onClick={onDone}
              className="rounded-full border border-slate-300 px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Finish & Return Home
            </button>
          </div>
        </div>

        <ContactSupportBanner />
      </main>
    );

  const sectionStart = index === 0 || items[index - 1].section_class !== item.section_class;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-6">
      {/* Session Progress Header */}
      <div className="rounded-2xl border border-purple-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-600 mb-2.5">
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-black text-brand-purple">
              {item.section_class}
            </span>
            {section?.title}
          </span>
          <span className="font-mono text-brand-purple">
            Clip {index + 1} of {items.length}
          </span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((index + 1) / items.length) * 100}%`,
              background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
            }}
          />
        </div>
      </div>

      {sectionStart && (
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/80 to-pink-50/50 p-5 text-sm text-brand-purple shadow-sm">
          <p className="font-extrabold text-base text-slate-900">{section?.title}</p>
          <p className="mt-1 font-medium text-slate-700">{section?.instruction}</p>
        </div>
      )}

      <Recorder
        key={filename || `clip-${index}`}
        item={item}
        participant={participant}
        filename={filename}
        onSuccess={() => setIndex((value) => value + 1)}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="font-bold text-slate-700">Dataset File ID: </span>
          <span className="font-mono font-semibold text-brand-purple">{filename}.wav</span>
        </div>
        <span>Original 16 kHz uncompressed research recording</span>
      </div>

      <ContactSupportBanner />
    </main>
  );
}

function Admin({ onBack }) {
  const [token, setToken] = useState(sessionStorage.getItem("shealert-admin") || "");
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  const load = useCallback(async (auth = token) => {
    try {
      const response = await adminFetch("/api/stats", auth);
      setStats(await response.json());
      setError("");
    } catch {
      setToken("");
      sessionStorage.removeItem("shealert-admin");
      setError("Please sign in with the administrator password.");
    }
  }, [token]);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const login = async (event) => {
    event.preventDefault();
    try {
      const result = await adminLogin(password);
      sessionStorage.setItem("shealert-admin", result.token);
      setToken(result.token);
      setPassword("");
    } catch (e) {
      setError(e.message);
    }
  };

  const retry = async () => {
    await adminFetch("/api/admin/retry-failed", token, { method: "POST" });
    load();
  };

  const syncDrive = async () => {
    setSyncStatus("Syncing with Google Drive...");
    try {
      const response = await adminFetch("/api/admin/sync-drive", token, { method: "POST" });
      const data = await response.json();
      setSyncStatus(`Sync finished: ${data.synced_count} files backed up, ${data.failed_count} failures.`);
      load();
    } catch (err) {
      setSyncStatus(`Drive sync error: ${err.message}`);
    }
  };

  const download = async () => {
    const response = await adminFetch("/api/metadata/export", token);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "shealert_metadata.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!token || !stats)
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-purple hover:underline"
        >
          ← Return to Volunteer Collection
        </button>

        <form
          onSubmit={login}
          className="mx-auto max-w-md rounded-3xl border border-purple-100 bg-white p-8 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-purple-100 p-2.5 text-brand-purple">
              <Lock size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Researcher Dashboard</h1>
              <p className="text-xs text-slate-500">Authorized research administration only.</p>
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter research admin password"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl py-3.5 font-bold text-white shadow-md transition hover:opacity-95"
            style={{
              background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
            }}
          >
            Sign In to Dashboard
          </button>
        </form>
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-purple hover:underline"
      >
        ← Return to Volunteer Collection
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-purple">Air University Research</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Dataset Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncDrive}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
            }}
          >
            <UploadCloud size={16} /> Sync to Google Drive
          </button>
          <button
            onClick={retry}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw size={16} /> Retry Failed
          </button>
          <button
            onClick={download}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Download size={16} /> Export Metadata
          </button>
          <button
            onClick={() => load()}
            title="Refresh statistics"
            className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {syncStatus && (
        <div>
          <Notice tone="info">{syncStatus}</Notice>
        </div>
      )}

      {/* Stats Counter Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Total Participants", stats.total_participants, "👥"],
          ["Total Recordings", stats.total_recordings, "🎙️"],
          ["Completed Uploads", stats.completed_recordings, "✅"],
          ["Failed Uploads", stats.failed_recordings, "⚠️"]
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
              <span className="text-lg">{icon}</span>
            </div>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Gender Breakdown & Recent Records */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4">
            <BarChart3 size={20} className="text-brand-purple" /> Targets by Gender
          </h2>

          {Object.entries(stats.targets || {}).map(([key, target]) => (
            <div key={key} className="mt-4">
              <div className="flex justify-between text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                <span>{genderLabels[key]} ({target.prefix}01–{target.prefix}{target.max})</span>
                <span className="font-mono text-brand-purple">
                  {stats.per_gender?.[key]?.count || 0} / {target.total_clips} clips
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((stats.per_gender?.[key]?.count || 0) / target.total_clips) * 100)}%`,
                    background: "linear-gradient(90deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)"
                  }}
                />
              </div>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            <p>
              <strong>By Section:</strong> Distress (D): {stats.per_section?.D || 0} · Aggressive (A): {stats.per_section?.A || 0} · Normal (N): {stats.per_section?.N || 0}
            </p>
            <p>
              <strong>Environments:</strong> {Object.entries(stats.per_environment || {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "None"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Dataset Takes</h2>
          <div className="divide-y divide-slate-100">
            {stats.recent.slice(0, 8).map((row) => (
              <div key={row.recording_id} className="flex items-center justify-between py-3 text-xs sm:text-sm">
                <div>
                  <p className="font-bold text-slate-800">
                    {row.phrase_id} · {row.participant_id}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {genderLabels[row.gender_category]} · {row.section_class} · {row.environment} · {row.upload_status}
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {row.duration_seconds ? `${row.duration_seconds}s` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-purple-100 bg-white py-12 text-slate-600">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SheAlert Logo" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-base font-extrabold tracking-tight text-slate-900">
                SheAlert AI
              </p>
              <p className="text-xs text-slate-500">
                Automatic Women Safety System · Air University Islamabad
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <InstagramPill compact />
            <a
              href="mailto:shealertai@gmail.com"
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50/60 px-4 py-2 text-xs font-bold text-brand-purple hover:bg-purple-100 transition"
            >
              <Mail size={15} />
              <span>shealertai@gmail.com</span>
            </a>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            © 2026 SheAlert Research Team · Department of Creative Technologies, Air University.
          </p>
          <p>
            Anonymous audio dataset distributed under <strong className="text-slate-700">CC-BY-4.0</strong> for academic safety research.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [screen, setScreen] = useState(window.location.pathname === "/admin" ? "admin" : "participant");
  const [participant, setParticipant] = useState(initialParticipant);
  const [started, setStarted] = useState(false);
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getSessionContent().then(setContent).catch((error) => setLoadError(error.message));
    getPending().then(setPending).catch(() => {});
    getHealth().then(setHealth).catch(() => {});
  }, []);

  const retryPending = async () => {
    for (const item of pending) {
      try {
        await uploadRecording(item);
        await removePending(item.id);
      } catch {}
    }
    setPending(await getPending());
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-800 antialiased selection:bg-brand-pink/20 selection:text-brand-purple">
      <Header onAdmin={() => setScreen("admin")} health={health} />
      <div className="flex-1">
        {screen === "admin" ? (
          <Admin onBack={() => setScreen("participant")} />
        ) : !content ? (
          <main className="mx-auto max-w-xl px-4 py-24 text-center">
            {loadError ? (
              <Notice tone="error">{loadError}</Notice>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-brand-purple" size={36} />
                <p className="text-sm font-semibold text-slate-600">Loading SheAlert research session…</p>
              </div>
            )}
          </main>
        ) : !participant.consent || !started ? (
          <ParticipantForm
            participant={participant}
            setParticipant={setParticipant}
            pending={pending}
            onRetryPending={retryPending}
            environments={content.environments}
            onContinue={() => setStarted(true)}
          />
        ) : (
          <Session
            participant={participant}
            content={content}
            onDone={() => {
              setParticipant(initialParticipant);
              setStarted(false);
              setPending([]);
            }}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
