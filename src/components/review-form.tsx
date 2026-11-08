"use client";
import { useState, useEffect, useRef } from "react";
import { customerCopy } from "@/lib/customer-copy";
import { BusinessMark, accentText } from "./business-mark";
import { CustomerQuestionnaire } from "./customer-questionnaire";
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
  Feather,
  Check,
  Copy,
  LoaderCircle,
  ExternalLink,
  ArrowLeft,
  MapPin,
  Globe2,
  Star,
  BookOpen,
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
}: {
  location: PublicLocation;
  local: boolean;
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoRef = useRef<Photo[]>([]);
  const resultRef = useRef<HTMLElement>(null);
  const pendingKey = useRef<string | null>(null);
  const restored = useRef(false);
  const t = translations[locale];
  const storageKey = "fieldnote:" + location.slug;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const old = JSON.parse(raw);
        if (Date.now() - old.saved < 7200000) {
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
            setAnswers(savedAnswers.data);
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
        }
      }
    } catch {}
    restored.current = true;
    return () => photoRef.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, [storageKey, configVersion]);
  useEffect(() => {
    try {
      if (restored.current)
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
  ]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }, [stage]);
  function invalidate() {
    setConfirmed(false);
    pendingKey.current = null;
    setDraft(null);
    setError("");
    setMessage("");
  }
  function edit(value: Partial<Draft>) {
    setDraft((old) => (old ? { ...old, ...value } : null));
    setConfirmed(false);
    setMessage("");
  }
  async function generate() {
    setError("");
    setMessage("");
    setConfirmed(false);
    if (!validAnswers || !hasExperience(experience, answers)) {
      setError(t.more);
      return;
    }
    setBusy(true);
    try {
      const guest = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: location.slug }),
      });
      if (!guest.ok) throw new Error((await guest.json()).error);
      pendingKey.current ??= crypto.randomUUID();
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
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error !== "ALREADY_RUNNING") pendingKey.current = null;
        throw new Error(data.error);
      }
      setDraft(data);
      setDraftLanguage(output);
      setStage("review");
      pendingKey.current = null;
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        100,
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === "QUESTIONNAIRE_CHANGED"
          ? q.changed
          : errorText(e instanceof Error ? e.message : "REQUEST_FAILED", t),
      );
    } finally {
      setBusy(false);
    }
  }
  function manual() {
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
    setMessage("");
    pendingKey.current = null;
    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  }
  async function copy(text: string) {
    if (!confirmed) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage(t.copied);
    } catch {
      setError(t.copyFailed);
    }
  }
  async function finish() {
    setBusy(true);
    setFinishing(true);
    try {
      const res = await fetch("/api/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: location.slug, finish: true }),
      });
      if (!res.ok) throw new Error();
      setExperience("");
      setAnswers(emptyAnswers());
      setDraft(null);
      setConsent(false);
      setConfirmed(false);
      setError("");
      setMessage(t.finished);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      photoRef.current = [];
      pendingKey.current = null;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setStage("complete");
    } catch {
      setError(t.retry);
    } finally {
      setBusy(false);
      setFinishing(false);
    }
  }
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
      <div className="review-orbit orbit-one" aria-hidden="true" />
      <div className="review-orbit orbit-two" aria-hidden="true" />
      <div className="review-shell">
        <header className="review-masthead">
          <span className="mini-wordmark">
            <Feather size={18} /> fieldnote<span>.</span>
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
          <ol
            className="review-progress"
            aria-label={`${c.step} ${step} ${c.of} 3`}
          >
            {[c.language, c.experience, c.review].map((label, i) => (
              <li
                key={i}
                className={
                  i + 1 < step ? "done" : i + 1 === step ? "current" : ""
                }
                aria-current={i + 1 === step ? "step" : undefined}
              >
                <span>{i + 1 < step ? <Check size={13} /> : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        <div className="review-panel" aria-busy={busy}>
          {stage === "welcome" && (
            <section className="welcome-step">
              <div className="welcome-symbol" aria-hidden="true">
                <Feather size={30} />
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
                    <span className="destination-icon google-icon">
                      <Star size={20} />
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
                    <span className="destination-icon red-icon">
                      <BookOpen size={20} />
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
              <div className="generate-action">
                <button
                  className="btn full primary-action"
                  disabled={!consent || busy || !ready}
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
          <p>
            <ShieldCheck size={14} />
            {c.welcomePrivacy}
          </p>
          <span>
            {c.powered} <strong>fieldnote.</strong>
          </span>
        </footer>
      </div>
    </main>
  );
}
