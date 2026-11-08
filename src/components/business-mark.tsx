"use client";
import { useState } from "react";
export function BusinessMark({
  id,
  initials,
  version,
}: {
  id: string;
  initials: string;
  version?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="business-mark">
      {version && !failed ? (
        <img
          src={`/api/logo/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}`}
          alt=""
          width={80}
          height={80}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
export function accentText(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((v) => parseInt(v, 16) / 255) || [0, 0, 0];
  const [r, g, b] = channels.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
