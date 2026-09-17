import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, ChevronRight, Download, Loader2, Mic, Play, RefreshCw, ShieldCheck, Square, UploadCloud, Waves } from "lucide-react";
import { adminFetch, adminLogin, getNextParticipantId, getSessionContent, uploadRecording } from "./api";
import { getPending, removePending, saveLocalTest, savePending } from "./db";

const initialParticipant = { participant_id: "", age_group: "18-25", gender_category: "", native_language: "Urdu", environment: "E1", consent: false };
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

function Header({ onAdmin }) {
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-teal p-2 text-white"><Waves size={22} /></div><div><p className="font-bold tracking-tight">SheAlert</p><p className="text-xs text-slate-500">Audio research collection</p></div></div><button onClick={onAdmin} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Researcher dashboard</button></div></header>;
}

function Notice({ children, tone = "info" }) {
  const styles = { info: "border-teal/20 bg-mint text-teal", error: "border-red-200 bg-red-50 text-red-700", success: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function ParticipantForm({ participant, setParticipant, onContinue, pending, onRetryPending, environments }) {
  const [isManual, setIsManual] = useState(false);
  const [loadingId, setLoadingId] = useState(false);
  const [idError, setIdError] = useState("");

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

  const handleGenderChange = (event) => {
    const gender = event.target.value;
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
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal">Participant setup</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help us build safer technology.</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Record short Urdu phrases for academic research. We collect no contact details or government identifiers.
        </p>
        {pending.length > 0 && (
          <div className="mt-5">
            <Notice>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{pending.length} pending upload{pending.length > 1 ? "s" : ""}</span> from an earlier session remain safely on this device.
                </span>
                <button onClick={onRetryPending} className="rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white">
                  Retry saved uploads
                </button>
              </div>
            </Notice>
          </div>
        )}
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* 1. Voice / Gender Category FIRST */}
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-slate-800">
              Voice / gender category <span className="text-coral">*</span>
              <select
                required
                value={participant.gender_category}
                onChange={handleGenderChange}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              >
                <option value="">Select voice category</option>
                {Object.entries(genderLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Select your category to automatically receive your anonymous research ID.
            </span>
          </div>

          {/* 2. Volunteer ID (Auto-assigned or Manual) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800">
                Anonymous Volunteer ID <span className="text-coral">*</span>
              </label>
              {participant.gender_category && (
                <button
                  type="button"
                  onClick={() => setIsManual(!isManual)}
                  className="text-xs font-medium text-teal hover:underline"
                >
                  {isManual ? "Switch to Auto-Assign" : "Have a specific ID? Enter manually"}
                </button>
              )}
            </div>

            {!participant.gender_category ? (
              <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Please select your voice/gender category above to generate your unique ID.
              </div>
            ) : isManual ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-2">
                  <input
                    required
                    value={participant.participant_id}
                    onChange={update("participant_id")}
                    placeholder={idHint}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono font-bold uppercase outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsManual(false);
                      fetchNextId(participant.gender_category);
                    }}
                    className="shrink-0 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-xs font-semibold text-teal hover:bg-teal/20"
                  >
                    Auto-assign
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Allowed: {idHint}</span>
                  {validId && <span className="font-semibold text-emerald-600">✓ Valid ID format</span>}
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-teal/30 bg-teal/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  {loadingId ? (
                    <Loader2 className="animate-spin text-teal" size={22} />
                  ) : (
                    <CheckCircle2 className="text-teal" size={22} />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-bold tracking-wide text-teal">
                        {loadingId ? "Generating…" : participant.participant_id || "None"}
                      </span>
                      <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-xs font-semibold text-teal">
                        Auto-assigned · Conflict-free
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Reserved automatically so your data never clashes with other volunteers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchNextId(participant.gender_category)}
                  disabled={loadingId}
                  title="Generate another available ID"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loadingId ? "animate-spin" : ""} />
                </button>
              </div>
            )}
            {idError && <p className="mt-1 text-xs text-red-600">{idError}</p>}
          </div>

          {/* 3. Age group */}
          <label className="text-sm font-semibold">
            Age group
            <select
              value={participant.age_group}
              onChange={update("age_group")}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-teal"
            >
              <option>Under 18</option>
              <option>18-25</option>
              <option>26-35</option>
              <option>36-50</option>
              <option>51+</option>
              <option>Prefer not to say</option>
            </select>
          </label>

          {/* 4. Native language */}
          <label className="text-sm font-semibold">
            Native language
            <input
              value={participant.native_language}
              onChange={update("native_language")}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-teal"
            />
          </label>

          {/* 5. Recording environment */}
          <label className="text-sm font-semibold sm:col-span-2">
            Recording environment
            <select
              value={participant.environment}
              onChange={update("environment")}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-teal"
            >
              {Object.entries(environments).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Consent */}
        <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold">Consent</p>
          <p className="mt-1">
            I understand that my voice recordings will be collected for academic research and development of the SheAlert women-safety system, and labeled according to the voice/gender category I select.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 font-medium">
            <input
              type="checkbox"
              checked={participant.consent}
              onChange={update("consent")}
              className="mt-1 h-5 w-5 accent-teal"
            />
            I agree to participate and allow my voice recordings to be used for this research.
          </label>
        </div>

        <button
          disabled={!valid}
          onClick={onContinue}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-5 py-4 font-bold text-white shadow-sm transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue to session <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-5 flex gap-3 text-xs text-slate-500">
        <ShieldCheck size={16} className="shrink-0 text-teal" />
        Your recording is kept private and stored only for this research dataset.
      </div>
    </main>
  );
}

function Recorder({ item, participant, filename, localOnly = false, onSuccess }) {
  const [status, setStatus] = useState("idle"); const [seconds, setSeconds] = useState(0); const [level, setLevel] = useState(0); const [blob, setBlob] = useState(null); const [error, setError] = useState(""); const [pendingId, setPendingId] = useState(null); const [quietWarning, setQuietWarning] = useState(false);
  const recorderRef = useRef(null); const chunksRef = useRef([]); const timerRef = useRef(null); const animationRef = useRef(null); const streamRef = useRef(null); const audioRef = useRef(null); const analyserRef = useRef(null); const peakRef = useRef(0);
  const stopTracks = () => streamRef.current?.getTracks().forEach((track) => track.stop());
  const watchLevel = () => { if (!analyserRef.current) return; const values = new Uint8Array(analyserRef.current.fftSize); analyserRef.current.getByteTimeDomainData(values); const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length); const current = Math.min(100, Math.round(rms * 180)); peakRef.current = Math.max(peakRef.current, current); setLevel(current); animationRef.current = requestAnimationFrame(watchLevel); };
  const start = async () => { setError(""); if (!navigator.mediaDevices?.getUserMedia) { setError("This browser does not support microphone recording."); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); streamRef.current = stream; peakRef.current = 0; setQuietWarning(false); const context = new AudioContext(); const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser); analyserRef.current = analyser; watchLevel(); const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ""; const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); recorderRef.current = recorder; chunksRef.current = []; recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data); recorder.onstop = () => { const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); setBlob(audioBlob); setQuietWarning(peakRef.current < 4); setStatus("ready"); stopTracks(); cancelAnimationFrame(animationRef.current); setLevel(0); }; recorder.start(250); setSeconds(0); setStatus("recording"); timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000); } catch { setError("Microphone access was denied. Please allow microphone access and try again."); } };
  const stop = () => { if (recorderRef.current?.state === "recording") { recorderRef.current.stop(); clearInterval(timerRef.current); } };
  const rerecord = () => { setBlob(null); setStatus("idle"); setSeconds(0); setError(""); };
  const submit = async () => { if (!blob || status === "submitting") return; if (localOnly && seconds < 5) { setError("Please record the full 5-second test clip."); return; } const id = pendingId || crypto.randomUUID(); setPendingId(id); if (localOnly) { await saveLocalTest({ id, participant_id: participant.participant_id, environment: participant.environment, blob, createdAt: Date.now() }); setStatus("done"); onSuccess(); return; } const metadata = { ...participant, recording_id: id, phrase_id: item.phrase_code, phrase_text: item.word, translation: item.meaning || item.prompt || item.word, category: item.category, section_class: item.section_class, take_code: item.take.code, recording_number: item.recordingNumber, consent: true }; const pendingItem = { id, metadata, blob, filename: `${filename}.webm`, createdAt: Date.now() }; try { await savePending(pendingItem); } catch {} setStatus("submitting");     try {
      await uploadRecording(pendingItem);
      await removePending(id);
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
  }, [filename]);
  useEffect(() => () => { clearInterval(timerRef.current); cancelAnimationFrame(animationRef.current); stopTracks(); }, []);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="mb-6 text-center"><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal">{localOnly ? "Pre-session test" : `${item.section_class} · ${classLabels[item.section_class]}`}</span>{localOnly ? <><h1 className="mt-5 text-2xl font-bold">5-second test clip</h1><p className="mt-3 text-slate-600">Check it is clear and not too loud or too quiet. This clip is saved locally only and is never uploaded.</p></> : <><p className="urdu mt-5 text-3xl font-bold text-ink sm:text-5xl">{item.word}</p>{item.prompt && <p className="mt-3 text-lg font-semibold text-teal">Ask this question</p>}<p className="mt-2 text-slate-500">{item.prompt || item.meaning}</p>{item.intensity && <span className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{item.intensity}</span>}{item.loudness && <span className="mt-3 inline-block rounded-full bg-coral/10 px-3 py-1 text-xs font-bold text-coral">{item.loudness}</span>}{item.prompt && <p className="mt-3 text-sm text-slate-500">Let the volunteer answer in their own words for about 5 to 7 seconds. Do not make them read a script for this part.</p>}</>}</div><div className="mb-6 rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between text-sm"><span className="font-semibold">{status === "recording" ? "Recording…" : status === "submitting" ? "Uploading securely…" : status === "done" ? "Saved" : "Ready when you are"}</span><span className="font-mono text-teal">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-all ${level > 85 ? "bg-coral" : "bg-teal"}`} style={{ width: `${status === "recording" ? Math.max(level, 3) : Math.min(100, seconds / (localOnly ? 5 : 20) * 100)}%` }} /></div><p className="mt-2 text-xs text-slate-500">Microphone level · Keep the phone 30 cm from your mouth.</p></div>{error && <div className="mb-5"><Notice tone="error">{error} {pendingId && !localOnly && <span className="font-semibold">It is saved on this device for retry.</span>}</Notice></div>}{quietWarning && <div className="mb-5"><Notice>Your recording seems very quiet. You may want to record again.</Notice></div>}{status === "done" ? <div className="flex flex-col items-center justify-center gap-4 py-4 text-center"><div className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={22} /> <span>{localOnly ? "Test clip saved on this device only." : "Take submitted & saved to Google Drive!"}</span></div><button onClick={onSuccess} className="flex items-center gap-2 rounded-xl bg-teal px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-teal/90">Continue to Next Take <ChevronRight size={20} /></button></div> : <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">{status === "idle" && <button onClick={start} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal px-7 py-4 font-bold text-white shadow-sm hover:bg-teal/90"><Mic />Start recording</button>}{status === "recording" && <button onClick={stop} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-coral px-7 py-4 font-bold text-white shadow-sm"><Square size={18} fill="currentColor" />Stop recording</button>}{status === "ready" && <><button onClick={() => audioRef.current?.play()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-4 font-bold hover:bg-slate-50"><Play size={18} />Play recording</button><button onClick={rerecord} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-4 font-bold hover:bg-slate-50"><RefreshCw size={18} />Record again</button><button onClick={submit} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal px-5 py-4 font-bold text-white hover:bg-teal/90">{localOnly ? "Save test locally" : <><UploadCloud size={18} />Submit</>}</button></>}{status === "submitting" && <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-300 px-7 py-4 font-bold text-white"><Loader2 className="animate-spin" />Uploading…</button>}</div>}{blob && <audio ref={audioRef} src={URL.createObjectURL(blob)} className="hidden" />}</section>;
}

function Session({ participant, content, onDone }) {
  const contentGender = participant.gender_category === "male" ? "male" : "female";
  const sections = content[contentGender].sections;
  const items = useMemo(() => { let recordingNumber = 0; return sections.flatMap((section) => section.items.flatMap((item) => item.takes.map((take) => ({ ...item, ...take, phrase_code: item.code, take, section_class: section.class, category: section.title, instruction: section.instruction, recordingNumber: ++recordingNumber })))); }, [sections]);
  const [index, setIndex] = useState(-1); const [testDone, setTestDone] = useState(false);
  const item = items[index]; const paddedId = participant.participant_id ? `${participant.participant_id[0]}${String(Number(participant.participant_id.slice(1))).padStart(3, "0")}` : ""; const filename = item ? `SHEA_${paddedId}_${item.section_class}_${item.phrase_code}_${item.take.code}_E${String(Number(participant.environment.slice(1))).padStart(2, "0")}` : "";
  const section = item && sections.find((value) => value.class === item.section_class);
  if (!testDone) return <main className="mx-auto max-w-3xl px-4 py-8"><div className="mb-6"><p className="text-sm font-semibold uppercase tracking-widest text-teal">Before every session</p><h1 className="mt-2 text-3xl font-bold">Prepare the recording</h1><p className="mt-3 text-slate-600">Set the phone to 16 kHz, 16-bit, mono. Hold or place the phone 30 cm from the mouth.</p></div><div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 shadow-sm"><ol className="list-inside list-decimal space-y-1"><li>Sign the consent form with the volunteer. Give them their ID (example: F01 or M01). Do not write their name anywhere else.</li><li>Explain: everything they will say is acting. There is no real danger. They can stop at any time without giving a reason.</li><li>Set the phone to 16 kHz, 16-bit, mono. Hold or place the phone 30 cm from the mouth.</li><li>Record one 5-second test clip. Check it is clear and not too loud or too quiet.</li><li>Confirm which environment(s) this volunteer will record in today.</li></ol><p className="mt-4 font-semibold">Say this to the volunteer:</p><p className="mt-1">"We will record a few short sections together. All of it is acting, and you're welcome to take a breath any time you need to."</p></div><Recorder localOnly participant={participant} item={{}} filename="test" onSuccess={() => setTestDone(true)} /></main>;
  if (index === -1) return <main className="mx-auto max-w-3xl px-4 py-8"><Notice tone="success">Test clip saved locally. The session uses {content[contentGender].clips} clips ({content[contentGender].approx_time}).</Notice><button onClick={() => setIndex(0)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-5 py-4 font-bold text-white">Start Section D <ChevronRight size={20} /></button></main>;
  if (!item) return <main className="mx-auto max-w-xl px-4 py-20 text-center"><CheckCircle2 className="mx-auto text-teal" size={48} /><h1 className="mt-5 text-3xl font-bold">Thank you.</h1><p className="mt-3 text-slate-600">You have completed all available clips.</p><button onClick={onDone} className="mt-6 rounded-xl border border-slate-300 px-5 py-3 font-semibold">Finish session</button></main>;
  const sectionStart = index === 0 || items[index - 1].section_class !== item.section_class;
  return <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10"><div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-500"><span>Section {item.section_class} · {section?.title}</span><span>Clip {index + 1} of {items.length}</span></div><div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal transition-all" style={{ width: `${index / items.length * 100}%` }} /></div>{sectionStart && <div className="mb-5 rounded-xl border border-teal/20 bg-mint p-4 text-sm text-teal"><p className="font-bold">{section.title}</p><p className="mt-1">{section.instruction}</p></div>}<Recorder key={filename || `clip-${index}`} item={item} participant={participant} filename={filename} onSuccess={() => setIndex((value) => value + 1)} /><div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><p className="font-semibold text-ink">File name</p><p className="mt-1 break-all font-mono text-xs">{filename}.wav</p><p className="mt-2">Original audio is kept unchanged for research preprocessing later.</p></div></main>;
}

function Admin({ onBack }) {
  const [token, setToken] = useState(sessionStorage.getItem("shealert-admin") || ""); const [password, setPassword] = useState(""); const [stats, setStats] = useState(null); const [error, setError] = useState("");
  const load = useCallback(async (auth = token) => { try { const response = await adminFetch("/api/stats", auth); setStats(await response.json()); setError(""); } catch { setToken(""); sessionStorage.removeItem("shealert-admin"); setError("Please sign in with the administrator password."); } }, [token]);
  useEffect(() => { if (token) load(token); }, [token, load]);
  const login = async (event) => { event.preventDefault(); try { const result = await adminLogin(password); sessionStorage.setItem("shealert-admin", result.token); setToken(result.token); setPassword(""); } catch (e) { setError(e.message); } };
  const retry = async () => { await adminFetch("/api/admin/retry-failed", token, { method: "POST" }); load(); };
  const download = async () => { const response = await adminFetch("/api/metadata/export", token); const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "metadata.csv"; link.click(); URL.revokeObjectURL(url); };
  if (!token || !stats) return <main className="mx-auto max-w-5xl px-4 py-8"><button onClick={onBack} className="mb-6 text-sm font-semibold text-teal">← Participant collection</button><form onSubmit={login} className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold">Researcher dashboard</h1><p className="mt-2 text-sm text-slate-500">Private administration area.</p>{error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Administrator password" className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal" /><button className="mt-4 w-full rounded-xl bg-teal px-4 py-3 font-bold text-white">Sign in</button></form></main>;
  return <main className="mx-auto max-w-5xl px-4 py-8"><button onClick={onBack} className="mb-6 text-sm font-semibold text-teal">← Participant collection</button><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-teal">Research overview</p><h1 className="mt-1 text-3xl font-bold">Dataset dashboard</h1></div><div className="flex gap-2"><button onClick={retry} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><RefreshCw size={16} />Retry failed</button><button onClick={download} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><Download size={16} />Export metadata</button><button onClick={() => load()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><RefreshCw size={16} /></button></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Participants", stats.total_participants], ["Recordings", stats.total_recordings], ["Completed", stats.completed_recordings], ["Failed", stats.failed_recordings]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-bold"><BarChart3 size={18} className="text-teal" />Targets by gender</h2>{Object.entries(stats.targets || {}).map(([key, target]) => <div key={key} className="mt-4"><div className="flex justify-between text-sm"><span>{genderLabels[key]}</span><span className="font-semibold">{stats.per_gender?.[key]?.count || 0} / {target.total_clips} clips</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal" style={{ width: `${Math.min(100, (stats.per_gender?.[key]?.count || 0) / target.total_clips * 100)}%` }} /></div></div>)}<p className="mt-5 text-sm text-slate-500">By section: D {stats.per_section?.D || 0} · A {stats.per_section?.A || 0} · N {stats.per_section?.N || 0}</p><p className="mt-2 text-sm text-slate-500">Environments: {Object.entries(stats.per_environment || {}).map(([key, value]) => `${key} ${value}`).join(" · ")}</p><p className="mt-2 text-sm text-slate-500">Items: {Object.entries(stats.per_phrase || {}).map(([key, value]) => `${key} ${value}`).join(" · ") || "none"}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">{Object.entries(stats.per_gender_environment || {}).map(([gender, values]) => <div key={gender}><span className="font-semibold text-slate-700">{genderLabels[gender]}</span>: {Object.entries(values).map(([environment, value]) => `${environment} ${value}`).join(" · ")}</div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Recent recordings</h2><div className="mt-3 divide-y divide-slate-100">{stats.recent.slice(0, 8).map((row) => <div key={row.recording_id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-semibold">{row.phrase_id} · {row.participant_id}</p><p className="text-xs text-slate-500">{genderLabels[row.gender_category]} · {row.section_class} · {row.environment} · {row.upload_status}</p></div><span className="text-slate-500">{row.duration_seconds ? `${row.duration_seconds}s` : "—"}</span></div>)}</div></div></div></main>;
}

export default function App() {
  const [screen, setScreen] = useState(window.location.pathname === "/admin" ? "admin" : "participant"); const [participant, setParticipant] = useState(initialParticipant); const [started, setStarted] = useState(false); const [content, setContent] = useState(null); const [loadError, setLoadError] = useState(""); const [pending, setPending] = useState([]);
  useEffect(() => { getSessionContent().then(setContent).catch((error) => setLoadError(error.message)); getPending().then(setPending).catch(() => {}); }, []);
  const retryPending = async () => { for (const item of pending) { try { await uploadRecording(item); await removePending(item.id); } catch {} } setPending(await getPending()); };
  return <><Header onAdmin={() => setScreen("admin")} />{screen === "admin" ? <Admin onBack={() => setScreen("participant")} /> : !content ? <main className="mx-auto max-w-xl px-4 py-16 text-center">{loadError ? <Notice tone="error">{loadError}</Notice> : <Loader2 className="mx-auto animate-spin text-teal" />}</main> : !participant.consent || !started ? <ParticipantForm participant={participant} setParticipant={setParticipant} pending={pending} onRetryPending={retryPending} environments={content.environments} onContinue={() => setStarted(true)} /> : <Session participant={participant} content={content} onDone={() => { setParticipant(initialParticipant); setStarted(false); setPending([]); }} />}</>;
}
