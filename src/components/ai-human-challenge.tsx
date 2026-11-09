"use client";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Only loaded when the user reaches a suspicious-use threshold. */
export function AiHumanChallenge({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let widget: string | undefined;
    const mount = () => {
      if (cancelled || widget || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey,
        action: "fieldnote_ai",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    const scriptId = "fieldnote-turnstile";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", mount);
    mount();
    return () => {
      cancelled = true;
      script?.removeEventListener("load", mount);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, onToken]);
  return <div ref={container} aria-label="Human verification" />;
}
