// FabVision invite pass-through. Served from this site; no third-party scripts.
//
// A friend opens https://octodo-solutions.github.io/ppms/fabvision/?ref=CODE
// (the link an iPhone user shares from Refer and earn). This script:
//   1. adds the code to the "Get it on Google Play" button as the Play install
//      referrer, the same `utm_source=ref&utm_content=CODE` the Android app
//      shares, so the Android sign-up screen fills the code in by itself;
//   2. shows the code with a "Copy code" button, for iPhone users, who type it
//      at sign-up.
// Without a valid ?ref the page is left exactly as it is.

/** Referral codes are letters, digits, "_" or "-", 3 to 32 long (fab + 6 today). */
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

/** The code in `search` (`?ref=CODE`), or null when absent or not a code. */
export function readRefCode(search) {
  let params;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    return null;
  }
  const code = (params.get("ref") || "").trim();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * `href` with `referrer=utm_source=ref&utm_content=CODE` (encoded). Matches the
 * app's buildPlayReferralLink: other parameters kept, an old referrer replaced.
 */
export function playLinkWithReferrer(href, code) {
  const [head, query = ""] = href.split("?");
  const kept = query.split("&").filter((p) => p && !p.startsWith("referrer="));
  kept.push("referrer=" + encodeURIComponent("utm_source=ref&utm_content=" + code));
  return head + "?" + kept.join("&");
}

/** Wire the page for `search`. Returns the code it applied, or null. */
export function init(doc, search, clipboard) {
  const code = readRefCode(search);
  if (!code) {
    return null;
  }
  for (const a of doc.querySelectorAll("a.store.play")) {
    a.setAttribute("href", playLinkWithReferrer(a.getAttribute("href"), code));
  }
  const box = doc.getElementById("ref-box");
  const codeEl = doc.getElementById("ref-code");
  const button = doc.getElementById("ref-copy");
  const status = doc.getElementById("ref-status");
  if (!box || !codeEl || !button) {
    return code;
  }
  codeEl.textContent = code;
  box.hidden = false;
  button.addEventListener("click", async () => {
    let ok = false;
    try {
      if (clipboard && clipboard.writeText) {
        await clipboard.writeText(code);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (status) {
      status.textContent = ok
        ? "Code copied. Enter it when you sign up."
        : "Could not copy. Press and hold the code to copy it.";
    }
  });
  return code;
}

if (typeof document !== "undefined" && typeof location !== "undefined") {
  init(document, location.search, typeof navigator !== "undefined" ? navigator.clipboard : undefined);
}
