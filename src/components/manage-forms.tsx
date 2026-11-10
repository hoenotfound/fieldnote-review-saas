"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { readConfig, type QuestionnaireConfig } from "@/lib/questionnaire";
import { BusinessMark } from "./business-mark";
import { languageNames, type Locale } from "@/lib/i18n";
export type Business = {
  id: string;
  name: string;
  accent: string;
  initials: string;
  active: boolean;
  expires_at: string;
  allowance: number;
  used: number;
  reserved: number;
  logo_version?: string | null;
  questionnaire?: QuestionnaireConfig;
};
export type Location = {
  id: string;
  name: string;
  address: string;
  google_url: string | null;
  facebook_review_url: string | null;
  instagram_handle: string | null;
  active: boolean;
  slug: string;
  qr_code: string;
};
function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(
          data.error === "OWNER_ACCOUNT_REQUIRED"
            ? "Create the owner account with the local operator command first."
            : data.error === "GENERATION_IN_PROGRESS"
              ? "Wait for the active generation before resetting usage."
              : data.error === "INVALID_GOOGLE_URL"
                ? "Use an HTTPS Google Maps or Google review link."
                : data.error === "INVALID_FACEBOOK_URL"
                  ? "Use a Facebook Page Reviews tab link, such as https://www.facebook.com/YourPage/reviews."
                  : data.error === "INVALID_INSTAGRAM_HANDLE"
                    ? "Enter a valid Instagram username, such as @yourbusiness."
                    : "Unable to save. Check your fields and access.",
        );
        return false;
      }
      setMessage("Saved.");
      router.refresh();
      return true;
    } catch {
      setMessage("Connection failed. Your fields are still here.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, message };
}
export function BrandingForm({ business: b }: { business: Business }) {
  const { save, busy, message } = useSave();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        await save({
          action: "branding",
          businessId: b.id,
          name: d.get("name"),
          accent: d.get("accent"),
          initials: d.get("initials"),
        });
      }}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="brand-name">Business name</label>
          <input
            id="brand-name"
            name="name"
            defaultValue={b.name}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="brand-initials">Brand initials</label>
          <input
            id="brand-initials"
            name="initials"
            defaultValue={b.initials}
            required
            maxLength={3}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="brand-color">Brand colour</label>
        <input
          id="brand-color"
          type="color"
          name="accent"
          defaultValue={b.accent}
        />
      </div>
      <div className="actions">
        <button className="btn" disabled={busy}>
          <Save />
          {busy ? "Saving…" : "Save branding"}
        </button>
        <small role="status">{message}</small>
      </div>
    </form>
  );
}
export function LocationForm({
  businessId,
  location: l,
}: {
  businessId: string;
  location?: Location;
}) {
  const { save, busy, message } = useSave();
  const prefix = l?.id || "new";
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = new FormData(form);
        const ok = await save({
          action: "location",
          businessId,
          ...(l ? { id: l.id } : {}),
          name: d.get("name"),
          address: d.get("address"),
          googleUrl: d.get("googleUrl"),
          facebookReviewUrl: d.get("facebookReviewUrl"),
          instagramHandle: d.get("instagramHandle"),
          active: d.get("active") === "on",
        });
        if (ok && !l) form.reset();
      }}
    >
      <div className="field">
        <label htmlFor={prefix + "-name"}>Location name</label>
        <input
          id={prefix + "-name"}
          name="name"
          defaultValue={l?.name}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="field">
        <label htmlFor={prefix + "-address"}>Address</label>
        <input
          id={prefix + "-address"}
          name="address"
          defaultValue={l?.address}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={prefix + "-url"}>Google review link</label>
        <input
          id={prefix + "-url"}
          name="googleUrl"
          type="url"
          defaultValue={l?.google_url || ""}
          placeholder="https://g.page/r/…/review"
        />
        <p>
          Leave empty for fictional businesses. Check the destination branch
          before using a real link.
        </p>
      </div>
      <div className="field">
        <label htmlFor={prefix + "-facebook-url"}>Facebook Page recommendations link</label>
        <input
          id={prefix + "-facebook-url"}
          name="facebookReviewUrl"
          type="url"
          defaultValue={l?.facebook_review_url || ""}
          placeholder="https://www.facebook.com/YourPage/reviews"
        />
        <p>Optional. Paste your Facebook Page URL or its Reviews tab link. We will convert standard Page URLs to the Reviews tab. Enable Recommendations and test the link on a phone.</p>
      </div>
      <div className="field">
        <label htmlFor={prefix + "-instagram-handle"}>Instagram business username</label>
        <input
          id={prefix + "-instagram-handle"}
          name="instagramHandle"
          defaultValue={l?.instagram_handle ? "@" + l.instagram_handle : ""}
          placeholder="@yourbusiness"
          maxLength={31}
        />
        <p>Optional. Customers choose whether to tag you. Nothing is posted automatically.</p>
      </div>
      <label className="inline-label" style={{ marginBottom: 20 }}>
        <input
          type="checkbox"
          name="active"
          defaultChecked={l?.active ?? true}
        />{" "}
        Customer page enabled
      </label>
      <div className="actions">
        <button className="btn secondary" disabled={busy}>
          {l ? <Save /> : <Plus />}
          {busy ? "Saving…" : l ? "Save location" : "Add location"}
        </button>
        <small role="status">{message}</small>
      </div>
    </form>
  );
}
export function SubscriptionForm({ business: b }: { business: Business }) {
  const { save, busy, message } = useSave();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        await save({
          action: "subscription",
          businessId: b.id,
          active: d.get("active") === "on",
          allowance: Number(d.get("allowance")),
          expiresAt: new Date(
            String(d.get("expiry")) + "T23:59:59Z",
          ).toISOString(),
          resetUsage: d.get("reset") === "on",
        });
      }}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor={b.id + "-allowance"}>Generation allowance</label>
          <input
            id={b.id + "-allowance"}
            name="allowance"
            type="number"
            min="0"
            max="100000"
            required
            defaultValue={b.allowance}
          />
        </div>
        <div className="field">
          <label htmlFor={b.id + "-expiry"}>AI access through (UTC)</label>
          <input
            id={b.id + "-expiry"}
            name="expiry"
            type="date"
            required
            defaultValue={b.expires_at.slice(0, 10)}
          />
        </div>
      </div>
      <label className="inline-label">
        <input type="checkbox" name="active" defaultChecked={b.active} />{" "}
        Business and public pages enabled
      </label>
      <label className="inline-label" style={{ margin: "12px 0 20px" }}>
        <input type="checkbox" name="reset" /> Start a new allowance period by
        resetting used count
      </label>
      <div className="actions">
        <button className="btn secondary" disabled={busy}>
          Save access & allowance
        </button>
        <small role="status">{message}</small>
      </div>
    </form>
  );
}
export function NewBusiness() {
  const { save, busy, message } = useSave();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const d = new FormData(f);
        if (
          await save({
            action: "business",
            name: d.get("name"),
            ownerEmail: d.get("email"),
          })
        )
          f.reset();
      }}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="new-b-name">Business name</label>
          <input
            id="new-b-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="new-b-email">Existing owner email</label>
          <input id="new-b-email" name="email" type="email" required />
        </div>
      </div>
      <div className="actions">
        <button className="btn secondary" disabled={busy}>
          <Plus />
          Create business
        </button>
        <small role="status">{message}</small>
      </div>
    </form>
  );
}

export function QuestionnaireForm({ business }: { business: Business }) {
  const { save, busy, message } = useSave();
  const [config, setConfig] = useState(() =>
    readConfig(business.questionnaire),
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await save({
          action: "questionnaire",
          businessId: business.id,
          config,
        });
      }}
    >
      <p>
        These item or service choices appear at every location of this business.
        Add real names only, without praise or suggested reviews. Customers
        choose what they actually tried.
      </p>
      <p>
        English is required. Other names are optional and fall back to English.
        Feedback always allows good, mixed and negative experiences.
      </p>
      <fieldset disabled={busy} className="questionnaire-editor">
        {config.items.map((item, index) => (
          <div className="questionnaire-item" key={item.id}>
            <div className="label-row">
              <strong>Item or service {index + 1}</strong>
              <button
                type="button"
                className="btn text"
                onClick={() =>
                  setConfig({
                    ...config,
                    items: config.items.filter((i) => i.id !== item.id),
                  })
                }
              >
                Remove item {index + 1}
              </button>
            </div>
            <div className="form-grid">
              {Object.entries(languageNames).map(([lang, name]) => (
                <div className="field" key={lang}>
                  <label htmlFor={item.id + lang}>{name}</label>
                  <input
                    id={item.id + lang}
                    value={item.labels[lang as Locale]}
                    required={lang === "en"}
                    maxLength={60}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        items: config.items.map((i) =>
                          i.id === item.id
                            ? {
                                ...i,
                                labels: { ...i.labels, [lang]: e.target.value },
                              }
                            : i,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="actions">
          <button
            type="button"
            className="btn secondary"
            disabled={config.items.length >= 12}
            onClick={() =>
              setConfig({
                ...config,
                items: [
                  ...config.items,
                  {
                    id: crypto.randomUUID(),
                    labels: { en: "", "zh-CN": "", "zh-TW": "", ms: "" },
                  },
                ],
              })
            }
          >
            <Plus />
            Add item or service
          </button>
          <button className="btn">
            <Save />
            Save questionnaire
          </button>
          <small>{config.items.length}/12 choices</small>
        </div>
        <div className="feedback-editor">
          <h4>Detailed feedback choices</h4>
          <p>
            Add up to six balanced pairs. Both sides are always shown to every
            customer. Use concrete observations, never promises or instructions
            for the AI.
          </p>
          {(config.feedback || []).map((pair, index) => (
            <div className="questionnaire-item" key={pair.id}>
              <div className="label-row">
                <strong>Feedback pair {index + 1}</strong>
                <button
                  type="button"
                  className="btn text"
                  onClick={() =>
                    setConfig({
                      ...config,
                      feedback: config.feedback?.filter(
                        (p) => p.id !== pair.id,
                      ),
                    })
                  }
                >
                  Remove pair {index + 1}
                </button>
              </div>
              {(["positive", "negative"] as const).map((side) => (
                <fieldset className="feedback-side" key={side}>
                  <legend>
                    {side === "positive"
                      ? "What went well"
                      : "What could improve"}
                  </legend>
                  <div className="form-grid">
                    {Object.entries(languageNames).map(([lang, name]) => (
                      <div className="field" key={lang}>
                        <label htmlFor={pair.id + side + lang}>{name}</label>
                        <input
                          id={pair.id + side + lang}
                          maxLength={60}
                          required={lang === "en"}
                          value={pair[side][lang as Locale]}
                          placeholder={
                            lang === "en"
                              ? side === "positive"
                                ? "Service was quick"
                                : "The wait was long"
                              : ""
                          }
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              feedback: config.feedback?.map((p) =>
                                p.id === pair.id
                                  ? {
                                      ...p,
                                      [side]: {
                                        ...p[side],
                                        [lang]: e.target.value,
                                      },
                                    }
                                  : p,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="btn secondary"
              disabled={(config.feedback?.length || 0) >= 6}
              onClick={() =>
                setConfig({
                  ...config,
                  feedback: [
                    ...(config.feedback || []),
                    {
                      id: crypto.randomUUID(),
                      positive: { en: "", "zh-CN": "", "zh-TW": "", ms: "" },
                      negative: { en: "", "zh-CN": "", "zh-TW": "", ms: "" },
                    },
                  ],
                })
              }
            >
              Add feedback pair
            </button>
            <button className="btn">
              <Save />
              Save questionnaire
            </button>
          </div>
        </div>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}

export function LogoForm({ business }: { business: Business }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState(business.logo_version);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function change(remove = false) {
    if (!remove && !file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("businessId", business.id);
      if (file) form.set("logo", file);
      const res = await fetch(
        "/api/logo",
        remove
          ? {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId: business.id }),
            }
          : { method: "POST", body: form },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setVersion(remove ? null : result.version);
      setFile(null);
      setMessage(remove ? "Logo removed." : "Logo saved.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message === "FILE_TOO_LARGE"
          ? "Choose a logo under 2 MB."
          : "Unable to save. Use a non-animated JPEG, PNG or WebP under 2 MB and 16 megapixels.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="logo-settings">
      <h4>Business logo</h4>
      <div className="logo-settings-row">
        <BusinessMark
          key={version}
          id={business.id}
          initials={business.initials}
          version={version}
        />
        <div>
          <label htmlFor="business-logo">Choose a logo</label>
          <input
            id="business-logo"
            type="file"
            disabled={busy}
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (
                selected &&
                (!["image/jpeg", "image/png", "image/webp"].includes(
                  selected.type,
                ) ||
                  selected.size > 2 * 1024 * 1024)
              ) {
                setFile(null);
                setMessage("Choose a JPEG, PNG or WebP under 2 MB.");
                return;
              }
              setFile(selected || null);
              setMessage("");
            }}
          />
          <p>
            {file
              ? file.name
              : "JPEG, PNG or WebP, up to 2 MB. Used across your locations."}
          </p>
          <p>
            Logos are resized and stored as small public images. Customer photos
            remain on the customer's device.
          </p>
        </div>
      </div>
      <div className="actions">
        <button
          className="btn secondary"
          disabled={busy || !file}
          onClick={() => change()}
        >
          {busy ? "Saving…" : "Upload logo"}
        </button>
        <button
          className="btn text"
          disabled={busy || !version}
          onClick={() => change(true)}
        >
          Remove logo
        </button>
        <small role="status">{message}</small>
      </div>
    </section>
  );
}
