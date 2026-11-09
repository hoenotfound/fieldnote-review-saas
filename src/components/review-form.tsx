"use client";
import { useState, useEffect, useRef } from "react";
import { customerCopy } from "@/lib/customer-copy";
import { BusinessMark, accentText } from "./business-mark";
import { HDReviewWordmark } from "./hd-review-wordmark";
import { CustomerQuestionnaire } from "./customer-questionnaire";
import { AiHumanChallenge } from "./ai-human-challenge";
import {
  emptyAnswers,
  answersSchema,
  readConfig,
  hasExperience,
  answerNotes,
  questionnaireCopy,
  type Answers,
} from "@/lib/questionnaire";
import {
  ArrowRight,
  ImagePlus,
  ShieldCheck,
  MessageSquareQuote,
  Check,
  Copy,
  LoaderCircle,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Globe2,
  Sparkles,
  X,
} from "lucide-react";
import {
  languageNames,
  translations,
  errorText,
  type Locale,
} from "@/lib/i18n";
import type { PublicLocation, Draft } from "@/lib/reviews";
type Photo = { url: string; name: string };
export function ReviewForm({
  location,
  local,
  turnstileSiteKey = "",
}: {
  location: PublicLocation;
  local: boolean;
  turnstileSiteKey?: string;
}) {
  const [stage, setStage] = useState<
    "welcome" | "visit" | "review" | "complete"
  >("welcome");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [output, setOutput] = useState<Locale>("en");
  const [platform, setPlatform] = useState<"google" | "xiaohongshu">("google");
  const [experience, setExperience] = useState("");
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const config = readConfig(location.questionnaire);
  const configVersion = JSON.stringify(config);
  const q = questionnaireCopy[locale];
  const c = customerCopy[locale];
  const validAnswers = answersSchema.safeParse(answers).success;
  const [consent, setConsent] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState<Locale>("en");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trialDiagnostic, setTrialDiagnostic] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoRef = useRef<Photo[]>([]);
  const resultRef = useRef<HTMLElement>(null);
  const pendingKey = useRef<string | null>(null);
  const restored = useRef(false);
  const requestEpoch = useRef(0);
  const activeGeneration = useRef<AbortController | null>(null);
  const kioskExpired = useRef(false);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [challengeNonce, setChallengeNonce] = useState(0);
  const isKiosk =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("kiosk") === "1";
  const t = translations[locale];
  const storageKey = "fieldnote:" + location.slug;
  const isNetlifyTrial = location.business_id === "netlify-trial-only" && location.slug === "netlify-demo";
  useEffect(() => {
    try {
      // Shared kiosks must never resurrect a previous visitor's draft.
      if (isKiosk) sessionStorage.removeItem(storageKey);
      const raw = isKiosk ? null : sessionStorage.getItem(storageKey);
      if (raw) {
        const old = JSON.parse(raw);
        if (typeof old.saved === "number" && old.saved <= Date.now() && Date.now() - old.saved < 7200000) {
          setExperience(
            typeof old.experience === "string"
              ? old.experience.slice(0, 2000)
              : "",
          );
          if (old.started || old.experience) setStage("visit");
          if (old.locale in translations) setLocale(old.locale);
          if (old.output in translations) setOutput(old.output);
          if ((old.draftLanguage || old.output) in translations)
            setDraftLanguage(old.draftLanguage || old.output);
          if (["google", "xiaohongshu"].includes(old.platform))
            setPlatform(old.platform);
          const savedAnswers = answersSchema.safeParse(old.answers);
          if (savedAnswers.success && old.configVersion === configVersion) {
            // An older draft may have a first-visit answer from the removed UI.
            // Do not silently include that now-hidden field in a new review.
            setAnswers({ ...savedAnswers.data, visit: "" });
            if (
              old.draft &&
              typeof old.draft.body === "string" &&
              typeof old.draft.title === "string"
            ) {
              setDraft(old.draft);
              setStage("review");
            }
          } else if (
            !old.answers &&
            old.draft &&
            typeof old.draft.body === "string" &&
            typeof old.draft.title === "string"
          ) {
            setDraft(old.draft);
            setStage("review");
          }
        } else {
          sessionStorage.removeItem(storageKey);
        }
      }
    } catch {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
    }
    restored.current = true;
    return () => {
      requestEpoch.current += 1;
      activeGeneration.current?.abort();
      photoRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [storageKey, configVersion, isKiosk]);
  useEffect(() => {
    try {
      if (!isKiosk && restored.current && (stage === "visit" || stage === "review"))
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            started: stage === "visit" || stage === "review",
            experience,
            answers,
            configVersion,
            locale,
            output,
            platform,
            draft,
            draftLanguage,
            saved: Date.now(),
          }),
        );
    } catch {}
  }, [
    stage,
    experience,
    answers,
    configVersion,
    locale,
    output,
    platform,
    draft,
    draftLanguage,
    storageKey,
    isKiosk,
  ]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }, [stage]);
  function invalidate() {
    setChallengeToken("");
    setChallengeNonce((n) => n + 1);
    setConfirmed(false);
    pendingKey.current = null;
    setDraft(null);
    setError("");
    setMessage("");
  }
  function edit(value: Partial<Draft>) {
    if (kioskExpired.current) return;
    setDraft((old) => (old ? { ...old, ...value } : null));
    setConfirmed(false);
    setMessage("");
  }
  async function generate() {
    if (kioskExpired.current || busy) return;
    setError("");
    setTrialDiagnostic("");
    setMessage("");
    setConfirmed(false);
    if (!validAnswers || !hasExperience(experience, answers)) {
      setError(t.more);
      return;
    }
    if (challengeRequired && !challengeToken) {
      setError(t.challengePrompt);
      return;
    }
    const epoch = requestEpoch.current;
    const controller = new AbortController();
    activeGeneration.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 35000);
    let phase: "guest" | "generate" = "guest";
    let httpStatus: number | null = null;
    setBusy(true);
    try {
      const guest = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: location.slug }),
        signal: controller.signal,
      });
      if (epoch !== requestEpoch.current || controller.signal.aborted) return;
      httpStatus = guest.status;
      if (!guest.ok) {
        const response = await guest.json().catch(() => null);
        const code = typeof response?.error === "string" ? response.error : "INVALID_RESPONSE";
        throw new Error(code);
      }
      pendingKey.current ??= crypto.randomUUID();
      phase = "generate";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: location.slug,
          experience,
          answers,
          locale: output,
          platform,
          requestKey: pendingKey.current,
          ...(challengeRequired && challengeToken ? { challengeToken } : {}),
        }),
        signal: controller.signal,
      });
      if (epoch !== requestEpoch.current || controller.signal.aborted) return;
      httpStatus = res.status;
      const data = await res.json().catch(() => null);
      if (epoch !== requestEpoch.current || controller.signal.aborted) return;
      if (!res.ok) {
        if (data?.error !== "ALREADY_RUNNING") pendingKey.current = null;
        throw new Error(typeof data?.error === "string" ? data.error : "INVALID_RESPONSE");
      }
      if (!data || typeof data.title !== "string" || typeof data.body !== "string")
        throw new Error("INVALID_RESPONSE");
      setDraft(data);
      setDraftLanguage(output);
      setStage("review");
      setChallengeRequired(false);
      setChallengeToken("");
      pendingKey.current = null;
      setTimeout(() => {
        if (epoch === requestEpoch.current)
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      if (epoch !== requestEpoch.current) return;
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      if (isNetlifyTrial) {
        // Do not display response bodies, IP addresses, review text, or server exceptions.
        const safeCode = /^[A-Z][A-Z0-9_]{2,40}$/.test(code)
          ? code
          : controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR";
        setTrialDiagnostic(`Trial diagnostics: ${phase === "guest" ? "guest session" : "AI generation"} · ${httpStatus === null ? "no HTTP response" : `HTTP ${httpStatus}`} · ${safeCode}`);
      }
      if (code === "AI_CHALLENGE_REQUIRED" && turnstileSiteKey) {
        setChallengeRequired(true);
        setChallengeToken("");
        setChallengeNonce((n) => n + 1);
        setError(t.challengePrompt);
      } else {
        if (challengeRequired) {
          setChallengeToken("");
          setChallengeNonce((n) => n + 1);
        }
        setError(
          code === "QUESTIONNAIRE_CHANGED" ? q.changed : errorText(code, t),
        );
      }
    } finally {
      window.clearTimeout(timer);
      if (activeGeneration.current === controller) activeGeneration.current = null;
      if (epoch === requestEpoch.current) setBusy(false);
    }
  }
  function manual() {
    if (kioskExpired.current) return;
    if (!validAnswers || !hasExperience(experience, answers)) {
      setError(t.more);
      return;
    }
    setDraft({
      title: "",
      body: [answerNotes(answers, config, locale), experience]
        .filter(Boolean)
        .join("\n\n"),
      demo: false,
    });
    setDraftLanguage(locale);
    setStage("review");
    setConfirmed(false);
    setError("");
    setTrialDiagnostic("");
    setMessage("");
    pendingKey.current = null;
    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  }
  async function copy(text: string) {
    if (!confirmed || kioskExpired.current) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t.copied);
    } catch {
      setError(t.copyFailed);
    }
  }
  function clearLocal() {
    requestEpoch.current += 1;
    activeGeneration.current?.abort();
    activeGeneration.current = null;
    setChallengeRequired(false);
    setChallengeToken("");
    setExperience("");
    setAnswers(emptyAnswers());
    setDraft(null);
    setConsent(false);
    setConfirmed(false);
    setError("");
    setTrialDiagnostic("");
    setMessage("");
    photoRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    photoRef.current = [];
    setPhotos([]);
    pendingKey.current = null;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }
  async function finish() {
    if (finishing) return;
    setBusy(true);
    setFinishing(true);
    // Erase visible and browser-stored content before any network request.
    clearLocal();
    setStage("complete");
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: location.slug, finish: true }),
      });
      if (!res.ok) throw new Error();
      setMessage(t.finished);
    } catch {
      // Local data is already gone. The session expires server-side regardless.
      setError(t.serverClearUnconfirmed);
    } finally {
      setBusy(false);
      setFinishing(false);
    }
  }
  useEffect(() => {
    if (!isKiosk || (stage !== "visit" && stage !== "review")) return;
    kioskExpired.current = false;
    let lastActivity = Date.now();
    let reset = false;
    const expire = () => {
      if (reset) return;
      reset = true;
      kioskExpired.current = true;
      clearLocal();
      setBusy(false);
      setLocale("en");
      setOutput("en");
      setStage("welcome");
      void fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: location.slug, finish: true }),
      }).catch(() => {});
    };
    const check = () => {
      if (Date.now() - lastActivity >= 5 * 60 * 1000) expire();
    };
    const activity = (event: Event) => {
      // Suppress this expired interaction before React receives an old click,
      // input or submit handler; otherwise it could recreate a cleared draft.
      if (reset || Date.now() - lastActivity >= 5 * 60 * 1000) {
        expire();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        lastActivity = Date.now();
      }
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "input", "click", "change"];
    for (const event of activityEvents)
      window.addEventListener(event, activity, true);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 15000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      for (const event of activityEvents)
        window.removeEventListener(event, activity, true);
    };
  }, [stage, storageKey, location.slug, isKiosk]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    if (
      photos.length + list.length > 4 ||
      list.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 5 * 1024 * 1024,
      )
    ) {
      setError(t.photoError);
      return;
    }
    const next = [
      ...photos,
      ...list.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    ];
    setPhotos(next);
    photoRef.current = next;
    setError("");
  }
  const ready = validAnswers && hasExperience(experience, answers);
  const step = stage === "welcome" ? 1 : stage === "visit" ? 2 : 3;
  return (
    <main
      lang={locale}
      className="review-scene"
      style={
        {
          "--accent": location.accent,
          "--accent-ink": accentText(location.accent),
        } as React.CSSProperties
      }
    >
      <div className="review-shell">
        <header className="review-masthead">
          <span className="mini-wordmark">
            <HDReviewWordmark compact showCompany={false} />
          </span>
          {stage !== "welcome" && (
            <div className="language-switch">
              <Globe2 size={16} />
              <label className="sr-only" htmlFor="ui-language">
                {t.interface}
              </label>
              <select
                id="ui-language"
                value={locale}
                disabled={busy}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                {Object.entries(languageNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>
        <section className="shop-heading" aria-label={location.business_name}>
          <BusinessMark
            key={location.logo_version}
            id={location.business_id}
            initials={location.initials}
            version={location.logo_version}
          />
          <div>
            <p className="shop-overline">{c.shop}</p>
            <h2>{location.business_name}</h2>
            <p className="shop-address">
              <MapPin size={13} />
              {location.name}
              {location.address ? " · " + location.address : ""}
            </p>
          </div>
        </section>
        {stage !== "complete" && (
          <div className="review-steps">
            <div className="review-steps-meta">
              <span>{c.step} {step} {c.of} 3</span>
              <strong>{[c.language, c.experience, c.review][step - 1]}</strong>
            </div>
            <ol className="review-progress" aria-label={`${c.step} ${step} ${c.of} 3`}>
              {[c.language, c.experience, c.review].map((label, i) => (
                <li
                  key={i}
                  className={i + 1 < step ? "done" : i + 1 === step ? "current" : ""}
                  aria-current={i + 1 === step ? "step" : undefined}
                >
                  <span className="sr-only">{c.step} {i + 1} {c.of} 3: {label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="review-panel" aria-busy={busy}>
          {stage === "welcome" && (
            <section className="welcome-step">
              <div className="welcome-symbol" aria-hidden="true">
                <MessageSquareQuote size={30} />
              </div>
              <h1 tabIndex={-1} ref={headingRef}>
                {c.welcome}
              </h1>
              <p className="panel-lead">{c.welcomeHint}</p>
              <fieldset className="language-picker">
                <legend>{c.choose}</legend>
                <div className="language-tiles">
                  {Object.entries(languageNames).map(([key, name]) => (
                    <button
                      key={key}
                      type="button"
                      className="language-tile"
                      aria-pressed={locale === key}
                      onClick={() => {
                        setLocale(key as Locale);
                        setOutput(key as Locale);
                      }}
                    >
                      <span>{name}</span>
                      {locale === key ? (
                        <Check size={18} />
                      ) : (
                        <span className="language-dot" />
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                className="btn full primary-action"
                onClick={() => {
                  setStage("visit");
                  setMessage("");
                }}
              >
                {c.start}
                <ArrowRight size={19} />
              </button>
              <p className="quiet-note">
                <ShieldCheck size={15} />
                {c.welcomePrivacy}
              </p>
            </section>
          )}
          {stage === "visit" && (
            <section>
              <div className="step-heading">
                <p className="small-kicker">
                  {c.step} 2 {c.of} 3
                </p>
                <h1 tabIndex={-1} ref={headingRef}>
                  {t.heading}
                </h1>
                <p className="panel-lead">{t.hint}</p>
              </div>
              <CustomerQuestionnaire
                answers={answers}
                config={config}
                locale={locale}
                busy={busy}
                onChange={(next) => {
                  setAnswers(next);
                  invalidate();
                }}
              />
              <div className="field experience-field">
                <div className="label-row">
                  <label htmlFor="experience">{t.experience}</label>
                  {local && (
                    <button
                      className="sample-link"
                      disabled={busy}
                      onClick={() => {
                        setAnswers(emptyAnswers());
                        setExperience(t.sampleText);
                        invalidate();
                      }}
                    >
                      {t.sample}
                    </button>
                  )}
                </div>
                <textarea
                  id="experience"
                  disabled={busy}
                  maxLength={2000}
                  value={experience}
                  onChange={(e) => {
                    setExperience(e.target.value);
                    invalidate();
                  }}
                  placeholder={t.placeholder}
                />
                <div className="input-footnote">
                  <p>{q.commentHint}</p>
                  <span>{experience.length}/2000</span>
                </div>
              </div>
              <details className="photo-disclosure">
                <summary>
                  <ImagePlus size={20} />
                  <span>
                    {c.photoTitle}
                    <small>{c.photoLocal}</small>
                  </span>
                  {photos.length > 0 && (
                    <span className="photo-count">{photos.length}/4</span>
                  )}
                </summary>
                <div className="photo-content">
                  <label className="photo-picker" htmlFor="photos">
                    <ImagePlus size={20} />
                    {c.photoButton}
                  </label>
                  <input
                    className="sr-only"
                    id="photos"
                    type="file"
                    aria-label={t.photos}
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <p>{t.photoHint}</p>
                  {photos.length > 0 && (
                    <div className="photos">
                      {photos.map((p) => (
                        <div className="photo" key={p.url}>
                          <img src={p.url} alt={p.name} />
                          <button
                            aria-label={t.remove + " " + p.name}
                            onClick={() => {
                              URL.revokeObjectURL(p.url);
                              const next = photos.filter(
                                (f) => f.url !== p.url,
                              );
                              setPhotos(next);
                              photoRef.current = next;
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
              <fieldset className="destination-picker">
                <legend>{c.sharing}</legend>
                <div className="destination-tiles">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={platform === "google"}
                    onClick={() => {
                      setPlatform("google");
                      invalidate();
                    }}
                  >
                    <span className="destination-icon google-icon" aria-hidden="true">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Google_Maps_icon_%282026%29.svg/250px-Google_Maps_icon_%282026%29.svg.png"
                        alt=""
                        width={32}
                        height={32}
                      />
                    </span>
                    <span>{t.google}</span>
                    {platform === "google" && <Check size={16} />}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={platform === "xiaohongshu"}
                    onClick={() => {
                      setPlatform("xiaohongshu");
                      invalidate();
                    }}
                  >
                    <span className="destination-icon red-icon" aria-hidden="true">
                      <img
                        src="/brands/xiaohongshu.svg"
                        alt=""
                        width={32}
                        height={32}
                      />
                    </span>
                    <span>{t.xiaohongshu}</span>
                    {platform === "xiaohongshu" && <Check size={16} />}
                  </button>
                </div>
              </fieldset>
              <div className="field output-field">
                <label htmlFor="output-language">{t.output}</label>
                <select
                  id="output-language"
                  disabled={busy}
                  value={output}
                  onChange={(e) => {
                    setOutput(e.target.value as Locale);
                    invalidate();
                  }}
                >
                  {Object.entries(languageNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {!validAnswers && (
                <p role="alert" className="notice error">
                  {q.spend}: 0–100000 (0.00)
                </p>
              )}
              <label className="check consent-check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>{t.consent}</span>
              </label>
              {!ready && <p className="empty-guidance">{c.emptyHint}</p>}
              {challengeRequired && turnstileSiteKey && (
                <div className="field" role="group" aria-label={t.challengePrompt}>
                  <p>{t.challengePrompt}</p>
                  <AiHumanChallenge
                    key={challengeNonce}
                    siteKey={turnstileSiteKey}
                    onToken={setChallengeToken}
                  />
                </div>
              )}
              <div className="generate-action">
                <button
                  className="btn full primary-action"
                  disabled={!consent || busy || !ready || (challengeRequired && !challengeToken)}
                  onClick={generate}
                >
                  {busy ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Sparkles size={19} />
                  )}{" "}
                  {busy ? t.generating : t.generate}
                  {!busy && <ArrowRight size={19} />}
                </button>
              </div>
              <button
                className="btn text manual"
                disabled={busy || !ready}
                onClick={manual}
              >
                {t.manual}
              </button>
              <div className="visit-navigation">
                <button
                  className="btn text"
                  disabled={busy}
                  onClick={() => setStage("welcome")}
                >
                  <ArrowLeft size={15} />
                  {c.back}
                </button>
                {draft && (
                  <button
                    className="btn text"
                    disabled={busy}
                    onClick={() => setStage("review")}
                  >
                    {c.resume}
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </section>
          )}
          {stage === "review" && draft && (
            <section className="review-result" ref={resultRef}>
              <div className="step-heading">
                <p className="small-kicker">
                  {c.step} 3 {c.of} 3
                </p>
                <h1 tabIndex={-1} ref={headingRef}>
                  {t.step}
                </h1>
                <p className="panel-lead">{c.draftHint}</p>
              </div>
              <div className="draft-meta">
                <span>{platform === "google" ? t.google : t.xiaohongshu}</span>
                <span>{languageNames[draftLanguage]}</span>
              </div>
              {draft.demo && <div className="notice">{t.demo}</div>}
              {platform === "xiaohongshu" && (
                <div className="field">
                  <label htmlFor="draft-title">{t.title}</label>
                  <input
                    id="draft-title"
                    disabled={busy}
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) => edit({ title: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="draft-body">{t.body}</label>
                <textarea
                  id="draft-body"
                  disabled={busy}
                  maxLength={3000}
                  value={draft.body}
                  onChange={(e) => edit({ body: e.target.value })}
                />
                <p>{t.editHint}</p>
              </div>
              {photos.length > 0 && (
                <div className="draft-photo-reminder">
                  <div className="photos">
                    {photos.map((p) => (
                      <div className="photo" key={p.url}>
                        <img src={p.url} alt={p.name} />
                      </div>
                    ))}
                  </div>
                  <p>{c.previewOnly}</p>
                </div>
              )}
              <div
                className={`confirmation-box ${confirmed ? "confirmed" : ""}`}
              >
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>{t.confirm}</span>
                </label>
              </div>
              <div className="share-actions">
                <button
                  className="btn primary-action"
                  disabled={busy || !confirmed || !draft.body.trim()}
                  onClick={() => copy(draft.body)}
                >
                  <Copy size={18} />
                  {t.copy}
                </button>
                {platform === "xiaohongshu" && (
                  <button
                    className="btn secondary"
                    disabled={busy || !confirmed || !draft.title.trim()}
                    onClick={() => copy(draft.title)}
                  >
                    {t.copyTitle}
                  </button>
                )}
                {platform === "google" && location.google_url && (
                  <a
                    className="btn secondary"
                    href={
                      confirmed && draft.body.trim() && !busy
                        ? location.google_url
                        : undefined
                    }
                    aria-disabled={!confirmed || !draft.body.trim() || busy}
                    onClick={(e) => {
                      if (!confirmed || !draft.body.trim() || busy)
                        e.preventDefault();
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={17} />
                    {t.open}
                  </a>
                )}
              </div>
              <p className="handoff-help">
                {platform === "xiaohongshu"
                  ? t.xhsHelp
                  : location.google_url
                    ? t.draftNotice
                    : t.noLink}
              </p>
              <div className="draft-tools">
                <button
                  className="btn text"
                  disabled={busy}
                  onClick={() => setStage("visit")}
                >
                  <ArrowLeft size={15} />
                  {c.editVisit}
                </button>
                <button
                  className="btn text"
                  disabled={busy || !consent}
                  onClick={generate}
                >
                  <Sparkles size={15} />
                  {t.regenerate}
                </button>
              </div>
              <button
                className="btn secondary full finish-button"
                disabled={busy}
                onClick={finish}
              >
                <Check size={18} />
                {t.finish}
              </button>
            </section>
          )}
          {stage === "complete" && (
            <section className="welcome-step complete-step">
              <div className="welcome-symbol">
                <Check size={30} />
              </div>
              <h1 tabIndex={-1} ref={headingRef}>
                {c.complete}
              </h1>
              <p className="panel-lead">{c.completeHint}</p>
              <button
                className="btn full primary-action"
                onClick={() => {
                  setStage("welcome");
                  setMessage("");
                }}
              >
                {c.again}
                <ArrowRight size={18} />
              </button>
            </section>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
              {isNetlifyTrial && trialDiagnostic && (
                <p><small>{trialDiagnostic}</small></p>
              )}
            </div>
          )}
          {message && stage !== "complete" && (
            <div role="status" className="notice success">
              {message}
            </div>
          )}
          {busy && !finishing && (
            <div className="generation-status" role="status">
              <LoaderCircle className="spin" size={20} />
              <div>
                <strong>{c.generating}</strong>
                <p>{c.loadingHint}</p>
              </div>
            </div>
          )}
        </div>
        <footer className="review-footer">
          <div className="review-footer-credit">
            <img
              src="/da-smarketing-logo.svg"
              alt=""
              width={34}
              height={34}
              className="review-footer-company-logo"
            />
            <div className="review-footer-credit-text">
              <span>{c.powered} <strong>HD Review</strong></span>
              <span className="review-footer-company">by DA Smarketing Solutions</span>
            </div>
          </div>
          <a href="/privacy" className="review-footer-privacy">{t.privacyLink}</a>
        </footer>
      </div>
    </main>
  );
}
