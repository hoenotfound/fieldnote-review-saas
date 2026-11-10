import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/customer-review.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g);
  assert.ok(channels);
  const [red, green, blue] = channels.map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(a: string, b: string) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

test("customer styles are consolidated and loaded after base styles", () => {
  assert.match(layout, /import "\.\/globals\.css";\s*import "\.\/customer-review\.css";/);
  assert.match(css, /\.review-scene\s*\{/);
  assert.doesNotMatch(globals, /\.review-scene\s*\{/);
  assert.doesNotMatch(globals, /HD Review customer journey refinement/);
  assert.match(globals, /\.business-mark\s*\{/);
  assert.match(css, /\.review-scene \.business-mark\s*\{/);
  const desktopRules = css.slice(0, css.indexOf("@media (max-width: 520px)"));
  assert.equal((desktopRules.match(/\.review-scene\s*\{/g) || []).length, 1);
});

test("review labels meet WCAG AA body-text contrast on cards and page background", () => {
  assert.ok(contrast("#506376", "#ffffff") >= 4.5);
  assert.ok(contrast("#506376", "#f6f8fa") >= 4.5);
  assert.doesNotMatch(css, /#71818e/i);
});

test("mobile review options keep touch targets, strong focus, and narrow-screen wrapping", () => {
  assert.match(css, /\.language-tile\s*\{[^}]*min-height:\s*52px/s);
  assert.match(css, /\.review-panel \.photo button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.review-scene textarea:focus-visible/);
  assert.match(css, /@media \(max-width: 350px\)\s*\{[\s\S]*?\.language-tiles\s*\{ grid-template-columns: 1fr;/);
  assert.match(css, /\.review-masthead\s*\{ flex-wrap: wrap; gap: 8px; \}/);
  assert.match(css, /\.language-switch select\s*\{ max-width: 120px; \}/);

  assert.match(css, /\.review-progress li\.current\s*\{ background: var\(--accent\);/);
});

test("language-first welcome is single-column with HD Review's navy, lavender and teal palette", () => {
  assert.match(css, /\.review-scene--welcome\s*\{/);
  assert.match(css, /--review-ink: #202b50/);
  assert.match(css, /linear-gradient\(165deg, #fbfcff 3%, #f3f0ff 58%, #ecf5f8 100%\)/);
  assert.match(css, /\.review-scene--welcome \.language-tiles\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.review-scene--welcome \.language-tile[^}]*min-height:\s*56px;/s);
  assert.match(css, /\.review-scene--welcome \.shop-heading \.business-mark\s*\{[^}]*width:\s*84px;/s);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.review-scene--welcome \.shop-heading \.business-mark\s*\{[^}]*width:\s*74px;/);
  assert.match(css, /\.review-scene--welcome \.review-footer\s*\{[^}]*flex-direction:\s*row;/s);
  assert.match(css, /\.review-footer \.hd-brand-byline/);
  assert.doesNotMatch(css, /\.welcome-kicker/);
  assert.ok(contrast("#202b50", "#f3f0ff") >= 4.5);
  assert.ok(contrast("#506376", "#f7f8fc") >= 4.5);
});
