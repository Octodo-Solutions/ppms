// FabVision invite pass-through (public/fabvision/ref.js).
// Run: node --test tests/   (Node 18+; no dependencies)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { init, playLinkWithReferrer, readRefCode } from "../public/fabvision/ref.js";

const PAGE = readFileSync(new URL("../public/fabvision/index.html", import.meta.url), "utf8");
const PLAY = "https://play.google.com/store/apps/details?id=com.fabvision.ai";
// The Android app's link for the same code (referral_link.dart, vc19 format).
const APP_LINK = PLAY + "&referrer=utm_source%3Dref%26utm_content%3DfabXYZ9";

/** The few DOM calls ref.js makes, over the real page's ids and button. */
function fakePage() {
  const el = (attrs = {}) => ({
    attrs: { ...attrs },
    hidden: true,
    textContent: "",
    listeners: {},
    getAttribute(n) { return this.attrs[n]; },
    setAttribute(n, v) { this.attrs[n] = v; },
    addEventListener(t, f) { this.listeners[t] = f; },
  });
  const href = PAGE.match(/<a class="store play" href="([^"]+)"/)[1];
  const nodes = {
    play: el({ href }),
    "ref-box": el(),
    "ref-code": el(),
    "ref-copy": el(),
    "ref-status": el(),
  };
  return {
    nodes,
    querySelectorAll: (sel) => (sel === "a.store.play" ? [nodes.play] : []),
    getElementById: (id) => nodes[id] || null,
  };
}

test("reads a valid ?ref and rejects anything else", () => {
  assert.equal(readRefCode("?ref=fabXYZ9"), "fabXYZ9");
  assert.equal(readRefCode("?utm=x&ref=%20fabXYZ9%20"), "fabXYZ9");
  for (const bad of ["", "?ref=", "?ref=ab", "?ref=<script>", "?ref=a%26b%3Dc", "?ref=" + "x".repeat(33), "?code=fabXYZ9"]) {
    assert.equal(readRefCode(bad), null, bad);
  }
});

test("the Play link carries the code exactly as the Android app does", () => {
  assert.equal(playLinkWithReferrer(PLAY, "fabXYZ9"), APP_LINK);
  const twice = playLinkWithReferrer(playLinkWithReferrer(PLAY, "fabOLD1"), "fabNEW1");
  assert.equal(twice.split("referrer=").length, 2, "one referrer only");
  assert.ok(twice.endsWith("utm_content%3DfabNEW1"));
});

test("?ref sets the Play button and shows the code with Copy code", async () => {
  const page = fakePage();
  const copied = [];
  const code = init(page, "?ref=fabXYZ9", { writeText: async (t) => { copied.push(t); } });
  assert.equal(code, "fabXYZ9");
  assert.equal(page.nodes.play.getAttribute("href"), APP_LINK);
  assert.equal(page.nodes["ref-box"].hidden, false);
  assert.equal(page.nodes["ref-code"].textContent, "fabXYZ9");
  await page.nodes["ref-copy"].listeners.click();
  assert.deepEqual(copied, ["fabXYZ9"]);
  assert.match(page.nodes["ref-status"].textContent, /^Code copied/);
});

test("a blocked clipboard says how to copy by hand", async () => {
  const page = fakePage();
  init(page, "?ref=fabXYZ9", { writeText: async () => { throw new Error("denied"); } });
  await page.nodes["ref-copy"].listeners.click();
  assert.match(page.nodes["ref-status"].textContent, /Press and hold/);
});

test("without ?ref the page is untouched", () => {
  const page = fakePage();
  assert.equal(init(page, "", undefined), null);
  assert.equal(page.nodes.play.getAttribute("href"), PLAY);
  assert.equal(page.nodes["ref-box"].hidden, true);
});

test("the page loads only its own script and has the code box", () => {
  const srcs = [...PAGE.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ["ref.js"]);
  assert.ok(!/<script[^>]*src="(https?:)?\/\//.test(PAGE), "no CDN scripts");
  for (const id of ["ref-box", "ref-code", "ref-copy", "ref-status"]) {
    assert.ok(PAGE.includes(`id="${id}"`), id);
  }
  assert.ok(PAGE.includes(">Copy code</button>"));
});

test("no dashes in the invite text a visitor reads", () => {
  const box = PAGE.slice(PAGE.indexOf('id="ref-box"'), PAGE.indexOf('<div class="shots"'));
  const visible = box.replace(/<[^>]+>/g, " ");
  const script = readFileSync(new URL("../public/fabvision/ref.js", import.meta.url), "utf8");
  const messages = [...script.matchAll(/"([A-Z][^"]{10,})"/g)].map((m) => m[1]).join(" ");
  for (const text of [visible, messages]) {
    assert.ok(!/[–—]| - /.test(text), text);
  }
});
