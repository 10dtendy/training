import React, { useState, useEffect, useLayoutEffect, useRef, useContext, useSyncExternalStore, useId } from "react";
import {
  Play, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Bell, Menu, X, Plus, Pencil,
  Trash2, Eye, EyeOff, Calendar as CalendarIcon, LayoutGrid, Users as UsersIcon,
  Image as ImageIcon, Settings as SettingsIcon, Download, LogOut, Mail, Lock, UploadCloud,
  FileText, Video as VideoIcon, AlertTriangle, Home, BarChart3, Tag, Search, CircleDot, Armchair,
  Copy, LayoutTemplate, Megaphone, List, Camera, Cookie, ListOrdered, Heading, Link2, Scale, Info
} from "lucide-react";
// Brand images ship as separate files (cached by the browser, never inside the JS bundle).
import LOGO_SRC from "./assets/logo.png";
// Original full-color (black + red) mark, used only on the white print sheet.
import LOGO_PRINT_SRC from "./assets/logo-print.png";
import BADGE_LOGO_SRC from "./assets/badge-logo.png";
// Real training photography, supplied by the brand: the default drill, practice focus
// and off-ice visuals on cards and detail pages.
import DRILL_IMG from "./assets/default-drill.jpg";
import FOCUS_IMG from "./assets/default-focus.jpg";
import OFFICE_IMG from "./assets/default-office.jpg";
import { supabase } from "./lib/supabase.js";
import {
  fetchCurrentProfile, getUsersMap, getProfilesMap, updateUserFields, recordLoginDay, getContent, updateContentFields,
  uploadImage as uploadToStorage, deleteStorageObject, publishConfirmationEmail, getUsage,
  storagePathFromUrl, listMediaLibrary, deleteMediaFiles, deleteAccount,
  getLegal, saveLegalDoc, publishLegalVersion, legalAcceptanceCount, getAppAccess, setAppAccess,
  mediaPublicBase, restoreMediaFile,
} from "./lib/data.js";

/* ============================================================================
   DATA
   Accounts, logins and all shared data (content, calendars, game logs, ticked-off
   training) live in Supabase (src/lib/data.js), protected by row-level security:
   each goalie can only reach their own data, coaches can read everyone's. The
   browser only keeps the login session (managed by supabase-js) and the cookie
   choice.
   ============================================================================ */

const GAME_DAY_BANNER_SRC = "https://cylzjvrzikgakethelst.supabase.co/storage/v1/object/public/media/content/gameday-banner.jpg";
const REST_DAY_BANNER_SRC = "https://cylzjvrzikgakethelst.supabase.co/storage/v1/object/public/media/content/restday-banner.jpg";



// Coach/admin sign-up is invite-only: the public form only ever creates a "goalie"
// account unless a valid invite code is entered. The code is checked by the database
// (handle_new_user) and lives only there — never in this file, since this repo is public.
// Sharing a link with #invite=<code> appended pre-fills the field during sign-up.

const _now = new Date();
const TODAY_DATE = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EXPERIENCE_LEVELS = ["Youth", "Junior", "Pro"];

const DEFAULT_WELCOME = {
  title: "Welcome to 10DTendy",
  body: "Every day you'll get three things to work on: a Drill, a Practice Focus, and an Off-Ice session — all set by your coach for your level.\nOpen the Today tab each day to see what's assigned, work through it, and check things off as you complete them.\nGot a game or a scheduled rest day? Mark it on your Profile calendar and your Today page will automatically show the right content instead of a normal training day.\nTrack your save percentage, rest days and more over time on the Progress tab.\nLet's get to work.",
  videoUrl: "", videoAssetId: null,
};
const DEFAULT_ANNOUNCEMENT = { enabled: false, id: null, title: "", body: "", videoUrl: "", videoAssetId: null };
// The real email links to the logo hosted with the app; the admin preview uses the built-in copy so it shows immediately.
const EMAIL_LOGO_URL = "https://app.10dtendy.com/email-logo.png";
const DEFAULT_CONFIRMATION_EMAIL = {
  subject: "Confirm your 10DTendy account",
  heading: "Welcome to 10DTendy",
  body: "Thanks for signing up. Confirm your email to activate your account and start training.",
  buttonText: "Confirm email",
  footer: "If you didn't create this account, you can safely ignore this email.",
};

// Mirrors the HTML the update-confirmation-email Edge Function builds, so the
// admin preview matches the real email. Keep the two in sync by hand if either
// changes — see supabase/functions/update-confirmation-email/index.ts.
function buildConfirmationEmailHtml({ heading, body, buttonText, footer, accentColor, confirmUrl, logoUrl = EMAIL_LOGO_URL }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const paragraphs = String(body || "").split("\n").map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3f3f46;">${esc(p)}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td bgcolor="#0A0A0C" style="background-color:#0A0A0C;padding:22px 32px;"><img src="${logoUrl}" alt="10DTendy" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;" /></td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:21px;color:#18181b;">${esc(heading)}</h1>
          ${paragraphs}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;"><tr><td style="border-radius:8px;background-color:${esc(accentColor)};">
            <a href="${esc(confirmUrl)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(buttonText)}</a>
          </td></tr></table>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">${esc(footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d, n) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}
// Goalies can only look back this many days from TODAY_DATE — older content isn't reachable.
const MAX_DAYS_BACK = 2;

// The training week runs Monday to Sunday.
function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function mondayOf(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}
function trainingBlockName(block) {
  return block === 1 ? "Weekly training block 1" : "Training block " + block;
}

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// A goalie's own calendar marking: "game", "rest", or nothing. "none" is what the calendar
// writes when a day is cleared back to normal.
function personalDayType(u, dateKeyStr) {
  const personal = (u.dayTypes || {})[dateKeyStr];
  return personal === "game" || personal === "rest" ? personal : null;
}
// Each month a goalie picks how Sundays work: "sunday" (automatic rest day, the default) or "own"
// (no automatic rest; they mark their own rest days). The plan is stored per month, e.g. "2026-10".
function monthPlanFor(u, dateKeyStr) {
  return (u.monthPlans || {})[dateKeyStr.slice(0, 7)] || "sunday";
}
// True when the Sunday of this week is a normal training day rather than the automatic rest day:
// the goalie chose their own rest days this month, marked a game or rest day of their own that
// week, or set that Sunday back to normal ("show my training" / clearing it in the calendar).
function sundayIsTraining(u, monday) {
  const sundayKey = dateKey(addDays(monday, 6));
  if (monthPlanFor(u, sundayKey) === "own") return true;
  for (let i = 0; i < 7; i++) if (personalDayType(u, dateKey(addDays(monday, i)))) return true;
  return (u.dayTypes || {})[sundayKey] === "none";
}
// Sunday is an automatic rest day unless sundayIsTraining. A coach has no marks, so previewing
// shows the automatic Sunday rest page.
function isAutoRest(u, dateKeyStr) {
  if (personalDayType(u, dateKeyStr) || (u.dayTypes || {})[dateKeyStr] === "none") return false;
  const date = dateFromKey(dateKeyStr);
  return date.getDay() === 0 && !sundayIsTraining(u, mondayOf(date));
}
function resolveDayType(u, dateKeyStr) {
  return personalDayType(u, dateKeyStr) || (isAutoRest(u, dateKeyStr) ? "rest" : null);
}

// Each goalie walks their level's ordered list of training blocks, one week at a time. A week's
// training days are the days not marked game/rest, plus Sunday only when it's a training Sunday
// (see sundayIsTraining). They're taken in order and paired up, each pair one block: with nothing
// marked that's Mon-Tue, Wed-Thu, Fri-Sat with Sunday off; a game Wednesday + rest Saturday gives
// Mon-Tue, Thu-Fri and Sunday alone; games Friday + Saturday and rest Sunday gives Mon-Tue, Wed-Thu.
// Pairing starts over each Monday. A block only starts on a day the goalie opens the app: if
// they're away the day a block should start, their list waits (nothing is skipped) and that
// block starts on the next training day they're back. The first block is shown the first day
// they open the app. Returns { ...trainingBlock, level, index, block, dayInBlock, blockDays } for
// dateKeyStr, or null if that date is a game/rest day, a day their list was waiting, or the coach
// hasn't created any blocks yet.
// A block goalies get: it has a drill, a practice focus and an off-ice workout, all published.
// Anything less is a draft that goalies skip until it's complete.
function blockIsReady(content, block) {
  const published = (items, id) => !!id && items.some((it) => it.id === id && it.published);
  return published(content.drills, block.drillId) && published(content.focusPoints, block.focusId) && published(content.offIceWorkouts, block.workoutId);
}
function readyBlocks(content, level) {
  return (content.trainingDays?.[level] || []).filter((b) => blockIsReady(content, b));
}

function trainingDayForDate(content, user, dateKeyStr, level) {
  if (resolveDayType(user, dateKeyStr)) return null;
  const list = readyBlocks(content, level);
  const current = walkTrainingBlocks(user, dateKeyStr, list)?.current;
  if (!current) return null;
  const entry = list[current.index];
  return entry ? { ...entry, level, index: current.index, block: current.block, dayInBlock: current.dayInBlock, blockDays: current.blockDays } : null;
}

// Walks a goalie's weeks from their first day up to dateKeyStr (the rules above) through the
// level's list. Each block that starts takes the next block in the list the goalie hasn't had
// yet; a block only counts as there from the day the coach created it. Once they've had every
// block, they repeat from Block 1 so they always have training, and as soon as the coach adds
// new blocks they go on to those (and after those, back to Block 1 again).
// Returns { reached, repeating, current }: how many blocks of the list they've reached, whether
// they're repeating the list right now, and the block that day belongs to ({ index, block,
// dayInBlock, blockDays }, or null on a day off or a day their list waited). Null if the date is
// before they started.
function walkTrainingBlocks(user, dateKeyStr, list) {
  // Being in the app right now counts as today's activity, even before the record is saved.
  const todayKey = dateKey(TODAY_DATE);
  const loginDays = { ...(user.loginDays || {}), [todayKey]: true };
  const firstLogin = Object.keys(loginDays).sort()[0];
  const signup = new Date(user.createdAt || TODAY_DATE.getTime());
  const signupKey = dateKey(new Date(signup.getFullYear(), signup.getMonth(), signup.getDate()));
  // Before activity tracking existed there's no login history, so those days aren't judged.
  const startKey = firstLogin && firstLogin > signupKey ? firstLogin : signupKey;
  if (dateKeyStr < startKey) return null;
  // Away = a past day with no visit. Days after today can't be judged yet, so they count as present.
  const isAway = (key) => key !== startKey && key < todayKey && !loginDays[key];
  const isTrainingDay = (date, sundayOk) => {
    const key = dateKey(date);
    return key >= startKey && !personalDayType(user, key) && (date.getDay() !== 0 || sundayOk);
  };

  // When each block became available (legacy blocks without a date always were).
  const createdKeys = list.map((b) => (b.createdAt ? dateKey(new Date(b.createdAt)) : ""));
  const availableOn = (key) => createdKeys.filter((c) => c <= key).length;
  let reached = 0;      // list position of the next block they haven't had yet
  let repeatPos = 0;    // position in the list while repeating it
  let repeating = false;
  let result = null;
  const targetMonday = dateKey(mondayOf(dateFromKey(dateKeyStr)));
  for (let monday = mondayOf(dateFromKey(startKey)); dateKey(monday) <= targetMonday; monday = addDays(monday, 7)) {
    const sundayOk = user.role !== "coach" && sundayIsTraining(user, monday);
    let blockNo = 0, current = null, open = false;
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const key = dateKey(day);
      if (key > dateKeyStr) break;
      if (!isTrainingDay(day, sundayOk)) continue;
      if (open) { open = false; current = { ...current, dayInBlock: 2 }; }
      else if (isAway(key)) { current = null; }
      else {
        const available = availableOn(key);
        let index = null;
        if (reached < available) { index = reached++; repeatPos = 0; repeating = false; }
        else if (available > 0) { index = repeatPos % available; repeatPos++; repeating = true; }
        if (index === null) current = null;
        else { open = true; blockNo++; current = { index, block: blockNo, dayInBlock: 1 }; }
      }
      if (key !== dateKeyStr || !current) continue;
      let blockDays = 2;
      if (current.dayInBlock === 1) {
        blockDays = 1;
        for (let j = i + 1; j < 7; j++) if (isTrainingDay(addDays(monday, j), sundayOk)) { blockDays = 2; break; }
      }
      result = { ...current, blockDays };
    }
  }
  return { reached, repeating, current: result };
}

// The notification bell's content — always computed fresh from the goalie's own calendar
// markings and logs, never stored, so it can't go stale or need a "seen" flag. For today and
// the days goalies can still go back to, a game day with no stats logged (or a rest day with
// no note) asks them to fill it in; each entry carries its date so tapping it opens that day.
// Also a "get back to training" nudge the day after a rest day. Coaches have no personal
// schedule, so they get none.
function getReminders(user) {
  if (!user || user.role === "coach") return [];
  const reminders = [];
  // New month: ask them to plan their game days and rest days until they've answered for it.
  const monthStart = new Date(TODAY_DATE.getFullYear(), TODAY_DATE.getMonth(), 1);
  if (user.createdAt && new Date(user.createdAt) < monthStart && !(user.monthPlans || {})[dateKey(TODAY_DATE).slice(0, 7)]) {
    reminders.push({ id: "plan-" + dateKey(TODAY_DATE).slice(0, 7), action: "plan-month", text: `New month — add your game days and rest days for ${MONTH_NAMES[TODAY_DATE.getMonth()]}.` });
  }
  for (let offset = 0; offset <= MAX_DAYS_BACK; offset++) {
    const day = addDays(TODAY_DATE, -offset);
    const key = dateKey(day);
    const type = personalDayType(user, key);
    const when = offset === 0 ? "today" : offset === 1 ? "yesterday" : "on " + WEEKDAY_NAMES[day.getDay()];
    if (type === "game" && !(user.gameLogs || {})[key]) {
      reminders.push({
        id: "game-" + key, date: key,
        text: offset === 0 ? "Game day today — good luck out there. Log your stats when it's done." : "You had a game " + when + " — log your stats.",
      });
    }
    if (type === "rest" && !(user.restNotes || {})[key]) {
      reminders.push({
        id: "restnote-" + key, date: key,
        text: offset === 0 ? "Rest day today — jot down what you did." : "You rested " + when + " — add a note about what you did.",
      });
    }
  }
  if (personalDayType(user, dateKey(addDays(TODAY_DATE, -1))) === "rest" && !resolveDayType(user, dateKey(TODAY_DATE))) {
    reminders.push({ id: "rest-back", text: "You rested yesterday — time to get back to training today." });
  }
  return reminders;
}

// The 3 site-wide default images (drill/focus/office fallbacks) can be replaced and
// re-cropped by the coach from the admin "Front Page" section. Focal points are stored
// as a CSS object-position value — "x% y%" from the pixel-precise picker, or (from
// before that picker existed) a keyword pair like "left top" — both are valid CSS.
const FOCAL_KEYWORD_PCT = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
function parseFocalPoint(value) {
  const [xRaw, yRaw] = (value || "center center").trim().split(/\s+/);
  const pct = (raw) => (raw?.endsWith("%") ? parseFloat(raw) : FOCAL_KEYWORD_PCT[raw] ?? 50);
  return { x: Math.max(0, Math.min(100, pct(xRaw) || 0)), y: Math.max(0, Math.min(100, pct(yRaw) || 0)) };
}

// itemUrl (a per-item photo) always wins and is never re-cropped by branding settings.
function brandImage(itemUrl, entry, fallback) {
  if (itemUrl) return { src: itemUrl, style: undefined };
  return { src: entry?.url || fallback, style: { objectPosition: entry?.focalPoint || "center center" } };
}

/* ============================================================================
   STORAGE HELPERS
   ============================================================================ */

// Guards against a storage call that never resolves (seen in some preview
// contexts) — without this, a hung call left the UI stuck on "Please wait…"
// forever with no visible error, which is exactly what looked like "nothing
// happened" when clicking Create account.
// Personal, browser-local data only (the cookie choice) — the login session itself is
// managed by supabase-js, and everything else (accounts, content, ticked-off training)
// lives in real Supabase tables via src/lib/data.js.
function getLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const NO_PROGRESS = { drill: false, focus: false, office: false };
// Ticks used to be kept in the browser as "progress:<date>"; they're saved to the account now,
// so clear out the old copies (the cookie policy no longer lists them).
try {
  for (const key of Object.keys(localStorage)) if (key.startsWith("progress:")) localStorage.removeItem(key);
} catch { /* storage unavailable: nothing to clear */ }
// How many of a day's three parts (drill, practice focus, off-ice) were ticked off.
function doneCount(p) {
  return p ? [p.drill, p.focus, p.office].filter(Boolean).length : 0;
}

// Cookie consent. The app's own browser storage (the login and this choice itself) is strictly necessary and needs no consent. YouTube is the only
// third party that can store identifiers, so no video content (player or thumbnails)
// loads from it until the viewer allows it. The choice is per browser, like the login.
const CONSENT_KEY = "cookie-consent";
function readConsent() {
  const c = getLocal(CONSENT_KEY);
  return c && typeof c.youtube === "boolean" ? c : null;
}
let consentState = readConsent();
const consentListeners = new Set();
function setConsent(youtube) {
  consentState = { youtube, at: new Date().toISOString() };
  setLocal(CONSENT_KEY, consentState);
  consentListeners.forEach((fn) => fn());
}
function subscribeConsent(fn) { consentListeners.add(fn); return () => consentListeners.delete(fn); }
function useConsent() { return useSyncExternalStore(subscribeConsent, () => consentState); }
// Links anywhere in the app open these through the one <CookieConsent /> at the root.
function openCookieSettings() { window.dispatchEvent(new Event("open-cookie-settings")); }
function openLegalDoc(doc) { window.dispatchEvent(new CustomEvent("open-legal-doc", { detail: doc })); }
function openCookiePolicy() { openLegalDoc("cookies"); }

/* ============================================================================
   SHARED VISUAL MOTIF
   ============================================================================ */

function CreaseArc({ className = "", opacity = 1 }) {
  return (
    <svg className={className} viewBox="0 0 240 140" fill="none" style={{ opacity }}>
      <path d="M10 140 C10 70 70 10 120 10 C170 10 230 70 230 140" stroke="var(--accent)" strokeWidth="2" strokeOpacity="0.5" />
      <path d="M40 140 C40 90 80 40 120 40 C160 40 200 90 200 140" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.28" />
    </svg>
  );
}
function CreaseRing({ progress, size = 104 }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 104 104">
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 52 52)"
        style={{ transition: "stroke-dashoffset 500ms cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}
function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

/* ============================================================================
   RICH TEXT (objective/instructions-style fields): a small bold/italic/bullet
   editor. Paste from Word, Google Docs, Notes, etc. usually marks bold/italic
   with inline styles on a <span> rather than a <b>/<i> tag — that's read here
   too, not just the semantic tags. Everything else pasted (colors, fonts,
   links, images, scripts...) is stripped down to this fixed, safe tag set.
   ============================================================================ */
const RICH_TEXT_ALLOWED_STRUCT = { UL: "ul", OL: "ol", LI: "li", BR: "br", P: "p" };

function richTextIsBold(el) {
  const w = el.style?.fontWeight;
  if (w) {
    const n = parseInt(w, 10);
    return isNaN(n) ? /bold/i.test(w) : n >= 600;
  }
  return el.tagName === "B" || el.tagName === "STRONG";
}
function richTextIsItalic(el) {
  if (el.style?.fontStyle) return /italic|oblique/i.test(el.style.fontStyle);
  return el.tagName === "I" || el.tagName === "EM";
}

// Links in legal texts may only point to web pages or email addresses.
function safeLinkHref(href) {
  const h = String(href || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}
const RICH_TEXT_HEADINGS = { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1 };

// Keeps only bold, italic, bulleted/numbered lists, line breaks and paragraphs — everything
// else (spans, fonts, colors, links, images, tables, scripts...) is unwrapped to plain text.
// Legal texts (legal = true) additionally keep headings (as <h3>) and web/email links.
function sanitizeRichHtml(html, legal = false) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const walk = (node) => {
    const out = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) out.push(document.createTextNode(child.textContent));
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return;
      let children = walk(child);
      if (richTextIsBold(child)) { const b = document.createElement("strong"); b.append(...children); children = [b]; }
      if (richTextIsItalic(child)) { const i = document.createElement("em"); i.append(...children); children = [i]; }
      const href = legal && tag === "A" ? safeLinkHref(child.getAttribute("href")) : null;
      if (RICH_TEXT_ALLOWED_STRUCT[tag]) {
        const el = document.createElement(RICH_TEXT_ALLOWED_STRUCT[tag]);
        el.append(...children);
        // A bullet with nothing in it (the editor leaves one after the last item) isn't shown.
        if (tag === "LI" && !el.textContent.trim()) return;
        out.push(el);
      } else if (legal && RICH_TEXT_HEADINGS[tag]) {
        const el = document.createElement("h3");
        el.append(...children);
        out.push(el);
      } else if (href) {
        const el = document.createElement("a");
        el.setAttribute("href", href);
        if (!/^mailto:/i.test(href)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
        el.append(...children);
        out.push(el);
      } else if (tag === "DIV") {
        // Word/Docs mark paragraph breaks with <div>, not <p>.
        const el = document.createElement("p");
        el.append(...children);
        out.push(el);
      } else {
        out.push(...children);
      }
    });
    return out;
  };
  const container = document.createElement("div");
  container.append(...walk(doc.body));
  return container.innerHTML;
}

// Old plain-text values (typed before this editor existed) never contain a real tag, so they're
// escaped and line-broken instead of parsed as HTML — a stray "<5 sec>" shouldn't be swallowed.
function looksLikeRichHtml(value) {
  return typeof value === "string" && /<\/?[a-zA-Z][^>]*>/.test(value);
}
function renderRichText(value) {
  const v = value || "";
  if (!v) return "";
  if (looksLikeRichHtml(v)) return sanitizeRichHtml(v);
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n|\r|\n/g, "<br>");
}
// The plain text of a rich-text value (for places like the printed sheet that can't show formatting).
function richTextToPlain(value) {
  const html = renderRichText(value).replace(/<\/(p|li)>|<br\s*\/?>/gi, " ");
  return (new DOMParser().parseFromString(html, "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
}

// "25 min • Cones or pucks" under a detail page's title, leaving out blank parts (and the
// whole row when everything is blank).
function MetaRow({ items }) {
  const parts = items.map((v) => String(v || "").trim()).filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="meta-row meta-row--lg">
      {parts.map((p, i) => (
        <React.Fragment key={i}>{i > 0 && <span className="dot">•</span>}<span>{p}</span></React.Fragment>
      ))}
    </div>
  );
}

// An exercise's "3 × 8 · Rest 45 sec" line, leaving out whichever parts are blank.
function exerciseSummary(ex) {
  const sets = (ex.sets || "").trim();
  const rest = (ex.rest || "").trim();
  return [sets, rest && `Rest ${rest}`].filter(Boolean).join(" · ");
}

function RichText({ value, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderRichText(value) }} />;
}

/* ============================================================================
   UI PRIMITIVES — shared dialog and menu behaviour
   ----------------------------------------------------------------------------
   Every popup window and dropdown in the app goes through these, so they all
   behave the same way for mouse, touch, keyboard and screen-reader users:
   - dialogs: announced as a dialog with their title, Escape closes the topmost
     one, focus moves inside and can't Tab out to the page behind, the page
     behind doesn't scroll, and focus returns to what opened it afterwards;
   - menus: Escape or a click/tap outside closes them, and focus goes back to
     the button that opened them.
   ============================================================================ */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const openDialogs = []; // panels of every open dialog
// The dialog in front is the one latest in the page: overlays share a z-index, so later wins.
function topDialog() {
  return openDialogs.reduce((top, p) => (!top || (top.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) ? p : top), null);
}
let scrollLockCount = 0;
let savedBodyOverflow = "";

function useDialogBehavior(panelRef, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Remembered during the first render, before any autoFocus inside the dialog moves focus.
  const returnFocusRef = useRef(undefined);
  if (returnFocusRef.current === undefined) returnFocusRef.current = typeof document !== "undefined" ? document.activeElement : null;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    openDialogs.push(panel);
    if (scrollLockCount++ === 0) { savedBodyOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    // A dialog that opens underneath another one (e.g. a popup behind a prompt) mustn't take focus.
    // Retried for a few frames: a panel that animates in starts out invisible, and browsers
    // can't focus an invisible element.
    let focusFrame = 0;
    const focusIn = (tries) => {
      if (topDialog() !== panel || panel.contains(document.activeElement)) return;
      panel.focus({ preventScroll: true });
      if (!panel.contains(document.activeElement) && tries < 20) focusFrame = requestAnimationFrame(() => focusIn(tries + 1));
    };
    focusIn(0);

    const onKeyDown = (e) => {
      if (topDialog() !== panel) return;
      if (e.key === "Escape") {
        if (onCloseRef.current) { e.preventDefault(); onCloseRef.current(); }
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => el.getClientRects().length > 0);
      if (!items.length) { e.preventDefault(); panel.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      const i = openDialogs.indexOf(panel);
      if (i >= 0) openDialogs.splice(i, 1);
      if (--scrollLockCount === 0) document.body.style.overflow = savedBodyOverflow;
      // Hand focus back to what opened this dialog — unless another dialog is still in front,
      // in which case focus stays (or goes) inside that one.
      const front = topDialog();
      const back = returnFocusRef.current;
      if (front && !(back && front.contains(back))) {
        if (!front.contains(document.activeElement)) front.focus({ preventScroll: true });
      } else if (back && back.focus && document.contains(back)) {
        back.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// The attributes that make an element a modal dialog for assistive technology.
function dialogProps(labelId) {
  return { role: "dialog", "aria-modal": "true", "aria-labelledby": labelId, tabIndex: -1 };
}

// Dropdowns and slide-down menus: Escape or a click/tap outside `refs` closes them.
function useDismissable(open, onClose, refs, triggerRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const inside = (target) => refs.some((r) => r.current && r.current.contains(target));
    const onPointerDown = (e) => { if (!inside(e.target)) onCloseRef.current(); };
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || openDialogs.length) return;
      onCloseRef.current();
      triggerRef?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

// In-app replacements for window.confirm / window.prompt, in the app's own style:
//   if (!(await confirmDialog({ title, message, confirmLabel, danger }))) return;
//   const text = await promptDialog({ title, label, placeholder, confirmLabel }); // null if cancelled
// Rendered by the single <DialogHost /> at the root.
let pendingDialog = null;
const pendingDialogListeners = new Set();
function setPendingDialog(next) { pendingDialog = next; pendingDialogListeners.forEach((fn) => fn()); }
function openAppDialog(options, cancelValue) {
  if (pendingDialog) pendingDialog.resolve(pendingDialog.cancelValue);
  return new Promise((resolve) => setPendingDialog({ ...options, cancelValue, resolve, key: Date.now() + Math.random() }));
}
function confirmDialog(options) { return openAppDialog({ kind: "confirm", ...options }, false); }
function promptDialog(options) { return openAppDialog({ kind: "prompt", ...options }, null); }

function DialogHost() {
  const dialog = useSyncExternalStore(
    (fn) => { pendingDialogListeners.add(fn); return () => pendingDialogListeners.delete(fn); },
    () => pendingDialog,
  );
  if (!dialog) return null;
  const finish = (value) => { setPendingDialog(null); dialog.resolve(value); };
  return <AppDialog key={dialog.key} dialog={dialog} onFinish={finish} />;
}

function AppDialog({ dialog, onFinish }) {
  const panelRef = useRef(null);
  const labelId = useId();
  const [value, setValue] = useState(dialog.defaultValue || "");
  const cancel = () => onFinish(dialog.cancelValue);
  useDialogBehavior(panelRef, cancel);
  const isPrompt = dialog.kind === "prompt";
  const submit = (e) => {
    e.preventDefault();
    if (isPrompt) { if (value.trim()) onFinish(value.trim()); }
    else onFinish(true);
  };
  return (
    <div className="dialog-host no-print">
      <div className="app-dialog-overlay" onClick={cancel}>
        <form ref={panelRef} className="app-dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit} {...dialogProps(labelId)}>
          <h2 id={labelId} className="app-dialog-title">{dialog.title}</h2>
          {dialog.message && <p className="app-dialog-message">{dialog.message}</p>}
          {isPrompt && (
            <label className="auth-field app-dialog-field">
              {dialog.label && <span>{dialog.label}</span>}
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={dialog.placeholder} autoFocus />
            </label>
          )}
          <div className="app-dialog-actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={cancel} autoFocus={!isPrompt}>{dialog.cancelLabel || "Cancel"}</button>
            <button type="submit" className={"btn btn--small " + (dialog.danger ? "btn--danger" : "btn--primary")} disabled={isPrompt && !value.trim()}>
              {dialog.confirmLabel || "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// A small bold/italic/bullet-list editor for one field. Stores sanitized HTML back into the
// same string field the plain textarea used to hold — old plain-text values still load fine
// (rendered by RichText above) and get upgraded to real HTML the next time they're edited.
function RichTextEditor({ value, onChange, placeholder, rows = 3, legal = false }) {
  const ref = useRef(null);
  const minHeight = rows * 20 + 16;

  // Loads the starting value into the live DOM once, on mount, and never again for this
  // component instance's lifetime. Every later change to `value` originates from this same
  // editor's own commit() below — re-syncing on each of those (a plain [value] dependency) meant
  // every keystroke's resulting parent re-render raced the browser's own native DOM update with
  // a React-driven innerHTML overwrite, which could reset the field, drop the caret, or swallow
  // input while typing. The admin form fully unmounts/remounts this editor on Cancel or when
  // switching what's being edited, so a fresh mount always picks up the current saved value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = looksLikeRichHtml(value) ? sanitizeRichHtml(value, legal) : renderRichText(value);
    if (el.innerHTML !== html) el.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => { if (ref.current) onChange(sanitizeRichHtml(ref.current.innerHTML, legal)); };
  // Puts the caret at the end of the field if the selection isn't already inside it.
  const ensureSelection = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel) return false;
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return true;
  };
  const cmd = (name) => (e) => {
    e.preventDefault();
    if (!ensureSelection()) return;
    document.execCommand(name);
    commit();
  };
  const toggleHeading = (e) => {
    e.preventDefault();
    if (!ensureSelection()) return;
    const current = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
    document.execCommand("formatBlock", false, current === "h3" ? "p" : "h3");
    commit();
  };
  const addLink = async (e) => {
    e.preventDefault();
    if (!ensureSelection()) return;
    const sel = window.getSelection();
    const range = sel.getRangeAt(0).cloneRange();
    let url = (await promptDialog({
      title: "Add a link", label: "Web address or email", placeholder: "https://… or name@example.com", confirmLabel: "Add link",
    })) || "";
    if (!url) return;
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) url = "mailto:" + url;
    else if (!/^(https?:\/\/|mailto:)/i.test(url)) url = "https://" + url;
    ref.current.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    if (range.collapsed) {
      const text = url.replace(/^mailto:/i, "");
      const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(text)}</a>`);
    } else {
      document.execCommand("createLink", false, url);
    }
    commit();
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const insert = html ? sanitizeRichHtml(html, legal) : renderRichText(e.clipboardData.getData("text/plain"));
    document.execCommand("insertHTML", false, insert);
    commit();
  };

  return (
    <div className="rich-text-field">
      <div className="rich-text-toolbar">
        <button type="button" className="rich-text-btn" onMouseDown={cmd("bold")} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className="rich-text-btn rich-text-btn--i" onMouseDown={cmd("italic")} aria-label="Italic"><em>i</em></button>
        <button type="button" className="rich-text-btn" onMouseDown={cmd("insertUnorderedList")} aria-label="Bulleted list"><List size={14} /></button>
        {legal && (
          <>
            <button type="button" className="rich-text-btn" onMouseDown={cmd("insertOrderedList")} aria-label="Numbered list"><ListOrdered size={14} /></button>
            <button type="button" className="rich-text-btn" onMouseDown={toggleHeading} aria-label="Heading"><Heading size={14} /></button>
            <button type="button" className="rich-text-btn" onMouseDown={addLink} aria-label="Link"><Link2 size={14} /></button>
          </>
        )}
      </div>
      <div
        ref={ref}
        className="rich-text-input"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        data-placeholder={placeholder}
        onBlur={commit}
        onInput={commit}
        onPaste={handlePaste}
      />
    </div>
  );
}

// Shrinks an uploaded image for storage without changing its aspect ratio: it's scaled down
// only if it's bigger than IMAGE_MAX_DIMENSION on its longest side (never enlarged, never
// cropped) and re-encoded to a smaller file. PNGs with no transparent pixels are re-encoded as
// JPEG, since flat photos/screenshots compress far smaller that way; a PNG that actually uses
// transparency stays PNG so nothing gets a black or white background. If compressing somehow
// doesn't come out smaller (rare, e.g. a tiny or already-optimized file), the original is kept.
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

function loadImageBitmapFrom(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function compressImageFile(file) {
  if (!file.type?.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const img = await loadImageBitmapFrom(file);
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);

    let usePng = file.type === "image/png";
    if (usePng) {
      // Only keep PNG if some pixel is actually transparent — otherwise a flat PNG re-encodes
      // far smaller as JPEG. Sampled, not scanned pixel-by-pixel, so this stays fast at 1600px.
      const { data } = ctx.getImageData(0, 0, w, h);
      usePng = false;
      for (let i = 3; i < data.length; i += 4 * 37) { if (data[i] < 255) { usePng = true; break; } }
    }

    const mime = usePng ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, IMAGE_JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const ext = usePng ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type: mime });
  } catch {
    // Any failure (corrupt image, browser quirk) — upload exactly what was picked.
    return file;
  }
}

// Traced directly from the reference crossed-sticks artwork.
const CROSSED_STICKS_PATH = "M 35.2 25.2 C 34.5 25.9 34 26.8 34 27.2 C 34 27.6 45.5 42.4 59.5 60 C 73.5 77.7 85 92.5 85 93 C 85 94.5 50.1 136.9 47.4 138.6 C 43.5 141.2 31.8 140 17.7 135.5 C 6.4 131.9 5.9 131.8 4 133.5 C -0.5 137.6 2.1 144.9 9.4 148.4 C 14.4 150.8 30.2 154.1 37.6 154.3 C 45.6 154.6 46.1 154.1 66.3 128 C 74.6 117.3 83.3 106.1 85.6 103.3 L 89.8 98 103.2 114.8 C 110.5 124 119.3 135.3 122.7 140 C 132.3 153.3 133.9 154.5 141.4 154.3 C 149 154.1 165.8 150.7 169.9 148.6 C 177.8 144.5 180.6 135 174.5 132.6 C 173.7 132.3 167 133.8 159.8 136 C 146.3 140.1 136.1 141.2 132.1 139 C 130.5 138.2 94.9 95 94.3 93.2 C 94.1 92.8 100.9 83.9 109.3 73.5 C 145.1 28.6 146.1 27.4 144.1 25.6 C 143.1 24.7 142.1 24 141.8 24 C 141.5 24 129.6 38.4 115.4 56.1 C 90.6 86.9 89.6 88.1 88.1 86.1 C 77 71.6 38.2 24.1 37.5 24.1 C 36.9 24 35.9 24.5 35.2 25.2 M 80.6 144.1 C 77 146.9 77.1 151.3 80.7 153.7 C 83.9 155.8 96.2 156.1 99.8 154.2 C 102.9 152.4 102.9 145.8 99.8 143.6 C 96.3 141.1 84 141.4 80.6 144.1";

function CrossedSticks({ size = 24, className, ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="-5 -6.5 190 190" fill="currentColor" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      <path fillRule="evenodd" d={CROSSED_STICKS_PATH} />
    </svg>
  );
}

// Traced directly from the reference goalie-mask artwork.
const GOALIE_MASK_PATH = "M 425 241.9 C 417.7 243.5 409.8 249.9 408.4 255.4 C 408.1 256.7 409 263.5 410.5 270.6 C 415.7 296.3 415 301 406 301 C 399.1 301 397.9 298.8 394.1 280.5 C 389.2 257 389.8 257.8 376.8 261.5 C 338.7 272.5 308.7 292.4 291.7 318.1 C 283.2 331 268.6 362.9 270.4 364.7 C 270.7 365 274.9 364.1 279.7 362.7 C 296.9 357.4 310.4 355.1 314.5 356.6 C 316.5 357.4 319 362.2 319 365.4 C 319 370.3 315.3 372.6 303 375.9 C 251.6 389.3 241 399.6 241 435.5 C 241 455.7 248.6 520.7 253.1 539.7 C 258.4 562 272.3 574.2 317.7 596.9 C 328 602 334.3 605.8 335.1 607.2 C 338.1 612.7 334.5 620 328.8 620 C 325 620 312.4 615.1 299.5 608.5 C 287 602.2 286.7 602.6 294.8 614.8 C 303.4 627.7 335.2 681.4 343.8 697.5 C 355 718.6 362.2 727.5 376.7 738.2 C 410.5 763.1 465.3 766.7 505.9 746.8 C 527.3 736.3 539.3 723.7 553.2 697.5 C 561.8 681.4 593.6 627.7 602.2 614.8 C 610.1 602.9 610 602 600.9 607 C 591 612.3 572 620 568.6 620 C 562.3 620 558.1 611.2 562.1 606.4 C 562.8 605.6 571.7 600.7 581.9 595.5 C 626.1 573.2 639.1 561.4 644 539.5 C 645.2 534.1 652.1 486.7 654.1 470 C 656.4 451.1 655.9 419.7 653.2 412 C 647.1 394.6 634.7 386.9 595.5 376.3 C 578.5 371.8 575.2 368.3 579.5 360 C 582.3 354.6 590.3 355 613.8 361.7 C 620.6 363.7 626.4 365 626.7 364.6 C 628.8 362.5 612.3 327.9 602.8 314.5 C 587.1 292.5 561.2 274.9 528.5 264.2 C 506.8 257.1 508.1 256.3 503.4 279 C 501.4 288.6 499.2 296.6 498.1 298 C 495.5 301.6 488.7 302 485.3 298.8 C 482.2 296 482.4 291.6 486.5 271.1 C 489.5 256.5 489.4 254.6 484.8 249.5 C 478.3 242.1 476.3 241.6 451 241.3 C 438.6 241.2 426.9 241.5 425 241.9 M 403 406.1 C 373.3 408.3 324.2 415.8 319.1 418.9 C 315.1 421.4 324.8 441.6 336.9 455.8 C 355 477.3 394.2 495.4 429.8 498.7 L 436 499.3 436 452.1 L 436 405 425.3 405.1 C 419.3 405.2 409.3 405.7 403 406.1 M 461.2 452.1 L 461.5 499.5 465.5 499.2 C 494.6 497 529.7 483.1 550.1 465.7 C 565.9 452.2 582.8 424.2 577.9 419.5 C 573.4 415.2 514.6 406.9 477.6 405.4 L 461 404.7 461.2 452.1 M 289.3 432.4 C 283.8 441 283 448.2 285.5 471 C 289 504.4 295 524.6 304.1 534.5 C 308 538.8 325.6 551 327.8 551 C 328.4 551 332.9 547 337.7 542.2 C 346.5 533.5 360.4 523.5 372.8 517 C 380.1 513.2 380.1 513.4 369 508.6 C 334.6 493.8 306.7 466.3 296.4 436.8 C 293.4 428.1 292.5 427.5 289.3 432.4 M 601 435.3 C 589.8 466.1 568.4 488.6 533.5 506.1 L 518.3 513.7 524.9 517 C 536.8 523.2 551.9 534 560.5 542.6 C 565.2 547.2 569.4 551 569.8 551 C 571.9 551 589 538.7 593.3 534.1 C 601 525.9 605.3 513.8 609.4 489 C 614.5 458.2 614 441.5 607.8 432.4 C 604.6 427.7 603.6 428.1 601 435.3 M 423.9 527.1 C 404.9 530.3 383.7 538.4 369.8 547.7 C 362.3 552.6 352 561.8 352 563.4 C 352 568.8 429.3 595 435 591.5 C 436.2 590.8 436.4 526.4 435.3 525.7 C 434.8 525.5 429.8 526.1 423.9 527.1 M 461 558.7 L 461 592.2 466.8 591.5 C 475.4 590.5 497.2 584.6 509 580.2 C 524.9 574.3 545 564.9 545 563.5 C 545 562.8 543.1 560.5 540.8 558.3 C 522.4 541.4 495.5 529.9 464.8 525.6 L 461 525.1 461 558.7";

function GoalieMask({ size = 24, className, ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="241 241 415 526" fill="currentColor" className={className} aria-hidden="true" {...rest}>
      <path fillRule="evenodd" d={GOALIE_MASK_PATH} />
    </svg>
  );
}

function HockeyNet({ size = 24, strokeWidth = 2, className, ...rest }) {
  const clipId = "hockey-net-" + React.useId().replace(/:/g, "");
  const inner = "M5.5 18V12A3 3 0 0 1 8.5 9h7a3 3 0 0 1 3 3v6";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      <defs><clipPath id={clipId}><path d={inner + "Q12 16 5.5 18Z"} /></clipPath></defs>
      <path d="M2.5 19V11A5 5 0 0 1 7.5 6h9A5 5 0 0 1 21.5 11v8" />
      <path d={inner} />
      <g clipPath={`url(#${clipId})`} strokeWidth={strokeWidth * 0.3}><path d="M-4 6l14 14M10 6l-14 14M2 6l14 14M16 6l-14 14M8 6l14 14M22 6l-14 14M14 6l14 14M28 6l-14 14M20 6l14 14M34 6l-14 14M26 6l14 14M40 6l-14 14" /></g>
      <path d="M5.5 18Q12 16 18.5 18" />
    </svg>
  );
}

/* ============================================================================
   AUTH SCREEN
   ============================================================================ */

// New passwords: at least 8 characters, including two numbers and two special characters.
const PASSWORD_RULES = [
  { label: "At least 8 characters", ok: (pw) => pw.length >= 8 },
  { label: "At least 2 numbers", ok: (pw) => (pw.match(/[0-9]/g) || []).length >= 2 },
  { label: "At least 2 special characters (like ! ? # $ %)", ok: (pw) => (pw.match(/[^A-Za-z0-9\s]/g) || []).length >= 2 },
];
function passwordProblem(pw) {
  const failed = PASSWORD_RULES.find((r) => !r.ok(pw));
  return failed ? `Your password needs: ${failed.label.toLowerCase()}.` : "";
}
function PasswordChecklist({ password }) {
  if (!password) return null;
  return (
    <ul className="password-rules" aria-live="polite">
      {PASSWORD_RULES.map((r) => (
        <li key={r.label} className={r.ok(password) ? "ok" : ""}>{r.ok(password) ? <Check size={12} /> : <X size={12} />} {r.label}</li>
      ))}
    </ul>
  );
}

// Cloudflare Turnstile, the bot check on login, sign-up, password reset and password change.
// The site key is public. While it's empty the widget isn't shown and no token is sent, so
// CAPTCHA protection must only be switched on in Supabase (Authentication -> Attack
// Protection) after a key is set here and deployed, or every login would be refused.
const TURNSTILE_SITE_KEY = "0x4AAAAAAFClBEEJH0UJW0Bc";
let turnstileScript = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      tag.async = true;
      tag.onload = () => resolve(window.turnstile);
      tag.onerror = () => { turnstileScript = null; reject(new Error("Turnstile failed to load")); };
      document.head.appendChild(tag);
    });
  }
  return turnstileScript;
}

// Renders the check and reports its one-time token through onToken ("" when there's none).
// Bump resetKey after every attempt: a token can only be used once.
function TurnstileWidget({ onToken, resetKey = 0 }) {
  const hostRef = useRef(null);
  const widgetRef = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile().then((ts) => {
      if (cancelled || !hostRef.current) return;
      widgetRef.current = ts.render(hostRef.current, {
        sitekey: TURNSTILE_SITE_KEY, theme: "dark", size: "flexible",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    }).catch(() => onTokenRef.current(""));
    return () => {
      cancelled = true;
      if (widgetRef.current != null && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
      onTokenRef.current("");
    };
  }, []);
  useEffect(() => {
    if (!resetKey || widgetRef.current == null || !window.turnstile) return;
    onTokenRef.current("");
    window.turnstile.reset(widgetRef.current);
  }, [resetKey]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={hostRef} className="turnstile-box" />;
}
const CAPTCHA_WAIT_MESSAGE = "Just a moment — we're checking you're not a bot. Try again in a second.";
const isCaptchaError = (message) => /captcha/i.test(message || "");

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", position: "Goalie", experience: "Junior" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const legal = useLegal();
  const access = useAppAccess();
  const signupsClosed = access?.signupsOpen === false;
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaMissing = () => { if (TURNSTILE_SITE_KEY && !captchaToken) { setError(CAPTCHA_WAIT_MESSAGE); return true; } return false; };

  // A shared link can look like ...#invite=<code> — when present,
  // switch to sign-up and pre-fill the code so the recipient doesn't need to
  // know it's even a thing unless you've told them.
  useEffect(() => {
    const hash = window.location.hash || "";
    if (/error_code=otp_expired|error=access_denied/.test(hash)) {
      setMode("forgot");
      setError("That reset link has expired or was already used. Enter your email to get a new one.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    const match = hash.match(/invite=([^&]+)/);
    if (match) {
      setInviteCode(decodeURIComponent(match[1]));
      setInviteOpen(true);
      setMode("signup");
    }
  }, []);

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const sendReset = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    if (!email) { setError("Enter the email you signed up with."); return; }
    if (captchaMissing()) return;
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
        captchaToken: captchaToken || undefined,
      });
      if (resetError) {
        setError(isCaptchaError(resetError.message)
          ? "The security check didn't go through. Please try again."
          : /rate|seconds|too many/i.test(resetError.message)
            ? "Too many requests — wait a minute and try again."
            : "We couldn't send the email right now. Please try again in a few minutes.");
        return;
      }
      // Same message whether or not an account exists, so this can't be used to find out who has one.
      setResetSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setCaptchaReset((n) => n + 1);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password || (mode === "signup" && !form.name)) {
      setError("Fill in all required fields.");
      return;
    }
    if (mode === "signup") {
      const problem = passwordProblem(form.password);
      if (problem) { setError(problem); return; }
      if (form.password !== form.confirmPassword) { setError("The two passwords don't match."); return; }
      if (!agreeTerms || !agreeAge) { setError("Please accept the Terms of Use and confirm your age to create an account."); return; }
    }
    const trimmedInvite = inviteCode.trim();
    if (captchaMissing()) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password: form.password,
          options: {
            data: { name: form.name.trim(), position: form.position, experience: form.experience, invite_code: trimmedInvite, terms_version: legal?.version || "" },
            captchaToken: captchaToken || undefined,
          },
        });
        if (signUpError) {
          setError(isCaptchaError(signUpError.message)
            ? "The security check didn't go through. Please try again."
            : signUpError.message === "User already registered"
            ? "An account with this email already exists — try logging in instead."
            : trimmedInvite && /database error|invite code/i.test(signUpError.message)
              ? "That invite code isn't valid."
              : /database error|signups are closed/i.test(signUpError.message)
                ? "We're getting things ready — new accounts will open soon."
                : signUpError.message);
          return;
        }
        if (!data.session) {
          // Email confirmation is required — there's no session yet.
          setCheckEmail(true);
          return;
        }
        const profile = await fetchCurrentProfile();
        if (profile) onAuthed(profile);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email, password: form.password, options: { captchaToken: captchaToken || undefined },
        });
        if (signInError) {
          setError(signInError.message === "Email not confirmed"
            ? "Check your inbox and confirm your email before logging in."
            : isCaptchaError(signInError.message)
              ? "The security check didn't go through. Please try again."
              : "Incorrect email or password.");
          return;
        }
        const profile = await fetchCurrentProfile();
        if (profile?.removed) {
          await supabase.auth.signOut();
          setError("This account has been removed. Contact your coach.");
          return;
        }
        if (profile) onAuthed(profile);
      }
    } catch (err) {
      console.error("10DTendy sign-up/login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setCaptchaReset((n) => n + 1);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-side">
        <CreaseArc className="auth-arc" opacity={0.4} />
        <img src={BADGE_LOGO_SRC} alt="" className="auth-badge" />
        <div className="auth-side-content">
          <div className="nav-logo"><img src={LOGO_SRC} alt="10DTendy" className="brand-logo brand-logo--auth" /></div>
          <h1 className="auth-headline">Be different, stand out. Protect This Crease.</h1>
          <p className="auth-sub">Get better one day at a time and train under professional guidance to unlock your full potential.</p>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form-card">
          {mode === "forgot" ? (
            resetSent ? (
              <div className="auth-check-email">
                <Mail size={28} />
                <h2>Check your email</h2>
                <p>If there's an account for <strong>{form.email.trim().toLowerCase()}</strong>, we've sent a link to reset your password. It can take a few minutes, and it's worth checking your spam folder.</p>
                <button className="btn btn--ghost btn--small" onClick={() => { setResetSent(false); setMode("login"); }}>Back to log in</button>
              </div>
            ) : (
              <form onSubmit={sendReset} className="auth-form">
                <h2 className="auth-reset-title">Reset your password</h2>
                <p className="auth-reset-sub">Enter your email and we'll send you a link to choose a new password.</p>
                <label className="auth-field">
                  <span>Email</span>
                  <div className="auth-input-icon"><Mail size={14} /><input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="you@example.com" autoFocus /></div>
                </label>
                <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
                {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}
                <button className="btn btn--primary auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Send reset link"}</button>
                <button type="button" className="auth-invite-link" onClick={() => { setError(""); setMode("login"); }}>Back to log in</button>
              </form>
            )
          ) : checkEmail ? (
            <div className="auth-check-email">
              <Mail size={28} />
              <h2>Check your email</h2>
              <p>We sent a confirmation link to <strong>{form.email.trim().toLowerCase()}</strong>. Click it, then come back and log in.</p>
              <button className="btn btn--ghost btn--small" onClick={() => { setCheckEmail(false); setMode("login"); }}>Back to log in</button>
            </div>
          ) : (
            <>
              <div className="auth-tabs">
                <button className={"auth-tab" + (mode === "login" ? " active" : "")} onClick={() => setMode("login")}>Log in</button>
                <button className={"auth-tab" + (mode === "signup" ? " active" : "")} onClick={() => setMode("signup")}>Sign up</button>
              </div>

              {mode === "signup" && signupsClosed && !inviteOpen ? (
                <div className="auth-form auth-closed">
                  <h2 className="auth-reset-title">We're getting things ready</h2>
                  <p className="auth-reset-sub">New accounts will open soon. If you already have one, log in instead.</p>
                  <button type="button" className="btn btn--primary auth-submit" onClick={() => { setError(""); setMode("login"); }}>Go to log in</button>
                  <button type="button" className="auth-invite-link" onClick={() => setInviteOpen(true)}>Have a coach invite code?</button>
                </div>
              ) : (
              <form onSubmit={submit} className="auth-form">
                {mode === "signup" && (
                  <label className="auth-field">
                    <span>Name</span>
                    <input value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Jordan Reyes" maxLength={100} />
                  </label>
                )}
                <label className="auth-field">
                  <span>Email</span>
                  <div className="auth-input-icon"><Mail size={14} /><input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="you@example.com" /></div>
                </label>
                <label className="auth-field">
                  <span>Password</span>
                  <div className="auth-input-icon"><Lock size={14} /><input type="password" value={form.password} onChange={(e) => field("password", e.target.value)} placeholder="••••••••" /></div>
                </label>

                {mode === "signup" && (
                  <>
                    <PasswordChecklist password={form.password} />
                    <label className="auth-field">
                      <span>Re-type password</span>
                      <div className="auth-input-icon"><Lock size={14} /><input type="password" value={form.confirmPassword} onChange={(e) => field("confirmPassword", e.target.value)} placeholder="Type it again" autoComplete="new-password" /></div>
                      {form.confirmPassword && form.password !== form.confirmPassword && <span className="password-mismatch">Passwords don't match yet.</span>}
                    </label>
                  </>
                )}

                {mode === "signup" && !inviteOpen && (
                  <label className="auth-field">
                    <span>Experience</span>
                    <select value={form.experience} onChange={(e) => field("experience", e.target.value)}>
                      <option>Youth</option><option>Junior</option><option>Pro</option>
                    </select>
                  </label>
                )}

                {mode === "signup" && !inviteOpen && (
                  <button type="button" className="auth-invite-link" onClick={() => setInviteOpen(true)}>Have a coach invite code?</button>
                )}
                {mode === "signup" && inviteOpen && (
                  <label className="auth-field">
                    <span>Invite code</span>
                    <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Paste your invite code" />
                  </label>
                )}

                {mode === "signup" && (
                  <LegalCheckboxes terms={agreeTerms} age={agreeAge} onTerms={setAgreeTerms} onAge={setAgreeAge} />
                )}

                {mode === "login" && (
                  <button type="button" className="auth-invite-link" onClick={() => { setError(""); setMode("forgot"); }}>Forgot password?</button>
                )}

                <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
                {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}

                <button className="btn btn--primary auth-submit" disabled={busy} type="submit">
                  {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
                </button>
              </form>
              )}
            </>
          )}
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}

// Shown after someone opens the reset link from their email: they're signed in with a short-lived
// recovery session, and just need to choose a new password.
function ResetPasswordScreen({ onDone }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(pw);
    if (problem) { setError(problem); return; }
    if (pw !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (updateError) {
      setError(/same|different/i.test(updateError.message) ? "Choose a password you haven't used before." : /weak|pwned|character/i.test(updateError.message) ? updateError.message : "Couldn't update your password. The link may have expired — request a new one.");
      return;
    }
    onDone();
  };

  return (
    <div className="auth-screen">
      <div className="auth-form-wrap" style={{ width: "100%" }}>
        <div className="auth-form-card">
          <form onSubmit={submit} className="auth-form">
            <h2 className="auth-reset-title">Choose a new password</h2>
            <p className="auth-reset-sub">Pick a password you'll remember. You'll be logged in right after.</p>
            <label className="auth-field">
              <span>New password</span>
              <div className="auth-input-icon"><Lock size={14} /><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoFocus autoComplete="new-password" /></div>
            </label>
            <PasswordChecklist password={pw} />
            <label className="auth-field">
              <span>Confirm new password</span>
              <div className="auth-input-icon"><Lock size={14} /><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat the password" autoComplete="new-password" /></div>
            </label>
            {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}
            <button className="btn btn--primary auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Update password"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   NAV
   ============================================================================ */

function NavBar({ view, setView, isAdmin, setIsAdmin, mobileOpen, setMobileOpen, user, onLogout, previewLevel, setPreviewLevel, dayType, viewingToday, onGoToday, reminders, onOpenReminder, onOpenCalendar, onOpenPlan }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifWrapRef = useRef(null);
  const notifButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuPanelRef = useRef(null);
  const notifPanelId = useId();
  const menuPanelId = useId();
  useDismissable(notifOpen, () => setNotifOpen(false), [notifWrapRef], notifButtonRef);
  useDismissable(mobileOpen, () => setMobileOpen(false), [menuPanelRef, menuButtonRef], menuButtonRef);
  // "Today" always takes the goalie back to the present day. While they're looking at an earlier
  // game or rest day, "Game Day" / "Rest Day" takes them back to that day (e.g. from Progress).
  // On a game or rest day there's no drill, focus or off-ice to link to.
  const items = dayType
    ? [
        { key: "today", label: "Today", view: "today" },
        ...(viewingToday ? [] : [{ key: "day", label: dayType === "game" ? "Game Day" : "Rest Day", view: "today" }]),
        { key: "progress", label: "Progress", view: "progress" },
      ]
    : [
        { key: "today", label: "Today", view: "today" },
        { key: "drill", label: "Drill", view: "drill" },
        { key: "focus", label: "Focus", view: "focus" },
        { key: "office", label: "Off Ice", view: "office" },
        { key: "progress", label: "Progress", view: "progress" },
      ];
  // On an earlier game/rest day, the day's page belongs to "Game Day"/"Rest Day", not "Today".
  const isItemActive = (it) => !isAdmin && view === it.view && !(it.key === "today" && !viewingToday && dayType);
  return (
    <header className="nav">
      <div className="nav-inner">
        <button className="nav-logo" onClick={() => { setIsAdmin(false); onGoToday(); }}>
          <img src={LOGO_SRC} alt="10DTendy" className="brand-logo brand-logo--nav" />
        </button>

        <nav className="nav-links">
          {items.map((it) => (
            <button key={it.key} className={"nav-link" + (isItemActive(it) ? " nav-link--active" : "")}
              onClick={() => { setIsAdmin(false); if (it.key === "today") onGoToday(); else setView(it.view); }}>
              {it.label}
            </button>
          ))}
        </nav>

        <div className="nav-right">
          {user.role === "coach" && (
            <select
              className="nav-level-select" value={previewLevel} onChange={(e) => setPreviewLevel(e.target.value)}
              aria-label="Preview experience level"
            >
              {EXPERIENCE_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          )}
          {user.role === "coach" && (
            <button className={"nav-admin-toggle" + (isAdmin ? " nav-admin-toggle--active" : "")} onClick={() => setIsAdmin((v) => !v)}>
              {isAdmin ? "Exit admin" : "Admin"}
            </button>
          )}
          {user.role !== "coach" && (
            <button className="nav-icon-btn nav-calendar-btn" aria-label="Game days & rest days calendar" onClick={onOpenCalendar}>
              <CalendarIcon size={17} />
            </button>
          )}
          <div className="nav-notif-wrap" ref={notifWrapRef}>
            <button ref={notifButtonRef} className="nav-icon-btn" aria-label="Notifications" aria-expanded={notifOpen} aria-controls={notifOpen ? notifPanelId : undefined} onClick={() => setNotifOpen((v) => !v)}>
              <Bell size={17} />
              {reminders.length > 0 && <span className="nav-notif-dot" />}
            </button>
            {notifOpen && (
              <div className="nav-notif-panel" id={notifPanelId} role="region" aria-label="Reminders">
                <div className="nav-notif-panel-head">
                  <span>Reminders</span>
                  <button className="icon-btn" onClick={() => setNotifOpen(false)} aria-label="Close"><X size={14} /></button>
                </div>
                {reminders.length === 0 ? (
                  <p className="nav-notif-empty">No reminders right now.</p>
                ) : (
                  <ul className="nav-notif-list">
                    {reminders.map((r) => (
                      <li key={r.id}>
                        {r.action === "plan-month" ? (
                          <button className="nav-notif-item" onClick={() => { setNotifOpen(false); onOpenPlan(); }}>{r.text}</button>
                        ) : r.date ? (
                          <button className="nav-notif-item" onClick={() => { setNotifOpen(false); onOpenReminder(r.date); }}>{r.text}</button>
                        ) : r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button className={"nav-icon-btn nav-avatar" + (view === "profile" && !isAdmin ? " nav-avatar--active" : "")} aria-label="Profile" onClick={() => { setIsAdmin(false); setView("profile"); }}>
            {user.photoUrl ? <img src={user.photoUrl} alt="" className="nav-avatar-img" /> : initials(user.name)}
          </button>
          <button className="nav-icon-btn" aria-label="Log out" onClick={onLogout}><LogOut size={16} /></button>
          <button ref={menuButtonRef} className="nav-icon-btn nav-mobile-toggle" aria-label="Menu" aria-expanded={mobileOpen} aria-controls={mobileOpen ? menuPanelId : undefined} onClick={() => setMobileOpen((v) => !v)}>
            <span className="t-icon-swap" data-state={mobileOpen ? "b" : "a"}>
              <Menu size={19} className="t-icon" data-icon="a" />
              <X size={19} className="t-icon" data-icon="b" />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="nav-mobile-panel" id={menuPanelId} ref={menuPanelRef} aria-label="Menu">
          {items.map((it) => (
            <button key={it.key} className="nav-mobile-link"
              onClick={() => { setIsAdmin(false); if (it.key === "today") onGoToday(); else setView(it.view); setMobileOpen(false); }}>
              {it.label}
            </button>
          ))}
          <button className={"nav-mobile-link nav-mobile-profile" + (view === "profile" && !isAdmin ? " nav-mobile-link--active" : "")}
            onClick={() => { setIsAdmin(false); setView("profile"); setMobileOpen(false); }}>
            <span className="nav-mobile-avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : initials(user.name)}</span>
            Profile
          </button>
          {user.role === "coach" && (
            <div className="nav-mobile-level">
              <span>Preview level</span>
              <select value={previewLevel} onChange={(e) => setPreviewLevel(e.target.value)}>
                {EXPERIENCE_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            </div>
          )}
          {user.role === "coach" && (
            <button className="nav-mobile-link"
              onClick={() => { setIsAdmin((v) => !v); setMobileOpen(false); }}>
              {isAdmin ? "Exit admin" : "Admin"}
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

function BottomNav({ view, onToday, onGoTo, onProgress, onOpenCalendar, showCalendar, trainingDay }) {
  const items = [
    { key: "today", label: "Today", icon: Home, active: view === "today", onClick: onToday },
    ...(trainingDay ? [
      { key: "drill", label: "Drill of the day", icon: GoalieMask, active: view === "drill", onClick: () => onGoTo("drill") },
      { key: "focus", label: "Practice focus of the day", icon: HockeyNet, active: view === "focus", onClick: () => onGoTo("focus") },
      { key: "office", label: "Off-ice of the day", icon: CircleDot, active: view === "office", onClick: () => onGoTo("office") },
    ] : []),
    { key: "progress", label: "Progress", icon: BarChart3, active: view === "progress", onClick: onProgress },
    ...(showCalendar ? [{ key: "calendar", label: "Game days & rest days calendar", icon: CalendarIcon, active: false, onClick: onOpenCalendar }] : []),
  ];
  return (
    <nav className="bottom-nav no-print" aria-label="Quick navigation">
      {items.map(({ key, label, icon: Icon, active, onClick }) => (
        <button key={key} className={"bottom-nav-btn" + (active ? " bottom-nav-btn--active" : "")} onClick={onClick} aria-label={label} aria-current={active ? "page" : undefined}>
          <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
        </button>
      ))}
    </nav>
  );
}

/* ============================================================================
   TODAY PAGE
   ============================================================================ */

function TodayPage({ content, progress, viewDate, assignment, canGoBack, canGoForward, onPrevDay, onNextDay, openDrill, openFocus, openOffice, onDownloadPDF, dayTypes, onSetDayType, gameLogs, restNotes, onLogGame, onSetRestNote, onMakeRest }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const drill = assignment && content.drills.find((d) => d.id === assignment.drillId && d.published);
  const focus = assignment && content.focusPoints.find((f) => f.id === assignment.focusId && f.published);
  const office = assignment && content.offIceWorkouts.find((o) => o.id === assignment.workoutId && o.published);
  const drillImg = drill ? brandImage(drill.imageUrl, content.branding?.drill, DRILL_IMG) : null;
  const focusImg = focus ? brandImage(focus.imageUrl, content.branding?.focus, FOCUS_IMG) : null;
  const officeImg = office ? brandImage(office.imageUrl, content.branding?.office, OFFICE_IMG) : null;

  const completedCount = [progress.drill, progress.focus, progress.office].filter(Boolean).length;
  const allDone = completedCount === 3;
  const weekday = WEEKDAY_NAMES[viewDate.getDay()].toUpperCase();
  const dateStr = `${viewDate.getDate()} ${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const isToday = dateKey(viewDate) === dateKey(TODAY_DATE);
  const dayTitle = assignment?.title || (assignment ? trainingBlockName(assignment.block) : (isToday ? "Today's training." : "Past training."));
  const daySubtitle = assignment?.subtitle || (isToday ? "Three things to focus on today." : "What was assigned this day.");

  const eyebrowRow = (
    <div className="eyebrow-row">
      <button className="icon-btn" onClick={onPrevDay} disabled={!canGoBack} aria-label="Previous day"><ChevronLeft size={15} /></button>
      <div className="eyebrow">{weekday} · {dateStr}</div>
      {assignment?.blockDays > 1 && <span className="day-nav-badge">Day {assignment.dayInBlock} of {assignment.blockDays}</span>}
      {!isToday && <span className="day-nav-badge">Past</span>}
      <button className="icon-btn" onClick={onNextDay} disabled={!canGoForward} aria-label="Next day"><ChevronRight size={15} /></button>
    </div>
  );

  const calendarModal = calendarOpen && (
    <PreviewModal label="Games & Rest" onClose={() => setCalendarOpen(false)} resizeIn>
      <ProfileCalendar dayTypes={dayTypes || {}} onSetDayType={onSetDayType} onClose={() => setCalendarOpen(false)} gameLogs={gameLogs} restNotes={restNotes} onLogGame={onLogGame} onSetRestNote={onSetRestNote} />
    </PreviewModal>
  );

  if (!assignment || !drill || !focus || !office) {
    return (
      <div className="page">
        <div className="today-top">
          <section className="hero">
            <div className="hero-left">
              {eyebrowRow}
              <h1 className="hero-title">{dayTitle}</h1>
            </div>
          </section>
          <section className="ticket ticket--empty">
            <div className="ticket-right">
              <div className="ticket-calendar-group">
                <h4>Games &amp; Rest</h4>
                <button className="icon-btn eyebrow-calendar-btn" onClick={() => setCalendarOpen(true)} aria-label="Game days & rest days calendar"><CalendarIcon size={15} /></button>
              </div>
            </div>
          </section>
        </div>
        <div className="empty-state empty-state--hero">
          <p>{isToday ? "Your coach hasn't assigned today's training yet." : "No training block for this day — if you weren't in the app, your list waited for you."}</p>
        </div>
        {calendarModal}
      </div>
    );
  }

  return (
    <div className="page">
      {/* On desktop the title sits on the left and the training-day bar on the right. */}
      <div className="today-top">
      <section className="hero">
        <div className="hero-left">
          {eyebrowRow}
          <h1 className="hero-title">{dayTitle}</h1>
          <p className="hero-sub">{daySubtitle}</p>
        </div>
      </section>

      <section className="ticket">
        <div className="ticket-ring-wrap">
          <CreaseRing progress={completedCount / 3} size={64} />
          <div className="ring-label">
            <span className="ring-count">{completedCount}/3</span>
            <span className="ring-caption">{allDone ? "Complete" : "Done"}</span>
          </div>
        </div>
        <div className="ticket-left">
          <h4>Your training day</h4>
          <ul className="ticket-list">
            <li className={progress.drill ? "done" : ""}><Check size={14} /> Drill</li>
            <li className={progress.focus ? "done" : ""}><Check size={14} /> Practice Focus</li>
            <li className={progress.office ? "done" : ""}><Check size={14} /> Off-Ice</li>
          </ul>
        </div>
        <div className="ticket-divider" />
        <div className="ticket-right">
          <div className="ticket-calendar-group">
            <h4>Games &amp; Rest</h4>
            <button className="icon-btn eyebrow-calendar-btn" onClick={() => setCalendarOpen(true)} aria-label="Game days & rest days calendar"><CalendarIcon size={15} /></button>
          </div>
          {onMakeRest && <button className="btn btn--ghost btn--small ticket-rest-btn" onClick={onMakeRest}>Make today a rest day again</button>}
          <button className="btn btn--primary ticket-download-btn" onClick={onDownloadPDF}><Download size={15} /> <span>Download<span className="ticket-pdf-word"> Training</span> PDF</span></button>
        </div>
      </section>
      </div>

      {/* Left column: Practice Focus on top, a compact Drill of the Day below.
          Right column: the Off-Ice workout as the big feature card spanning both. */}
      <section className="bento">
        <button className="card card--focus" onClick={openFocus}>
          <img src={focusImg.src} style={focusImg.style} alt="" className="media-photo card-photo-bg" />
          <div className="card-photo-scrim" />
          <div className="card-top">
            <span className="label">PRACTICE FOCUS</span>
            {progress.focus && <span className="chip chip--done"><Check size={12} /> Done</span>}
          </div>
          <p className="focus-quote">"{focus.title}"</p>
          <div className="focus-glow" />
          <span className="card-cta card-cta--light">Read more →</span>
        </button>

        <button className="card card--drill card--compact" onClick={openDrill}>
          <div className="card-top">
            <span className="label">DRILL OF THE DAY</span>
            {progress.drill && <span className="chip chip--done"><Check size={12} /> Done</span>}
          </div>
          <div className="card-visual card-visual--compact">
            <img src={drillImg.src} style={drillImg.style} alt={drill.title} className="media-photo" />
          </div>
          <h3 className="card-title">{drill.title}</h3>
          {drill.description && <p className="card-desc">{drill.description}</p>}
          {(drill.duration || "").trim() && <div className="meta-row"><span>{drill.duration}</span></div>}
          <span className="card-cta">View Drill →</span>
        </button>

        <button className="card card--office card--feature" onClick={openOffice}>
          <img src={BADGE_LOGO_SRC} alt="" className="card-badge" />
          <div className="card-top">
            <span className="label">OFF-ICE</span>
            {progress.office && <span className="chip chip--done"><Check size={12} /> Done</span>}
          </div>
          <div className="card-visual card-visual--feature">
            <img src={officeImg.src} style={officeImg.style} alt={office.title} className="media-photo" />
          </div>
          <div className="card-body">
            <h3 className="card-title">{office.title}</h3>
            {office.description && <p className="card-desc">{office.description}</p>}
            {(office.duration || "").trim() && <div className="meta-row"><span>{office.duration}</span></div>}
            <span className="card-cta">View Workout →</span>
          </div>
        </button>
      </section>
      {calendarModal}
    </div>
  );
}

/* ============================================================================
   GAME DAY / REST DAY (goalie-marked override of the Today page)
   ============================================================================ */

// Rest day notes are short, calendar-sized notes (the database allows no more either).
const REST_NOTE_MAX = 60;
// Goals against average: goals against per full 60-minute game, so 2 goals in 30 minutes is a 4.00 GAA.
function gaa(goalsAgainst, minutes) {
  return minutes > 0 ? ((goalsAgainst * 60) / minutes).toFixed(2) : null;
}
function savePct(g) {
  return g && g.shots > 0 ? (((g.shots - g.goalsAgainst) / g.shots) * 100).toFixed(1) : null;
}

function MonthPlanPrompt({ monthName, current, onChoose, onOpenCalendar, onLater }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = async (mode) => {
    setBusy(true); setError("");
    const ok = await onChoose(mode);
    setBusy(false);
    if (ok === false) setError("Couldn't save that — check your connection and try again.");
  };
  return (
    <div className="page detail month-plan">
      <h1 className="detail-title">Plan {monthName}</h1>
      <p className="hero-sub">Add your game days and rest days for {monthName} so your training lines up with your schedule.</p>
      <button className="btn btn--ghost" onClick={onOpenCalendar}><CalendarIcon size={15} /> Add game days &amp; rest days</button>
      <h2 className="month-plan-q">How should your Sundays work?</h2>
      <button className={"month-plan-option" + (current === "sunday" ? " month-plan-option--active" : "")} onClick={() => choose("sunday")} disabled={busy}>
        <strong>Make Sunday an automatic rest day</strong>
        <span>Every Sunday is a rest day, unless you mark a game or rest day that week.</span>
      </button>
      <button className={"month-plan-option" + (current === "own" ? " month-plan-option--active" : "")} onClick={() => choose("own")} disabled={busy}>
        <strong>I'll add my own rest days</strong>
        <span>No automatic rest day. You choose your rest days in the calendar.</span>
      </button>
      {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}
      <button className="btn btn--ghost btn--small" onClick={onLater}>Decide later</button>
    </div>
  );
}

function DayTypePage({ type, data, viewDate, canGoBack, canGoForward, onPrevDay, onNextDay, onClear, gameLog, onSaveGameLog, restNote, onSaveRestNote, dayTypes, onSetDayType, gameLogs, restNotes, onLogGame, onSetRestNote, hideClear = false }) {
  const isGame = type === "game";
  const [logging, setLogging] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState("");
  const [gameLogError, setGameLogError] = useState("");
  const [notingRest, setNotingRest] = useState(false);
  const [restNoteDraft, setRestNoteDraft] = useState(restNote || "");
  const [restNoteBusy, setRestNoteBusy] = useState(false);
  const [restNoteError, setRestNoteError] = useState("");
  // DayTypePage stays mounted while navigating between days (viewDate just changes), so
  // the draft needs to re-sync to whatever note (if any) belongs to the newly viewed day.
  useEffect(() => {
    setRestNoteDraft(restNote || "");
    setNotingRest(false);
    setRestNoteError("");
  }, [restNote, viewDate]);

  const handleClear = async () => {
    setClearError("");
    setClearBusy(true);
    const ok = await onClear();
    setClearBusy(false);
    if (ok === false) setClearError("Couldn't save that — check your connection and try again.");
  };
  const handleSaveGameLog = async (log) => {
    setGameLogError("");
    const ok = await onSaveGameLog(log);
    if (ok === false) { setGameLogError("Couldn't save your game log — check your connection and try again."); return; }
    setLogging(false);
  };
  const handleSaveRestNote = async () => {
    setRestNoteError("");
    setRestNoteBusy(true);
    const ok = await onSaveRestNote(restNoteDraft.trim());
    setRestNoteBusy(false);
    if (ok === false) { setRestNoteError("Couldn't save that — check your connection and try again."); return; }
    setNotingRest(false);
  };
  const weekday = WEEKDAY_NAMES[viewDate.getDay()].toUpperCase();
  const dateStr = `${viewDate.getDate()} ${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <div className="page">
      <div className="daytype-banner">
        <img src={isGame ? GAME_DAY_BANNER_SRC : REST_DAY_BANNER_SRC} alt="" />
      </div>
      <section className="hero">
        <div className="hero-left">
          <div className="eyebrow-row">
            <button className="icon-btn" onClick={onPrevDay} disabled={!canGoBack} aria-label="Previous day"><ChevronLeft size={15} /></button>
            <div className="eyebrow daytype-eyebrow-stack">
              <span>{weekday}</span>
              <span className="daytype-eyebrow-sep"> · </span>
              <span>{dateStr}</span>
            </div>
            <span className="day-nav-badge">{isGame ? "Game day" : "Rest day"}</span>
            <button className="icon-btn" onClick={onNextDay} disabled={!canGoForward} aria-label="Next day"><ChevronRight size={15} /></button>
            <button className="icon-btn eyebrow-calendar-btn" onClick={() => setCalendarOpen(true)} aria-label="Game days & rest days calendar"><CalendarIcon size={15} /></button>
          </div>
          <h1 className="hero-title">{isGame ? "Game day." : "Rest day."}</h1>
          <p className="hero-sub">{isGame ? "No training today — lock in and get ready." : "No training today — recover and reset."}</p>
          {isGame && data.quote && <p className="daytype-quote">"{data.quote}"</p>}
        </div>
      </section>

      {calendarOpen && (
        <PreviewModal label="Games & Rest" onClose={() => setCalendarOpen(false)} resizeIn>
          <ProfileCalendar dayTypes={dayTypes || {}} onSetDayType={onSetDayType} onClose={() => setCalendarOpen(false)} gameLogs={gameLogs} restNotes={restNotes} onLogGame={onLogGame} onSetRestNote={onSetRestNote} />
        </PreviewModal>
      )}

      {/* The coach's live notes — shown on every game/rest day until they publish new ones. */}
      {data.note && (
        <div className="card daytype-card">
          <span className="label">NOTES FROM YOUR COACH</span>
          <div className="cue-highlight daytype-note">{data.note}</div>
        </div>
      )}

      {isGame && (
        <div className="card daytype-card">
          <span className="label">GAME LOG</span>
          {logging ? (
            <>
              {gameLogError && <div className="auth-error"><AlertTriangle size={13} /> {gameLogError}</div>}
              <GameStatsForm
                initial={gameLog}
                onSave={handleSaveGameLog}
                onCancel={() => { setGameLogError(""); setLogging(false); }}
              />
            </>
          ) : gameLog ? (
            <div className="gamelog-summary">
              <div className="gamelog-summary-row">
                <span className={"gamelog-result-badge gamelog-result-badge--" + gameLog.result}>{gameLog.result}</span>
                <span className="gamelog-opponent">{gameLog.homeAway === "home" ? "vs" : "@"} {gameLog.opponent}</span>
                {gameLog.goalsFor != null && <span className="gamelog-score">{gameLog.goalsFor}–{gameLog.goalsAgainst}</span>}
                {gameLog.dressedOnly && <span className="chip gamelog-dressed-chip">Dressed — didn't play</span>}
              </div>
              {!gameLog.dressedOnly && (
              <div className="profile-grid gamelog-stats-row">
                <div><span className="stat-label">Shots</span><span className="profile-value">{gameLog.shots}</span></div>
                <div><span className="stat-label">Goals Against</span><span className="profile-value">{gameLog.goalsAgainst}</span></div>
                <div><span className="stat-label">Save %</span><span className="profile-value">{savePct(gameLog) ?? "—"}%</span></div>
                <div><span className="stat-label">GAA</span><span className="profile-value">{gaa(gameLog.goalsAgainst, gameLog.minutesPlayed) ?? "—"}</span></div>
                <div><span className="stat-label">Minutes</span><span className="profile-value">{gameLog.minutesPlayed}</span></div>
              </div>
              )}
              {gameLog.periods && gameLog.periods.length > 0 && (
                <div className="gamelog-periods-summary">
                  {gameLog.periods.map((p, i) => (
                    <span key={i} className="gamelog-periods-summary-chip">{i < 3 ? `P${i + 1}` : "OT"} {p.shots - p.goalsAgainst}/{p.shots}</span>
                  ))}
                </div>
              )}
              <button className="btn btn--ghost btn--small" onClick={() => setLogging(true)}><Pencil size={13} /> Edit game log</button>
            </div>
          ) : (
            <>
              <p className="daytype-empty">Log your stats from this game to track your performance over time.</p>
              <button className="btn btn--primary btn--small" onClick={() => setLogging(true)}><Plus size={14} /> Log this game</button>
            </>
          )}
        </div>
      )}

      {!isGame && (
        <div className="card daytype-card">
          <span className="label">REST DAY NOTES</span>
          {notingRest ? (
            <>
              {restNoteError && <div className="auth-error"><AlertTriangle size={13} /> {restNoteError}</div>}
              <textarea
                className="restnote-textarea" rows={2} value={restNoteDraft} maxLength={REST_NOTE_MAX}
                onChange={(e) => setRestNoteDraft(e.target.value)}
                placeholder="e.g. Light skate and stretching"
                autoFocus
              />
              <p className="planner-hint restnote-hint"><span>Please don't include medical or injury details here.</span><span>{restNoteDraft.length}/{REST_NOTE_MAX}</span></p>
              <div className="admin-form-actions">
                <button className="btn btn--ghost btn--small" onClick={() => { setRestNoteDraft(restNote || ""); setRestNoteError(""); setNotingRest(false); }} disabled={restNoteBusy}>Cancel</button>
                <button className="btn btn--primary btn--small" onClick={handleSaveRestNote} disabled={restNoteBusy}>{restNoteBusy ? "Saving…" : "Save note"}</button>
              </div>
            </>
          ) : restNote ? (
            <div className="gamelog-summary">
              <p className="restnote-text">{restNote}</p>
              <button className="btn btn--ghost btn--small" onClick={() => setNotingRest(true)}><Pencil size={13} /> Edit note</button>
            </div>
          ) : (
            <>
              <p className="daytype-empty">Jot down a few words about what you did today — it'll show up on your calendar.</p>
              <button className="btn btn--primary btn--small" onClick={() => setNotingRest(true)}><Plus size={14} /> Add a note</button>
            </>
          )}
        </div>
      )}

      {clearError && <div className="auth-error"><AlertTriangle size={13} /> {clearError}</div>}
      {!hideClear && (
        <button className="btn btn--ghost daytype-clear" onClick={handleClear} disabled={clearBusy}>
          {clearBusy ? "Saving…" : `This isn't a ${isGame ? "game" : "rest"} day — show my training`}
        </button>
      )}
    </div>
  );
}

const BLANK_PERIOD = { shots: "", goalsAgainst: "" };
const RESULT_LETTER = { win: "W", loss: "L", tie: "T" };

function GameStatsForm({ initial, onSave, onCancel }) {
  // Dressed only: the goalie was in uniform but didn't play, so there are no stats to enter.
  const [dressedOnly, setDressedOnly] = useState(!!initial?.dressedOnly);
  const [opponent, setOpponent] = useState(initial?.opponent || "");
  const [homeAway, setHomeAway] = useState(initial?.homeAway || "home");
  const [result, setResult] = useState(initial?.result || "win");
  const [minutesPlayed, setMinutesPlayed] = useState(initial?.minutesPlayed ?? "");
  const [goalsFor, setGoalsFor] = useState(initial?.goalsFor ?? "");
  const hasInitialPeriods = !!(initial?.periods && initial.periods.length);
  const [periods, setPeriods] = useState(
    hasInitialPeriods
      ? initial.periods.map((p) => ({ shots: String(p.shots ?? ""), goalsAgainst: String(p.goalsAgainst ?? "") }))
      : [{ ...BLANK_PERIOD }, { ...BLANK_PERIOD }, { ...BLANK_PERIOD }]
  );
  const [error, setError] = useState("");

  const setPeriodField = (i, field, value) => {
    setPeriods((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };
  const addOvertime = () => setPeriods((prev) => [...prev, { ...BLANK_PERIOD }]);
  const removeOvertime = () => setPeriods((prev) => prev.slice(0, 3));
  const periodTotals = periods.reduce(
    (acc, p) => ({ shots: acc.shots + (Number(p.shots) || 0), goalsAgainst: acc.goalsAgainst + (Number(p.goalsAgainst) || 0) }),
    { shots: 0, goalsAgainst: 0 }
  );

  const submit = (e) => {
    e.preventDefault();
    if (!opponent.trim()) { setError("Enter the opponent."); return; }
    if (dressedOnly) {
      setError("");
      onSave({ dressedOnly: true, opponent: opponent.trim(), homeAway, result, shots: null, goalsAgainst: null, goalsFor: null, minutesPlayed: null, periods: [] });
      return;
    }
    const wholeInRange = (n) => Number.isInteger(n) && n >= 0 && n <= 999;
    const m = Number(minutesPlayed);
    if (!wholeInRange(m)) { setError("Minutes played must be a whole number from 0 to 999."); return; }
    const gf = Number(goalsFor);
    if (!wholeInRange(gf)) { setError("Goals scored must be a whole number from 0 to 999."); return; }

    const parsed = periods.map((p) => ({ shots: Number(p.shots), goalsAgainst: Number(p.goalsAgainst) }));
    if (!parsed.every((p) => wholeInRange(p.shots) && wholeInRange(p.goalsAgainst))) {
      setError("Every period needs shots and goals against as whole numbers from 0 to 999.");
      return;
    }
    if (parsed.some((p) => p.goalsAgainst > p.shots)) { setError("A period's goals against can't be more than its shots."); return; }
    setError("");
    onSave({ dressedOnly: false, opponent: opponent.trim(), homeAway, result, shots: periodTotals.shots, goalsAgainst: periodTotals.goalsAgainst, goalsFor: gf, minutesPlayed: m, periods: parsed });
  };

  return (
    <form className="gamelog-form" onSubmit={submit}>
      <label className="gamelog-dressed">
        <input type="checkbox" role="switch" checked={dressedOnly} onChange={(e) => { setDressedOnly(e.target.checked); setError(""); }} />
        <span className="gamelog-dressed-track" aria-hidden="true" />
        <span className="gamelog-dressed-text">
          <strong>I didn't play — dressed only</strong>
          <small>No shots, goals or minutes to log. It won't count toward your save % or record.</small>
        </span>
      </label>

      <div className={"gamelog-opponent-row" + (dressedOnly ? " gamelog-opponent-row--single" : "")}>
        <label className="auth-field">
          <span>Opponent</span>
          <input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="e.g. Ice Wolves" maxLength={100} />
        </label>
        {!dressedOnly && (
          <label className="auth-field">
            <span>Goals scored (your team)</span>
            <input type="number" min="0" inputMode="numeric" value={goalsFor} onChange={(e) => setGoalsFor(e.target.value)} />
          </label>
        )}
      </div>

      <div className="gamelog-toggle-row">
        <button type="button" className={"gamelog-toggle" + (homeAway === "home" ? " active" : "")} onClick={() => setHomeAway("home")}>Home</button>
        <button type="button" className={"gamelog-toggle" + (homeAway === "away" ? " active" : "")} onClick={() => setHomeAway("away")}>Away</button>
      </div>

      <div className="gamelog-toggle-row">
        <button type="button" className={"gamelog-toggle" + (result === "win" ? " active" : "")} onClick={() => setResult("win")}>Win</button>
        <button type="button" className={"gamelog-toggle" + (result === "loss" ? " active" : "")} onClick={() => setResult("loss")}>Loss</button>
        <button type="button" className={"gamelog-toggle" + (result === "tie" ? " active" : "")} onClick={() => setResult("tie")}>Tie</button>
      </div>

      {!dressedOnly && (<>
      <div className="gamelog-periods">
        <div className="gamelog-periods-head">
          <span>Shots &amp; goals against by period</span>
        </div>
        <div className="gamelog-periods-table">
          <div className="gamelog-periods-row gamelog-periods-row--head">
            <span></span><span>Shots</span><span>GA</span>
          </div>
          {periods.map((p, i) => (
            <div className="gamelog-periods-row" key={i}>
              <span className="gamelog-periods-label">{i < 3 ? `Period ${i + 1}` : "OT"}</span>
              <input type="number" min="0" value={p.shots} onChange={(e) => setPeriodField(i, "shots", e.target.value)} />
              <input type="number" min="0" value={p.goalsAgainst} onChange={(e) => setPeriodField(i, "goalsAgainst", e.target.value)} />
            </div>
          ))}
        </div>
        {periods.length > 3 ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={removeOvertime}>Remove OT</button>
        ) : (
          <button type="button" className="btn btn--ghost btn--small" onClick={addOvertime}>+ Add OT period</button>
        )}
        <p className="gamelog-periods-total">Total: {periodTotals.shots} shots, {periodTotals.goalsAgainst} goals against</p>
      </div>

      <div className="admin-form-grid">
        <label>Minutes played<input type="number" min="0" inputMode="numeric" value={minutesPlayed} onChange={(e) => setMinutesPlayed(e.target.value)} placeholder="60 for a full game" /></label>
      </div>
      </>)}

      {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}

      <div className="admin-form-actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--small">Save game</button>
      </div>
    </form>
  );
}

/* ============================================================================
   VIDEO PLAYER (simulated)
   ============================================================================ */

// Accepts youtube.com/watch?v=, youtu.be/, youtube.com/embed/, and youtube.com/shorts/ —
// with or without extra query params (playlist position, timestamp, share params) — and
// pulls out the 11-character video id, which is all any of those forms have in common.
function youtubeVideoId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// YouTube's iframe API is loaded once and shared by every video on the page.
let youtubeApiPromise = null;
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (previous) previous(); resolve(window.YT); };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => { youtubeApiPromise = null; reject(new Error("YouTube API failed to load")); };
      document.head.appendChild(tag);
    });
  }
  return youtubeApiPromise;
}

// A YouTube video that looks and behaves like part of this app rather than YouTube:
//  - it shows only the video's thumbnail with our own play button until it's tapped;
//  - the real player is driven through the iframe API with YouTube's controls switched off, and
//    it's never clickable itself (a transparent layer covers it and the iframe ignores the
//    mouse), so there's no way to open YouTube or its menus; right-click is blocked;
//  - the iframe is taller than the box it sits in (see .youtube-frame iframe): the video is
//    letterboxed into exactly the visible area, while YouTube's own title bar and logo land in
//    the cropped-off strips above and below — so the video can show the moment it starts;
//  - the hidden player is prepared as soon as the video scrolls into view, so the tap on the
//    thumbnail can start playback directly (browsers only allow that inside the tap itself);
//  - tapping the playing video pauses it (our play button over the paused frame); tapping again
//    continues from there. When it ends, it goes back to the thumbnail.
function YouTubeEmbed({ url, title, size }) {
  const id = youtubeVideoId(url);
  const allowed = !!useConsent()?.youtube;
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const creatingRef = useRef(false);
  const wantPlayRef = useRef(false);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused
  const [thumbTier, setThumbTier] = useState(0);
  const thumbs = ["maxresdefault", "mqdefault"];
  const small = size === "sm";

  const ensurePlayer = async () => {
    if (playerRef.current || creatingRef.current || !id) return;
    creatingRef.current = true;
    let YT;
    try { YT = await loadYouTubeApi(); } catch { creatingRef.current = false; return; }
    if (!hostRef.current || playerRef.current) { creatingRef.current = false; return; }
    const mount = document.createElement("div");
    hostRef.current.appendChild(mount);
    playerRef.current = new YT.Player(mount, {
      videoId: id,
      host: "https://www.youtube-nocookie.com",
      width: "100%", height: "100%",
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1,
        iv_load_policy: 3, cc_load_policy: 0, playsinline: 1, origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          readyRef.current = true;
          const frame = e.target.getIframe && e.target.getIframe();
          if (frame) { frame.title = title || "Video"; frame.setAttribute("tabindex", "-1"); }
          if (wantPlayRef.current) e.target.playVideo();
        },
        onStateChange: (e) => {
          const State = YT.PlayerState;
          if (e.data === State.PLAYING) {
            wantPlayRef.current = false;
            setStatus("playing");
          } else if (e.data === State.PAUSED) {
            setStatus((cur) => (cur === "idle" ? cur : "paused"));
          } else if (e.data === State.ENDED) {
            e.target.stopVideo();
            setStatus("idle");
          }
        },
        onError: () => { wantPlayRef.current = false; setStatus("idle"); },
      },
    });
    creatingRef.current = false;
  };

  useEffect(() => {
    if (!allowed) return;
    loadYouTubeApi().catch(() => {});
    setStatus("idle"); setThumbTier(0);
    readyRef.current = false; wantPlayRef.current = false;
    let observer;
    if (typeof IntersectionObserver !== "undefined" && stageRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { ensurePlayer(); observer.disconnect(); }
      }, { rootMargin: "200px" });
      observer.observe(stageRef.current);
    } else {
      ensurePlayer();
    }
    return () => {
      if (observer) observer.disconnect();
      if (playerRef.current && playerRef.current.destroy) { try { playerRef.current.destroy(); } catch { /* already gone */ } }
      playerRef.current = null; readyRef.current = false; creatingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allowed]);

  if (!id) return null;

  if (!allowed) {
    return (
      <div className={"youtube-stage youtube-blocked" + (small ? " youtube-blocked--sm" : "")}>
        <VideoIcon size={small ? 18 : 26} />
        {!small && <p>Accept cookies to watch this video.</p>}
        <button type="button" className="btn btn--primary btn--small" onClick={() => setConsent(true)}>Accept cookies</button>
        {!small && <button type="button" className="cookie-link" onClick={openCookiePolicy}>Cookie policy</button>}
      </div>
    );
  }

  // Both run synchronously inside the tap so the browser lets playback begin.
  const start = () => {
    setStatus("loading");
    if (playerRef.current && readyRef.current) { playerRef.current.playVideo(); return; }
    wantPlayRef.current = true;
    ensurePlayer();
  };
  const pause = () => {
    setStatus("paused");
    playerRef.current?.pauseVideo?.();
  };
  const resume = () => {
    setStatus("playing");
    playerRef.current?.playVideo?.();
  };

  const playIcon = (
    <span className={"youtube-play-btn" + (small ? " youtube-play-btn--sm" : "")}>
      <Play size={small ? 16 : 26} fill="var(--bg)" />
    </span>
  );
  const showVideo = status === "playing" || status === "paused";
  return (
    <div ref={stageRef} className="youtube-stage" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
      <div ref={hostRef} className={"youtube-frame" + (showVideo ? "" : " youtube-frame--hidden")} />
      {status === "playing" && (
        <button type="button" className="youtube-shield" onClick={pause} aria-label="Pause video" />
      )}
      {status === "paused" && (
        <button type="button" className="youtube-paused" onClick={resume} aria-label="Play video">{playIcon}</button>
      )}
      {!showVideo && (
        <button type="button" className="youtube-thumb" onClick={start} aria-label="Play video" disabled={status === "loading"}>
          <img
            src={`https://img.youtube.com/vi/${id}/${thumbs[thumbTier]}.jpg`} alt="" draggable={false} className="youtube-thumb-img"
            onLoad={(e) => { if (e.target.naturalWidth < 200 && thumbTier < thumbs.length - 1) setThumbTier(thumbTier + 1); }}
            onError={() => { if (thumbTier < thumbs.length - 1) setThumbTier(thumbTier + 1); }}
          />
          {status === "loading" ? <span className={"youtube-spinner" + (small ? " youtube-spinner--sm" : "")} /> : playIcon}
        </button>
      )}
    </div>
  );
}

function VideoPlayer({ title, poster, src }) {
  if (youtubeVideoId(src)) {
    return (
      <div className="video video--youtube">
        <YouTubeEmbed url={src} title={title} size="lg" />
      </div>
    );
  }
  if (src) {
    return (
      <div className="video">
        <video
          className="video-native" src={src} poster={poster || undefined} controls playsInline
          controlsList="nodownload noremoteplayback" onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }
  // No video: callers show the cover photo instead, so there is nothing to render here.
  return null;
}

/* ============================================================================
   DETAIL PAGES
   ============================================================================ */

// The written part of a drill (objective, steps, coaching points, common mistakes), shared by the
// drill's own page and by the drill cards inside a practice focus.
function DrillBody({ drill }) {
  // Empty sections are left out rather than shown as a heading with nothing under it.
  const sets = (drill.sets || "").trim();
  const reps = (drill.reps || "").trim();
  return (
    <>
        {richTextToPlain(drill.objective) && <section className="detail-block"><h2>Objective</h2><RichText value={drill.objective} /></section>}
        {drill.diagramUrl && <section className="detail-block"><img src={drill.diagramUrl} alt="Drill diagram" className="drill-diagram" /></section>}
        {drill.steps.length > 0 && (
        <section className="detail-block">
          <h2>How to perform</h2>
          <ol className="steps">{drill.steps.map((s, i) => <li key={i}><span className="step-num">{i + 1}</span><span>{s}</span></li>)}</ol>
        </section>
        )}
        {(sets || reps) && (
          <section className="detail-block drill-volume" aria-label="Sets and reps">
            {sets && <div className="drill-volume-tile"><span className="drill-volume-label">Sets</span><span className="drill-volume-value">{sets}</span></div>}
            {reps && <div className="drill-volume-tile"><span className="drill-volume-label">Reps</span><span className="drill-volume-value">{reps}</span></div>}
          </section>
        )}
        <PlanSection item={drill} heading="Drill Progression" />
        {drill.coachingPoints.length > 0 && (
        <section className="detail-block">
          <h2>Coaching points</h2>
          <div className="chip-grid">{drill.coachingPoints.map((c, i) => <div className="cue-card" key={i}>{c}</div>)}</div>
        </section>
        )}
        {drill.mistakes.length > 0 && (
        <section className="detail-block">
          <h2>Common mistakes</h2>
          <div className="mistake-list">
            {drill.mistakes.map((m, i) => (
              <div className="mistake-row" key={i}>
                <div className="mistake-col mistake-col--wrong"><span className="mistake-label">Mistake</span><p>{m.mistake}</p></div>
                <div className="mistake-col mistake-col--right"><span className="mistake-label">Correction</span><p>{m.correction}</p></div>
              </div>
            ))}
          </div>
        </section>
        )}
    </>
  );
}

// A drill attached to a practice focus: a card that expands to show the whole drill.
// After an exercise or drill card opens, scroll so its title sits at the top of the screen
// (just under the header) with its video right below.
function scrollOpenedIntoView(el) {
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
}
// Same, for an accordion row: opening one collapses the one that was open, which moves
// everything below it — so wait until the open/close animation has actually finished (its
// transitionend) before measuring. The timer only covers browsers that don't animate it at all.
function scrollOpenedAccordionIntoView(row) {
  const panel = row?.querySelector(".t-acc-panel");
  if (!panel || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { scrollOpenedIntoView(row); return; }
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    panel.removeEventListener("transitionend", onEnd);
    scrollOpenedIntoView(row);
  };
  const onEnd = (e) => { if (e.target === panel && e.propertyName === "grid-template-rows") go(); };
  panel.addEventListener("transitionend", onEnd);
  setTimeout(() => { if (!panel.getAnimations?.().length) go(); }, 450);
}

function FocusDrillCard({ drill, branding }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) scrollOpenedIntoView(cardRef.current);
  };
  const img = brandImage(drill.imageUrl, branding?.drill, DRILL_IMG);
  return (
    <section className="focus-drill-card" ref={cardRef}>
      <button type="button" className="focus-drill-head" onClick={toggle} aria-expanded={open}>
        <img src={img.src} style={img.style} alt="" className="focus-drill-thumb" />
        <span className="focus-drill-info">
          <span className="label">DRILL</span>
          <span className="focus-drill-title">{drill.title}</span>
          {(drill.duration || drill.equipment) && (
            <span className="meta-row">
              {drill.duration && <span>{drill.duration}</span>}
              {drill.duration && drill.equipment && <span className="dot">•</span>}
              {drill.equipment && <span>{drill.equipment}</span>}
            </span>
          )}
        </span>
        <ChevronDown size={18} className={"focus-drill-chevron" + (open ? " focus-drill-chevron--open" : "")} />
      </button>
      {open && (
        <div className="focus-drill-body">
          {drill.videoUrl && <VideoPlayer title={drill.title} poster={img.src} src={drill.videoUrl} />}
          <DrillBody drill={drill} />
        </div>
      )}
    </section>
  );
}

function DrillDetailPage({ drill, branding, onBack, complete, onComplete }) {
  const drillImg = brandImage(drill.imageUrl, branding?.drill, DRILL_IMG);
  return (
    <div className="page detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Today</button>
      {drill.videoUrl ? (
        <VideoPlayer title={drill.title} poster={drillImg.src} src={drill.videoUrl} />
      ) : (
        <div className="detail-banner">
          <img src={drillImg.src} style={drillImg.style} alt="" className="media-photo" />
          <div className="detail-banner-scrim" />
        </div>
      )}
      <div className="detail-header">
        <h1 className="detail-title">{drill.title}</h1>
        <MetaRow items={[drill.duration, drill.equipment]} />
      </div>
      <DrillBody drill={drill} />
      <button className={"btn btn--complete" + (complete ? " btn--complete-done" : "")} onClick={onComplete}>
        {complete ? <><Check size={16} /> Drill complete</> : "Mark drill complete"}
      </button>
    </div>
  );
}

function FocusDetailPage({ focus, branding, drills = [], level, onBack, complete, onComplete }) {
  const focusImg = brandImage(focus.imageUrl, branding?.focus, FOCUS_IMG);
  return (
    <div className="page detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Today</button>
      {focus.videoUrl ? (
        <VideoPlayer title={focus.title} poster={focusImg.src} src={focus.videoUrl} />
      ) : (
        <div className="detail-banner">
          <img src={focusImg.src} style={focusImg.style} alt="" className="media-photo" />
          <div className="detail-banner-scrim" />
        </div>
      )}
      <section className="focus-hero">
        <span className="label">PRACTICE FOCUS</span>
        <h1 className="focus-hero-title">{focus.title}</h1>
        <div className="focus-hero-glow" />
      </section>
      {(focus.cue || "").trim() && <section className="detail-block"><h2>Today's cue</h2><div className="cue-highlight">{focus.cue}</div></section>}
      {richTextToPlain(focus.explanation) && <section className="detail-block"><h2>Execution</h2><RichText value={focus.explanation} /></section>}
      {(focus.blocks || []).map((b) => (
        b.type === "image" ? (b.imageUrl && <img key={b.id} src={b.imageUrl} alt="" className="focus-block-image" />)
        : b.type === "video" ? (b.videoUrl && <VideoPlayer key={b.id} title={focus.title} src={b.videoUrl} />)
        : b.type === "drill" ? (() => { const d = drills.find((x) => x.id === b.drillId && x.published); return d ? <FocusDrillCard key={b.id} drill={planForLevel(d, level)} branding={branding} /> : null; })()
        : (b.body && <section key={b.id} className="detail-block">{b.heading && <h2>{b.heading}</h2>}<RichText value={b.body} /></section>)
      ))}
      <button className={"btn btn--complete" + (complete ? " btn--complete-done" : "")} onClick={onComplete}>
        {complete ? <><Check size={16} /> Practice focus complete</> : "Mark practice focus complete"}
      </button>
    </div>
  );
}

// A Workout / Drill Progression as goalies follow it: tables of rows with set descriptions between them.
function PlanSection({ item, heading }) {
  const segments = workoutPlanSegments(item);
  const columns = workoutPlanColumns(item);
  if (!segments.length) return null;
  return (
    <section className="detail-block">
      <h2>{heading}</h2>
      {segments.map((seg) => (seg.note ? (
        <div key={seg.note.id} className="plan-note">
          {(seg.note.intensity || "").trim() && (
            <div className="plan-note-intensity"><span>Intensity</span>{seg.note.intensity.trim()}</div>
          )}
          {planNoteHasText(seg.note) && <RichText value={seg.note.text} />}
        </div>
      ) : (
        <div className="plan-table-wrap" key={seg.rows[0].id}>
          <table className="plan-table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {seg.rows.map((r) => (
                <tr key={r.id}>{columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )))}
    </section>
  );
}
// The same for the printed sheet.
function PrintPlan({ item, heading }) {
  const segments = workoutPlanSegments(item);
  const columns = workoutPlanColumns(item);
  if (!segments.length) return null;
  return (
    <>
      <PrintHeading>{heading}</PrintHeading>
      {segments.map((seg) => (seg.note ? (
        <div className="print-plan-note" key={seg.note.id}>
          {(seg.note.intensity || "").trim() && <span className="print-intensity">{seg.note.intensity.trim()}</span>}
          {planNoteHasText(seg.note) && <RichText className="print-rich" value={seg.note.text} />}
        </div>
      ) : (
        <table className="print-plan-table" key={seg.rows[0].id}>
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {seg.rows.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>)}
          </tbody>
        </table>
      )))}
    </>
  );
}

function OffIceDetailPage({ office, branding, onBack, complete, onComplete }) {
  const [open, setOpen] = useState(null);
  const exerciseRefs = useRef({});
  const toggleExercise = (i) => {
    const next = open === i ? null : i;
    setOpen(next);
    if (next !== null) scrollOpenedAccordionIntoView(exerciseRefs.current[i]);
  };
  const officeImg = brandImage(office.imageUrl, branding?.office, OFFICE_IMG);
  return (
    <div className="page detail">
      <button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Today</button>
      {office.videoUrl ? (
        <VideoPlayer title={office.title} poster={officeImg.src} src={office.videoUrl} />
      ) : (
        <div className="detail-banner">
          <img src={officeImg.src} style={officeImg.style} alt="" className="media-photo" />
          <div className="detail-banner-scrim" />
        </div>
      )}
      <div className="detail-header">
        <span className="label">OFF-ICE</span>
        <h1 className="detail-title">{office.title}</h1>
        <MetaRow items={[office.duration, office.equipment]} />
      </div>
      {office.objective && <section className="detail-block"><h2>Objective</h2><RichText value={office.objective} /></section>}
      {office.exercises?.length > 0 && (
      <section className="detail-block">
        <h2>Exercises</h2>
        <div className="exercise-list">
          {office.exercises.map((ex, i) => (
            <div className="exercise-row t-acc" data-open={open === i ? "true" : "false"} key={ex.id || ex.name + i} ref={(el) => { exerciseRefs.current[i] = el; }}>
              <button className="exercise-head t-acc-head" aria-expanded={open === i} onClick={() => toggleExercise(i)}>
                <div className="exercise-thumb">
                  <CircleDot size={16} />
                </div>
                <div className="exercise-info"><span className="exercise-name">{ex.name}</span>{exerciseSummary(ex) && <span className="exercise-sets">{exerciseSummary(ex)}</span>}</div>
                <span className="t-acc-chevron exercise-chevron">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5L8 10.5L12 6.5" /></svg>
                </span>
              </button>
              <div className="t-acc-panel">
                <div className="t-acc-panel-inner">
                  <div className="exercise-expanded">
                    {ex.videoUrl && (
                      <div className="exercise-media">
                        {youtubeVideoId(ex.videoUrl) ? (
                          <div className="exercise-media-youtube">
                            <YouTubeEmbed url={ex.videoUrl} title={ex.name} size="sm" />
                          </div>
                        ) : (
                          <video src={ex.videoUrl} className="exercise-media-video" controls playsInline />
                        )}
                      </div>
                    )}
                    {ex.imageUrl && (
                      <div className="exercise-media">
                        <img src={ex.imageUrl} alt="" className="exercise-media-img" />
                      </div>
                    )}
                    {ex.instructions && <RichText value={ex.instructions} className="exercise-instructions" />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
      <PlanSection item={office} heading="Workout" />
      <button className={"btn btn--complete" + (complete ? " btn--complete-done" : "")} onClick={onComplete}>
        {complete ? <><Check size={16} /> Workout complete</> : "Mark workout complete"}
      </button>
    </div>
  );
}

/* ============================================================================
   PROFILE PAGE
   ============================================================================ */

function ProfilePage({ user, onLogout, onChangePassword, onUpdateProfile, onDeleteAccount }) {
  const isCoach = user.role === "coach";
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const confirmDelete = async () => {
    setDeleting(true); setDeleteError("");
    const res = await onDeleteAccount();
    if (!res.ok) { setDeleting(false); setDeleteError("Couldn't delete your account — check your connection and try again."); }
  };
  const planKey = dateKey(TODAY_DATE).slice(0, 7);
  const currentPlan = (user.monthPlans || {})[planKey] || "sunday";
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [experience, setExperience] = useState(EXPERIENCE_LEVELS.includes(user.experience) ? user.experience : "Junior");
  const [country, setCountry] = useState(user.country || "");
  const [league, setLeague] = useState(user.league || "");
  const [team, setTeam] = useState(user.team || "");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

  const removePhoto = async () => {
    setPhotoError("");
    const oldPath = storagePathFromUrl(user.photoUrl);
    const ok = await onUpdateProfile({ photoAssetId: null, photoUrl: "" });
    if (!ok) setPhotoError("Something went wrong. Please try again.");
    else if (oldPath?.startsWith(`profile/${user.id}/`)) deleteStorageObject(oldPath);
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSaving(true);
    const ok = await onUpdateProfile({ experience, country: country.trim(), league: league.trim(), team: team.trim() });
    setProfileSaving(false);
    if (ok) setEditingProfile(false);
    else setProfileError("Something went wrong. Please try again.");
  };

  const resetPasswordForm = () => {
    setChangingPassword(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwError(""); setPwSuccess(false);
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPwError(""); setPwSuccess(false);
    const pwProblem = passwordProblem(newPw);
    if (pwProblem) { setPwError(pwProblem); return; }
    if (newPw !== confirmPw) { setPwError("New passwords don't match."); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setPwError(CAPTCHA_WAIT_MESSAGE); return; }
    setSaving(true);
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email, password: currentPw, options: { captchaToken: captchaToken || undefined },
    });
    setCaptchaReset((n) => n + 1);
    if (reauthError) {
      setSaving(false);
      setPwError(isCaptchaError(reauthError.message) ? "The security check didn't go through. Please try again." : "Current password is incorrect.");
      return;
    }
    const ok = await onChangePassword(newPw);
    setSaving(false);
    if (ok) {
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setChangingPassword(false), 1200);
    } else {
      setPwError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="page detail">
      <section className="profile-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {user.photoUrl ? <img src={user.photoUrl} alt="" /> : initials(user.name)}
          </div>
        </div>
        {photoError && <div className="auth-error"><AlertTriangle size={13} /> {photoError}</div>}
        {!isCoach && user.photoUrl && (
          <button type="button" className="btn btn--ghost btn--small profile-avatar-remove" onClick={removePhoto}>Remove photo</button>
        )}
        <h1 className="detail-title">{user.name}</h1>
        <p className="profile-email">{user.email}</p>
        <div className="profile-grid">
          <div><span className="stat-label">Position</span><span className="profile-value">{user.position || "Goalie"}</span></div>
          {!isCoach && <div><span className="stat-label">Experience</span><span className="profile-value">{user.experience || "—"}</span></div>}
          <div><span className="stat-label">Role</span><span className="profile-value">{user.role === "coach" ? "Coach / Admin" : "Goalie"}</span></div>
          {!isCoach && <div><span className="stat-label">Country</span><span className="profile-value">{user.country || "—"}</span></div>}
          {!isCoach && <div><span className="stat-label">League</span><span className="profile-value">{user.league || "—"}</span></div>}
          {!isCoach && <div><span className="stat-label">Team</span><span className="profile-value">{user.team || "—"}</span></div>}
        </div>

        {!isCoach && (
          <div className="month-plan-row">
            <span className="stat-label">Sundays in {MONTH_NAMES[TODAY_DATE.getMonth()]}</span>
            <div className="month-plan-toggle">
              <button className={currentPlan === "sunday" ? "active" : ""} onClick={() => onUpdateProfile({ monthPlans: { ...(user.monthPlans || {}), [planKey]: "sunday" } })}>Automatic rest day</button>
              <button className={currentPlan === "own" ? "active" : ""} onClick={() => onUpdateProfile({ monthPlans: { ...(user.monthPlans || {}), [planKey]: "own" } })}>My own rest days</button>
            </div>
          </div>
        )}

        {!isCoach && (
          !editingProfile ? (
            <button className="btn btn--ghost" onClick={() => { setExperience(EXPERIENCE_LEVELS.includes(user.experience) ? user.experience : "Junior"); setEditingProfile(true); }}><Pencil size={14} /> Edit profile</button>
          ) : (
            <form className="profile-password-form" onSubmit={submitProfile}>
              <label className="auth-field">
                <span>Experience</span>
                <select value={experience} onChange={(e) => setExperience(e.target.value)}>
                  {EXPERIENCE_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                </select>
              </label>
              <p className="planner-hint" style={{ marginTop: -4 }}>Changing your experience switches you to that level's training right away.</p>
              <label className="auth-field"><span>Country</span><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Canada" maxLength={100} /></label>
              <label className="auth-field"><span>League</span><input value={league} onChange={(e) => setLeague(e.target.value)} placeholder="e.g. OHL" maxLength={100} /></label>
              <label className="auth-field"><span>Team</span><input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. London Knights" maxLength={100} /></label>
              {profileError && <div className="auth-error"><AlertTriangle size={13} /> {profileError}</div>}
              <div className="admin-form-actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingProfile(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary btn--small" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button>
              </div>
            </form>
          )
        )}

        {!changingPassword ? (
          <button className="btn btn--ghost" onClick={() => setChangingPassword(true)}><Lock size={14} /> Change password</button>
        ) : (
          <form className="profile-password-form" onSubmit={submitPasswordChange}>
            <label className="auth-field">
              <span>Current password</span>
              <div className="auth-input-icon"><Lock size={14} /><input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
            </label>
            <label className="auth-field">
              <span>New password</span>
              <div className="auth-input-icon"><Lock size={14} /><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
            </label>
              <PasswordChecklist password={newPw} />
            <label className="auth-field">
              <span>Confirm new password</span>
              <div className="auth-input-icon"><Lock size={14} /><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></div>
            </label>
            <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
            {pwError && <div className="auth-error"><AlertTriangle size={13} /> {pwError}</div>}
            {pwSuccess && <div className="profile-password-success"><Check size={13} /> Password updated.</div>}
            <div className="admin-form-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={resetPasswordForm}>Cancel</button>
              <button type="submit" className="btn btn--primary btn--small" disabled={saving}>{saving ? "Saving…" : "Save password"}</button>
            </div>
          </form>
        )}

        <button className="btn btn--ghost" onClick={onLogout}><LogOut size={14} /> Log out</button>

        {!isCoach && (!confirmingDelete ? (
          <button type="button" className="profile-delete-link" onClick={() => setConfirmingDelete(true)}>Delete my account</button>
        ) : (
          <div className="profile-delete-confirm">
            <p><strong>Delete your account permanently?</strong> Your profile, calendar, game stats and notes will be erased right away. This can't be undone.</p>
            {deleteError && <div className="auth-error"><AlertTriangle size={13} /> {deleteError}</div>}
            <div className="admin-form-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={() => { setConfirmingDelete(false); setDeleteError(""); }} disabled={deleting}>Cancel</button>
              <button type="button" className="btn btn--primary btn--small" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete permanently"}</button>
            </div>
          </div>
        ))}

        <LegalLinks />
      </section>
    </div>
  );
}

const MonthPlanContext = React.createContext(null);

function ProfileCalendar({ dayTypes, onSetDayType, onClose, gameLogs, restNotes, onLogGame, onSetRestNote }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(dateKey(TODAY_DATE));
  // Mirrors the dayTypes prop, but updates the instant a goalie taps Game/Rest/Clear —
  // the cell's color shouldn't wait on the round-trip that actually persists it.
  const [localDayTypes, setLocalDayTypes] = useState(dayTypes || {});
  useEffect(() => { setLocalDayTypes(dayTypes || {}); }, [dayTypes]);

  const base = new Date(TODAY_DATE.getFullYear(), TODAY_DATE.getMonth() + monthOffset, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const plan = useContext(MonthPlanContext);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const chosenPlan = plan?.monthPlans?.[monthKey];
  // A current or upcoming month with no answer yet asks how Sundays should work; until then its
  // Sundays aren't shown as rest days. Past months just follow the default.
  const needsAsk = !!plan?.isGoalie && monthOffset >= 0 && !chosenPlan;
  const calUser = { dayTypes: localDayTypes, monthPlans: plan?.monthPlans || {} };
  const typeFor = (key) => {
    const t = localDayTypes[key];
    if (t === "game" || t === "rest") return t;
    if (needsAsk && key.startsWith(monthKey)) return null;
    return isAutoRest(calUser, key) ? "rest" : null;
  };
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const choosePlan = async (mode) => {
    setPlanBusy(true); setPlanError("");
    const ok = await plan.setPlan(monthKey, mode);
    setPlanBusy(false);
    if (ok === false) setPlanError("Couldn't save that — check your connection and try again.");
  };
  const selectedType = typeFor(selected);
  const selectedGameLog = (gameLogs || {})[selected];

  const [saveError, setSaveError] = useState("");
  const chooseType = async (type) => {
    setLocalDayTypes((prev) => ({ ...prev, [selected]: type || "none" }));
    setSaveError("");
    setLoggingGame(false);
    setNotingRest(false);
    const ok = await onSetDayType(selected, type);
    if (ok === false) setSaveError("Couldn't save that — check your connection and try again.");
  };

  // Logging a game for whatever date is selected here — not just the last couple of
  // days reachable via the Today page's back arrow — is what makes it possible to
  // enter stats for an older game at all.
  const [loggingGame, setLoggingGame] = useState(false);
  const [gameLogError, setGameLogError] = useState("");
  // Rest day notes can be added or edited here too, for any rest day in the calendar.
  const [notingRest, setNotingRest] = useState(false);
  const [restNoteDraft, setRestNoteDraft] = useState("");
  const [restNoteBusy, setRestNoteBusy] = useState(false);
  const [restNoteError, setRestNoteError] = useState("");
  const selectedRestNote = (restNotes || {})[selected] || "";
  const startRestNote = () => { setRestNoteDraft(selectedRestNote); setRestNoteError(""); setNotingRest(true); };
  const handleSaveRestNote = async () => {
    setRestNoteError("");
    setRestNoteBusy(true);
    const ok = await onSetRestNote(selected, restNoteDraft.trim());
    setRestNoteBusy(false);
    if (ok === false) { setRestNoteError("Couldn't save that — check your connection and try again."); return; }
    setNotingRest(false);
  };
  const selectDate = (key) => { setSelected(key); setLoggingGame(false); setGameLogError(""); setNotingRest(false); setRestNoteError(""); };
  const handleSaveGameLog = async (log) => {
    setGameLogError("");
    const ok = await onLogGame(selected, log);
    if (ok === false) { setGameLogError("Couldn't save your game log — check your connection and try again."); return; }
    setLoggingGame(false);
  };

  return (
    <div className="calendar-admin profile-calendar">
      <h3 className="profile-calendar-title">Games & Rest</h3>
      <p className="planner-hint">Mark your game and rest days for this month.</p>
      <div className="calendar-admin-nav">
        <button className="icon-btn" onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeft size={16} /></button>
        <span>{MONTH_NAMES[month]} {year}</span>
        <button className="icon-btn" onClick={() => setMonthOffset((m) => m + 1)}><ChevronRight size={16} /></button>
      </div>
      {needsAsk && (
        <div className="month-plan-inline">
          <strong>How should Sundays work in {MONTH_NAMES[month]}?</strong>
          <button className="month-plan-option" onClick={() => choosePlan("sunday")} disabled={planBusy}>
            <strong>Set Sundays as default rest days</strong>
            <span>Every Sunday turns into a rest day.</span>
          </button>
          <button className="month-plan-option" onClick={() => choosePlan("own")} disabled={planBusy}>
            <strong>I'll select my own rest days</strong>
            <span>You mark the rest days yourself.</span>
          </button>
          {planError && <div className="auth-error"><AlertTriangle size={13} /> {planError}</div>}
        </div>
      )}
      <div className="calendar-admin-grid calendar-admin-grid--rich">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="calendar-admin-dow">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = dateKey(new Date(year, month, day));
          const t = typeFor(key);
          const log = t === "game" ? (gameLogs || {})[key] : null;
          const note = t === "rest" ? (restNotes || {})[key] : null;
          return (
            <button
              key={i}
              className={"calendar-admin-cell" + (key === selected ? " selected" : "") + (t === "game" ? " daytype-cell--game" : "") + (t === "rest" ? " daytype-cell--rest" : "")}
              onClick={() => selectDate(key)}
            >
              <span className="calendar-cell-day">{day}</span>
              {log && <span className="calendar-cell-caption calendar-cell-caption--game">{log.dressedOnly ? `${RESULT_LETTER[log.result]} · Dressed` : `${RESULT_LETTER[log.result]} ${log.goalsFor ?? "?"}–${log.goalsAgainst}`}</span>}
              {note && <span className="calendar-cell-caption calendar-cell-caption--rest">{note}</span>}
            </button>
          );
        })}
      </div>
      <div className="profile-calendar-actions">
        <span className="profile-calendar-selected">
          {selected}
          {selectedType && <span className="chip"> {selectedType === "game" ? "Game day" : "Rest day"}</span>}
        </span>
        <div className="profile-calendar-buttons">
          <button className={"btn btn--small" + (selectedType === "game" ? " btn--primary" : " btn--ghost")} onClick={() => chooseType("game")}>Game day</button>
          <button className={"btn btn--small" + (selectedType === "rest" ? " btn--primary" : " btn--ghost")} onClick={() => chooseType("rest")}>Rest day</button>
          <button className="btn btn--ghost btn--small" onClick={() => chooseType(null)} disabled={!selectedType}>Clear</button>
        </div>
      </div>
      {saveError && <div className="auth-error"><AlertTriangle size={13} /> {saveError}</div>}
      {/* Only reachable way to enter stats for a game older than the Today page's own
          couple-day back window — this calendar can select any date in any month. */}
      {selectedType === "game" && !loggingGame && (
        <button className="btn btn--ghost btn--small profile-calendar-log-btn" onClick={() => setLoggingGame(true)}>
          <Pencil size={13} /> {selectedGameLog ? "Edit game log" : "Log this game"}
        </button>
      )}
      {loggingGame && (
        <div className="profile-calendar-gamelog">
          {gameLogError && <div className="auth-error"><AlertTriangle size={13} /> {gameLogError}</div>}
          <GameStatsForm initial={selectedGameLog} onSave={handleSaveGameLog} onCancel={() => { setGameLogError(""); setLoggingGame(false); }} />
        </div>
      )}
      {selectedType === "rest" && onSetRestNote && !notingRest && (
        <div className="profile-calendar-restnote">
          {selectedRestNote && <p className="restnote-text">{selectedRestNote}</p>}
          <button className="btn btn--ghost btn--small profile-calendar-log-btn" onClick={startRestNote}>
            {selectedRestNote ? <><Pencil size={13} /> Edit note</> : <><Plus size={13} /> Add a note</>}
          </button>
        </div>
      )}
      {notingRest && (
        <div className="profile-calendar-gamelog">
          {restNoteError && <div className="auth-error"><AlertTriangle size={13} /> {restNoteError}</div>}
          <textarea
            className="restnote-textarea" rows={2} value={restNoteDraft} maxLength={REST_NOTE_MAX}
            onChange={(e) => setRestNoteDraft(e.target.value)}
            placeholder="e.g. Light skate and stretching"
            aria-label="Rest day note" autoFocus
          />
          <p className="planner-hint restnote-hint"><span>Please don't include medical or injury details here.</span><span>{restNoteDraft.length}/{REST_NOTE_MAX}</span></p>
          <div className="admin-form-actions">
            <button className="btn btn--ghost btn--small" onClick={() => { setRestNoteError(""); setNotingRest(false); }} disabled={restNoteBusy}>Cancel</button>
            <button className="btn btn--primary btn--small" onClick={handleSaveRestNote} disabled={restNoteBusy}>{restNoteBusy ? "Saving…" : "Save note"}</button>
          </div>
        </div>
      )}
      <div className="profile-calendar-footer">
        <button className="btn btn--primary" onClick={onClose}><Check size={15} /> Save &amp; Close</button>
      </div>
    </div>
  );
}

/* ============================================================================
   PROGRESS PAGE
   ============================================================================ */

// Days in a row with the whole day's training ticked off, counting back from today. Game and
// rest days don't break the streak (or add to it), and today doesn't break it while it's
// still unfinished.
function trainingStreak(u, joinedKey) {
  let streak = 0;
  for (let i = 0; i < 1000; i++) {
    const key = dateKey(addDays(TODAY_DATE, -i));
    if (key < joinedKey) break;
    if (doneCount(u.dayProgress?.[key]) === 3) streak++;
    else if (!resolveDayType(u, key) && i > 0) break;
  }
  return streak;
}

// Save % (its own natural 0-100 scale) and goals against (scaled 0-to-its-own-max)
// share one canvas so the two trends are visible together — each line reads against
// its own range rather than a common unit, which is why the numeric averages sit
// above the chart rather than a second axis.
function SavePctLineChart({ games }) {
  const width = 640, height = 200, padding = 32;
  if (games.length === 0) return <p className="chart-empty">Log a game to see your save % and goals against trend.</p>;
  const xFor = (i) => (games.length === 1 ? width / 2 : padding + (i / (games.length - 1)) * (width - padding * 2));
  const savePoints = games.map((g, i) => {
    const pct = Number(savePct(g)) || 0;
    return { x: xFor(i), y: height - padding - (pct / 100) * (height - padding * 2), pct };
  });
  const maxGA = Math.max(1, ...games.map((g) => g.goalsAgainst));
  const gaPoints = games.map((g, i) => ({
    x: xFor(i), y: height - padding - (g.goalsAgainst / maxGA) * (height - padding * 2), ga: g.goalsAgainst,
  }));
  const pathFor = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // "Sep 4" rather than the raw "2026-09-04" — compact enough to sit under each point
  // without the dates running into each other on a chart with more than a few games.
  const dateLabel = (dateStr) => {
    const [, m, d] = dateStr.split("-").map(Number);
    return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
  };
  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((v) => {
          const y = height - padding - (v / 100) * (height - padding * 2);
          return <line key={v} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-gridline" />;
        })}
        <path d={pathFor(gaPoints)} className="chart-line chart-line--ga" fill="none" />
        {gaPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" className="chart-dot chart-dot--ga" />)}
        <path d={pathFor(savePoints)} className="chart-line" fill="none" />
        {savePoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" className="chart-dot" />)}
        {games.map((g, i) => (
          <text key={g.date} x={xFor(i)} y={height - 8} textAnchor="middle" className="chart-axis-label">{dateLabel(g.date)}</text>
        ))}
      </svg>
      <div className="chart-legend">
        <span><i className="chart-legend-swatch chart-legend-swatch--save" /> Save %</span>
        <span><i className="chart-legend-swatch chart-legend-swatch--ga" /> Goals against</span>
      </div>
    </>
  );
}

function SaveRing({ pct, size = 80, strokeWidth = 9 }) {
  const r = 42, c = 2 * Math.PI * r;
  const color = pct >= 90 ? "#4cd7a3" : "var(--accent)";
  return (
    <div className="save-ring-visual" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="save-ring-label"><span className="save-ring-pct">{pct.toFixed(0)}%</span></div>
    </div>
  );
}

function PeriodSaveRings({ periodStats }) {
  const entries = periodStats
    .map((p, i) => ({ label: i < 3 ? `P${i + 1}` : "OT", shots: p ? p.shots : 0, goalsAgainst: p ? p.goalsAgainst : 0 }))
    .filter((e) => e.shots > 0);
  if (entries.length === 0) return <p className="chart-empty">Log a game with period-by-period stats to see this.</p>;

  return (
    <div className="period-rings-row">
      {entries.map((e, i) => {
        const pct = e.shots > 0 ? ((e.shots - e.goalsAgainst) / e.shots) * 100 : 0;
        return (
          <div className="period-ring" key={i}>
            <SaveRing pct={pct} />
            <span className="period-ring-name">{e.label}</span>
            <span className="period-ring-shots">{e.shots} shots</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressPage({ user }) {
  const isCoach = user.role === "coach";
  const [clients, setClients] = useState(null);
  const [clientEmail, setClientEmail] = useState(null);

  useEffect(() => {
    if (!isCoach) return;
    getUsersMap().then((all) => {
      const goalieClients = Object.values(all || {}).filter((u) => u.role !== "coach");
      // A coach's own account can mark game/rest days and log games too (nothing stops
      // it) — include it in the switcher so that data isn't otherwise unreachable. Default
      // to the coach's own account when it actually has something to show (so a coach who
      // just logged their own game sees it immediately) — otherwise default to the first
      // real goalie client, since an empty personal page would be a confusing landing spot.
      const hasOwnData = (user.dayTypes && Object.keys(user.dayTypes).length > 0) || (user.gameLogs && Object.keys(user.gameLogs).length > 0);
      setClients([user, ...goalieClients]);
      setClientEmail((prev) => prev || (hasOwnData ? user.email : (goalieClients[0] && goalieClients[0].email)) || user.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach]);

  const activeUser = isCoach ? (clients || []).find((c) => c.email === clientEmail) : user;

  // Each day: game/rest as marked (resolved the same way the Today page does), otherwise how much
  // of that day's training was ticked off. Days away from the app simply show as no training —
  // the calendar keeps running even while their block list waits for them.
  // Unknown join date (a legacy record with no createdAt) counts as "joined today".
  const joinedKey = dateKey(activeUser?.createdAt ? new Date(activeUser.createdAt) : TODAY_DATE);
  const cells = Array.from({ length: 35 }, (_, i) => {
    const dateStr = dateKey(addDays(TODAY_DATE, -(34 - i)));
    if (dateStr < joinedKey) return "none";
    const dayType = activeUser ? resolveDayType(activeUser, dateStr) : null;
    if (dayType === "game") return "game";
    if (dayType === "rest") return "rest";
    const done = doneCount(activeUser?.dayProgress?.[dateStr]);
    return done === 3 ? "full" : done > 0 ? "partial" : "none";
  });
  const streak = activeUser ? trainingStreak(activeUser, joinedKey) : 0;

  const games = Object.entries(activeUser?.gameLogs || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, g]) => ({ date, ...g }));
  // Tallies for the 4 boxes next to the heatmap — counted straight from `cells`/`games`
  // so they always agree with what's drawn in the last-5-weeks grid beside them.
  const trainingDaysCount = cells.filter((c) => c === "full").length;
  const partialDaysCount = cells.filter((c) => c === "partial").length;
  const restDaysCount = cells.filter((c) => c === "rest").length;
  const fiveWeeksAgoKey = dateKey(addDays(TODAY_DATE, -34));
  const gamesLoggedCount = games.filter((g) => g.date >= fiveWeeksAgoKey).length;
  // Games they only dressed for are listed but left out of the record, save % and goals against.
  const played = games.filter((g) => !g.dressedOnly);
  const wins = played.filter((g) => g.result === "win").length;
  const losses = played.filter((g) => g.result === "loss").length;
  const ties = played.filter((g) => g.result === "tie").length;
  const totalShots = played.reduce((sum, g) => sum + g.shots, 0);
  const totalGA = played.reduce((sum, g) => sum + g.goalsAgainst, 0);
  const avgSavePct = totalShots > 0 ? (((totalShots - totalGA) / totalShots) * 100).toFixed(1) : "—";
  const totalMinutes = played.reduce((sum, g) => sum + (g.minutesPlayed || 0), 0);
  const avgGA = gaa(totalGA, totalMinutes) ?? "—";
  const periodStats = [];
  played.forEach((g) => {
    (g.periods || []).forEach((p, i) => {
      if (!periodStats[i]) periodStats[i] = { shots: 0, goalsAgainst: 0 };
      periodStats[i].shots += p.shots;
      periodStats[i].goalsAgainst += p.goalsAgainst;
    });
  });

  const clientSwitcher = isCoach && (
    <div className="progress-client-switcher">
      <span className="progress-client-label">Viewing</span>
      {clients === null ? (
        <span className="progress-client-loading">Loading clients…</span>
      ) : (
        <select value={clientEmail || ""} onChange={(e) => setClientEmail(e.target.value)}>
          {clients.map((c) => <option key={c.email} value={c.email}>{c.email === user.email ? `${c.name} (you)` : c.name}</option>)}
        </select>
      )}
    </div>
  );

  if (isCoach && clients !== null && !activeUser) {
    return (
      <div className="page">
        {clientSwitcher}
        <div className="empty-state"><p>No goalie accounts have signed up yet.</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      {clientSwitcher}
      <section className="hero hero--progress">
        <div className="hero-left">
          <div className="eyebrow">PROGRESS</div>
          <h1 className="hero-title">{streak} day streak.</h1>
          <p className="hero-sub">{streak > 0 ? "You're building consistency." : "Finish a full day of training to start your streak."}</p>
        </div>
      </section>
      <section className="calendar-block progress-overview-row">
        <div className="progress-heat-col">
          <h2>Last 5 weeks</h2>
          <div className="heat-grid">{cells.map((c, i) => <div key={i} className={"heat-cell heat-cell--" + c} />)}</div>
          <div className="heat-legend">
            <span><i className="heat-cell heat-cell--none" /> No training</span>
            <span><i className="heat-cell heat-cell--partial" /> Partial</span>
            <span><i className="heat-cell heat-cell--full" /> Complete</span>
            <span><i className="heat-cell heat-cell--game" /> Game day</span>
            <span><i className="heat-cell heat-cell--rest" /> Rest day</span>
          </div>
        </div>
        <div className="stats-grid progress-stats-col">
          <div className="stat-card"><span className="stat-num">{trainingDaysCount}</span><span className="stat-label">Complete days</span></div>
          <div className="stat-card"><span className="stat-num">{restDaysCount}</span><span className="stat-label">Rest days</span></div>
          <div className="stat-card"><span className="stat-num">{gamesLoggedCount}</span><span className="stat-label">Games logged</span></div>
          <div className="stat-card"><span className="stat-num">{partialDaysCount}</span><span className="stat-label">Partially complete days</span></div>
        </div>
      </section>

      <section className="calendar-block gameperf-block">
        <h2>Game performance</h2>

        <div className="gameperf-charts-row">
          <div className="gameperf-chart">
            <h3 className="gameperf-chart-title">Record</h3>
            <div className="gameperf-summary-row">
              <div className="gameperf-record"><span className="stat-num">{wins}-{losses}-{ties}</span><span className="stat-label">W-L-T</span></div>
              {played.length > 0 && (
                <>
                  <SaveRing pct={Number(avgSavePct)} size={64} strokeWidth={7} />
                  <div className="gameperf-summary-gaa">
                    <span className="gameperf-summary-gaa-num">{avgGA}</span>
                    <span className="gameperf-summary-gaa-label">GAA</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="gameperf-chart">
            <h3 className="gameperf-chart-title">Save % &amp; goals against by game</h3>
            <SavePctLineChart games={played} />
          </div>
          <div className="gameperf-chart">
            <h3 className="gameperf-chart-title">Save % by period</h3>
            <PeriodSaveRings periodStats={periodStats} />
          </div>
        </div>

        {games.length > 0 && (
          <div className="gameperf-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Shots</th><th>GA</th><th>Save %</th><th>GAA</th><th>Min</th></tr></thead>
              <tbody>
                {[...games].reverse().map((g) => (
                  <tr key={g.date}>
                    <td>{g.date}</td>
                    <td>{g.homeAway === "home" ? "vs" : "@"} {g.opponent}</td>
                    <td><span className={"gamelog-result-badge gamelog-result-badge--" + g.result}>{g.result}</span></td>
                    {g.dressedOnly ? (
                      <td colSpan={5} className="gameperf-dressed">Dressed — didn't play</td>
                    ) : (<>
                      <td>{g.shots}</td>
                      <td>{g.goalsAgainst}</td>
                      <td>{savePct(g) ?? "—"}%</td>
                      <td>{gaa(g.goalsAgainst, g.minutesPlayed) ?? "—"}</td>
                      <td>{g.minutesPlayed}</td>
                    </>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================================
   ADMIN — DASHBOARD
   ============================================================================ */

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;
// Blocks left for the goalie furthest along a level: under this many (about a week) turns red.
const BLOCKS_LEFT_WARNING = 3;

// Where each goalie of a level is in its list today, and how far ahead the furthest one is.
// Only ready blocks count (drafts are skipped); block numbers are their place in the full list.
function levelScheduleStatus(content, level, goalies) {
  const all = content.trainingDays?.[level] || [];
  const list = readyBlocks(content, level);
  const total = list.length;
  const today = dateKey(TODAY_DATE);
  const walks = goalies.filter((g) => g.experience === level).map((g) => walkTrainingBlocks(g, today, list) || { reached: 0, repeating: false });
  const furthest = walks.length ? Math.max(...walks.map((w) => w.reached)) : 0;
  return {
    total, goalieCount: walks.length, furthest,
    furthestBlock: furthest > 0 ? all.indexOf(list[furthest - 1]) + 1 : 0,
    drafts: all.length - total,
    left: total - furthest,
    repeating: walks.filter((w) => w.repeating).length,
  };
}

// Supabase Free plan limits; update these if the project is upgraded.
const DB_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

function formatBytes(n) {
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
  return Math.max(1, Math.round(n / 1024)) + " KB";
}

function UsageBar({ label, used, limit, note }) {
  const pct = Math.min(100, (used / limit) * 100);
  const tone = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";
  return (
    <div className="usage-row">
      <div className="usage-row-head">
        <span className="usage-label">{label}</span>
        <span className="usage-figures">{formatBytes(used)} of {formatBytes(limit)} used · <strong>{formatBytes(Math.max(0, limit - used))} left</strong></span>
      </div>
      <div className="usage-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={"usage-fill usage-fill--" + tone} style={{ width: Math.max(pct, 1) + "%" }} />
      </div>
      {note && <span className="usage-note">{note}</span>}
    </div>
  );
}

function AdminDashboard({ content }) {
  const [usage, setUsage] = useState(undefined);
  useEffect(() => { getUsage().then(setUsage); }, []);
  const [users, setUsers] = useState(null);
  // Full accounts (with their calendars and visits) so the schedule panel can work out where each goalie is.
  useEffect(() => { getUsersMap().then((u) => setUsers(u || {})); }, []);

  const goalies = users ? Object.values(users).filter((u) => u.role !== "coach") : [];
  const activeGoalies = goalies.filter((u) => !u.removed);
  const weeksLeft = (left) => (left < BLOCKS_LEFT_WARNING ? "less than a week" : `about ${Math.floor(left / 3)} week${Math.floor(left / 3) === 1 ? "" : "s"}`);
  const onlineCount = goalies.filter((u) => u.lastActive && Date.now() - u.lastActive < ONLINE_THRESHOLD_MS).length;

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Dashboard</h1>
      <div className="stats-grid stats-grid--admin">
        <div className="stat-card"><span className="stat-num">{users === null ? "—" : onlineCount}</span><span className="stat-label">{users === null ? "Goalies online" : `Goalies online (of ${goalies.length})`}</span></div>
        <div className="stat-card"><span className="stat-num">{content.drills.length}</span><span className="stat-label">Total drills</span></div>
        <div className="stat-card"><span className="stat-num">{content.focusPoints.length}</span><span className="stat-label">Practice Focus</span></div>
        <div className="stat-card"><span className="stat-num">{content.offIceWorkouts.length}</span><span className="stat-label">Off-ice workouts</span></div>
      </div>

      <div className="admin-panel">
        <h3>Storage</h3>
        {usage === undefined ? (
          <p className="planner-hint">Checking usage…</p>
        ) : usage === null ? (
          <p className="planner-hint">Couldn't load usage right now.</p>
        ) : (
          <>
            <UsageBar label="Database" used={usage.dbBytes} limit={DB_LIMIT_BYTES} />
            <UsageBar label="Photos & files" used={usage.storageBytes} limit={STORAGE_LIMIT_BYTES} note={`${usage.storageFiles} file${usage.storageFiles === 1 ? "" : "s"} uploaded`} />
            <p className="planner-hint">Limits shown are for the Supabase Free plan (500 MB database, 1 GB files). Videos are hosted on YouTube, so they don't use this space.</p>
          </>
        )}
      </div>

      <div className="admin-panel">
        <h3>Training schedule health</h3>
        <p className="planner-hint">Goalies use about 3 training blocks a week. Each level shows how far the goalie furthest along its list has got, and how many blocks are left after theirs. Red means less than a week is left ({BLOCKS_LEFT_WARNING} blocks), so add more before they run out.</p>
        <div className="dashboard-health-grid">
          {EXPERIENCE_LEVELS.map((lv) => {
            const st = users === null ? null : levelScheduleStatus(content, lv, activeGoalies);
            const healthy = st && st.left >= BLOCKS_LEFT_WARNING;
            let line = "Checking goalies…", sub = "";
            if (st && st.goalieCount === 0) {
              line = `No goalies yet · ${st.total} block${st.total === 1 ? "" : "s"} ready`;
              sub = st.left >= BLOCKS_LEFT_WARNING ? "" : "New goalies need at least a week of blocks.";
            } else if (st && st.furthest === 0) {
              line = `${st.goalieCount} goalie${st.goalieCount === 1 ? "" : "s"}, none started yet · ${st.total} block${st.total === 1 ? "" : "s"} ready`;
            } else if (st) {
              line = st.repeating > 0 ? `Furthest goalie has had all ${st.total} ready block${st.total === 1 ? "" : "s"}` : `Furthest goalie is on Block ${st.furthestBlock}`;
              sub = st.repeating > 0 ? `${st.repeating} goalie${st.repeating === 1 ? " is" : "s are"} repeating from Block 1 — add more blocks.`
                : st.left === 0 ? "They're on the last block — add more now."
                : `${st.left} ready block${st.left === 1 ? "" : "s"} left after theirs, ${weeksLeft(st.left)}.`;
            }
            const draftNote = st?.drafts > 0 ? `${st.drafts} draft block${st.drafts === 1 ? "" : "s"} (missing a part or using a draft) skipped until complete.` : "";
            return (
              <div className="dashboard-health-card" key={lv}>
                <div className="dashboard-health-head">
                  <span className={"dashboard-health-dot" + (!st ? "" : healthy ? " dashboard-health-dot--ok" : " dashboard-health-dot--warn")} />
                  <span>{lv}</span>
                </div>
                <span className="dashboard-health-days">{line}</span>
                {sub && <span className="dashboard-health-sub">{sub}</span>}
                {draftNote && <span className="dashboard-health-sub">{draftNote}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-panel">
        <h3>What new signups see first — Day 1</h3>
        {EXPERIENCE_LEVELS.map((lv) => {
          const assignment = readyBlocks(content, lv)[0];
          const drill = assignment && content.drills.find((d) => d.id === assignment.drillId);
          const focus = assignment && content.focusPoints.find((f) => f.id === assignment.focusId);
          const office = assignment && content.offIceWorkouts.find((o) => o.id === assignment.workoutId);
          return (
            <div className="dashboard-level-block" key={lv}>
              <div className="dashboard-level-title">{lv}</div>
              <div className="assign-row"><span className="assign-label">Drill</span><span>{drill ? drill.title : "Not assigned"}{drill && !drill.published && <span className="chip" style={{ marginLeft: 6 }}>Draft — hidden from goalies</span>}</span></div>
              <div className="assign-row"><span className="assign-label">Focus</span><span>{focus ? focus.title : "Not assigned"}{focus && !focus.published && <span className="chip" style={{ marginLeft: 6 }}>Draft — hidden from goalies</span>}</span></div>
              <div className="assign-row"><span className="assign-label">Off-ice</span><span>{office ? office.title : "Not assigned"}{office && !office.published && <span className="chip" style={{ marginLeft: 6 }}>Draft — hidden from goalies</span>}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   ADMIN — DRILLS
   ============================================================================ */

const BLANK_DRILL = {
  title: "", category: "", duration: "", equipment: "",
  description: "", objective: "", stepsText: "", sets: "", reps: "", coachingPointsText: "", mistakesText: "", planRows: [], levelPlans: {}, published: false,
  imageAssetId: null, imageUrl: "", videoAssetId: null, videoUrl: "", diagramUrl: "",
};

function parseLines(text) { return text.split("\n").map((s) => s.trim()).filter(Boolean); }

// How many training days (across all levels) currently point at this id — surfaced in
// the delete confirmation so a coach knows deleting will leave those days with a gap,
// rather than finding out only when a goalie sees "not assigned yet" with no explanation.
function countDailyAssignmentUses(content, field, id) {
  let count = 0;
  for (const lvl of EXPERIENCE_LEVELS) {
    for (const day of content.trainingDays?.[lvl] || []) {
      if (day[field] === id) count++;
    }
  }
  return count;
}

// Shared photo upload wiring for any admin draft with imageAssetId/imageUrl fields. Video
// isn't uploaded — see YouTubeField — but setVideoUrl still lives here so every draft's
// video field is touched through one place.
function useDiagramUpload(setDraft) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const res = await uploadToStorage(await compressImageFile(file));
      setDraft((d) => ({ ...d, diagramUrl: res.url }));
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };
  return {
    uploading, error, inputRef, onPick,
    pickFromLibrary: (file) => setDraft((d) => ({ ...d, diagramUrl: file.url })),
    remove: () => setDraft((d) => ({ ...d, diagramUrl: "" })), clearError: () => setError(""),
  };
}

function useMediaFields(setDraft) {
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const imageInputRef = useRef(null);

  const uploadImage = async (file) => {
    setMediaError("");
    setUploading(true);
    try {
      const res = await uploadToStorage(await compressImageFile(file));
      setDraft((d) => ({ ...d, imageAssetId: res.id, imageUrl: res.url }));
    } catch (err) {
      setMediaError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading, mediaError, imageInputRef,
    onPickImage: (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadImage(f); },
    pickFromLibrary: (file) => setDraft((d) => ({ ...d, imageAssetId: file.path, imageUrl: file.url })),
    removeImage: () => setDraft((d) => ({ ...d, imageAssetId: null, imageUrl: "" })),
    setVideoUrl: (url) => setDraft((d) => ({ ...d, videoAssetId: null, videoUrl: url })),
    clearError: () => setMediaError(""),
  };
}

// A paste-a-link field for video, instead of uploading a file — YouTube hosts and streams
// the video, so there's nothing to store in the assets capability at all, just the URL.
function YouTubeField({ value, onChange, label = "Video", className = "admin-form-span2 media-field" }) {
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");
  const hasVideo = !!youtubeVideoId(value);

  // Commits whatever's typed the moment it parses as a real YouTube link — a paste
  // fires this on its own via onChange, so the video is already saved into the draft
  // before the coach's next click (e.g. the form's own Save button) even happens.
  // Add/Enter/blur are just explicit ways to trigger the same check, mainly so a bad
  // link shows its error instead of silently doing nothing.
  const commit = (text) => {
    const id = youtubeVideoId(text);
    if (!id) return false;
    setError("");
    setDraftUrl("");
    onChange(`https://www.youtube.com/watch?v=${id}`);
    return true;
  };
  const handleChange = (e) => {
    const text = e.target.value;
    setDraftUrl(text);
    setError("");
    commit(text);
  };
  const confirm = () => {
    if (!draftUrl.trim()) return;
    if (!commit(draftUrl)) setError("That doesn't look like a YouTube link.");
  };

  return (
    <div className={className}>
      <span className="media-field-label">{label}</span>
      {hasVideo ? (
        <div className="media-field-preview">
          <div className="youtube-embed-sm">
            <YouTubeEmbed url={value} title={label} size="sm" />
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange("")}>Remove</button>
        </div>
      ) : (
        <div className="youtube-input-row">
          <input
            value={draftUrl}
            onChange={handleChange}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
            onBlur={confirm}
            placeholder="Paste a YouTube link…"
          />
          <button type="button" className="btn btn--ghost btn--small" onClick={confirm}>Add</button>
        </div>
      )}
      {error && <div className="auth-error" style={{ marginTop: 8 }}><AlertTriangle size={13} /> {error}</div>}
    </div>
  );
}

function MediaFields({ draft, media, imageLabel = "Photo" }) {
  return (
    <>
      <div className="admin-form-span2 media-field">
        <span className="media-field-label">{imageLabel}</span>
        {draft.imageUrl ? (
          <div className="media-field-preview">
            <img src={draft.imageUrl} alt="" className="media-thumb media-thumb--lg" />
            <button type="button" className="btn btn--ghost btn--small" onClick={media.removeImage}>Remove</button>
          </div>
        ) : (
          <div className="upload-or-library">
            <UploadDropzone small getInput={() => media.imageInputRef.current} disabled={media.uploading}>
              <UploadCloud size={18} />
              <span>{media.uploading ? "Uploading…" : `Click or drop a ${imageLabel === "Photo" ? "photo" : imageLabel.toLowerCase()} here`}</span>
            </UploadDropzone>
            <LibraryPickButton onPick={media.pickFromLibrary} disabled={media.uploading} />
          </div>
        )}
        <input ref={media.imageInputRef} type="file" accept="image/*" onChange={media.onPickImage} style={{ display: "none" }} />
      </div>

      <YouTubeField value={draft.videoUrl} onChange={media.setVideoUrl} />

      {media.mediaError && <div className="auth-error admin-form-span2"><AlertTriangle size={13} /> {media.mediaError}</div>}
    </>
  );
}

function PreviewModal({ label, onClose, children, resizeIn, panelClassName = "" }) {
  const panelRef = useRef(null);
  const labelId = useId();
  useDialogBehavior(panelRef, onClose);
  const [size, setSize] = useState(null);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    if (!resizeIn) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(true);
      return;
    }
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ w: rect.width, h: rect.height });
  }, [resizeIn]);

  useEffect(() => {
    if (!resizeIn || !size) return;
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [resizeIn, size]);

  const resizeStyle = !resizeIn || settled
    ? undefined
    : size
      ? { width: open ? size.w : 44, height: open ? size.h : 44, overflow: "hidden" }
      : { visibility: "hidden" };

  return (
    <div className="content-preview-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className={"content-preview-panel" + (resizeIn ? " t-resize" : "") + (panelClassName ? " " + panelClassName : "")}
        style={resizeStyle}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={() => resizeIn && open && setSettled(true)}
        {...dialogProps(labelId)}
      >
        <div className="content-preview-header">
          <span className="content-preview-label" id={labelId}>{label}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview"><X size={16} /></button>
        </div>
        <div className="main">{children}</div>
      </div>
    </div>
  );
}

function WelcomeModal({ data, ...rest }) {
  return data ? <WelcomeDialog data={data} {...rest} /> : null;
}
function WelcomeDialog({ label, data, onClose }) {
  const panelRef = useRef(null);
  const labelId = useId();
  useDialogBehavior(panelRef, onClose);
  const paragraphs = (data.body || "").split("\n").filter(Boolean);
  return (
    <div className="content-preview-overlay no-print" onClick={onClose}>
      <div ref={panelRef} className="content-preview-panel welcome-panel" onClick={(e) => e.stopPropagation()} {...dialogProps(labelId)}>
        <div className="content-preview-header">
          <span className="content-preview-label" id={labelId}>{label}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="main welcome-modal-body">
          <h2 className="welcome-title">{data.title}</h2>
          {data.videoUrl && <VideoPlayer title={data.title} src={data.videoUrl} />}
          {paragraphs.map((p, i) => <p className="welcome-text" key={i}>{p}</p>)}
          <button className="btn btn--primary welcome-cta" onClick={onClose}>Got it, let's go</button>
        </div>
      </div>
    </div>
  );
}

function AdminDrills({ content, updateContent }) {
  const [planLevel, setPlanLevel] = useState("Youth");
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK_DRILL);
  const [previewDrill, setPreviewDrill] = useState(null);
  const media = useMediaFields(setDraft);
  const diagram = useDiagramUpload(setDraft);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const filteredDrills = content.drills.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || d.title.toLowerCase().includes(q) || (d.category || "").toLowerCase().includes(q);
    const matchesCategory = !filterCategory || d.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const toDraft = (d) => ({
    ...d,
    stepsText: (d.steps || []).join("\n"),
    coachingPointsText: (d.coachingPoints || []).join("\n"),
    mistakesText: (d.mistakes || []).map((m) => `${m.mistake} | ${m.correction}`).join("\n"),
    planRows: normalizePlanItems(d.planRows),
    levelPlans: Object.fromEntries(Object.entries(d.levelPlans || {}).map(([lv, list]) => [lv, normalizePlanItems(list)])),
  });

  const buildDrill = (d) => ({
    title: d.title, category: d.category, duration: d.duration,
    equipment: d.equipment, description: d.description, objective: d.objective,
    steps: parseLines(d.stepsText),
    sets: (d.sets || "").trim(),
    reps: (d.reps || "").trim(),
    planRows: cleanPlanItems(d.planRows),
    levelPlans: Object.fromEntries(Object.entries(d.levelPlans || {}).map(([lv, list]) => [lv, cleanPlanItems(list)])),
    coachingPoints: parseLines(d.coachingPointsText),
    mistakes: parseLines(d.mistakesText).map((line) => {
      const [mistake, correction] = line.split("|").map((s) => (s || "").trim());
      return { mistake: mistake || line, correction: correction || "" };
    }),
    published: d.published,
    imageAssetId: d.imageAssetId || null,
    imageUrl: d.imageUrl || "",
    videoAssetId: d.videoAssetId || null,
    videoUrl: d.videoUrl || "",
    diagramUrl: d.diagramUrl || "",
  });

  const startEdit = (d) => { setEditingId(d.id); setDraft(toDraft(d)); setCreating(false); media.clearError(); };
  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(BLANK_DRILL); media.clearError(); };
  const cancel = () => { setCreating(false); setEditingId(null); setDraft(BLANK_DRILL); media.clearError(); };

  const commit = (built) => {
    if (creating) {
      updateContent((c) => ({ ...c, drills: [...c.drills, { ...built, id: crypto.randomUUID() }] }));
    } else {
      updateContent((c) => ({ ...c, drills: c.drills.map((d) => (d.id === editingId ? { ...built, id: editingId } : d)) }));
    }
    cancel();
  };

  const save = () => {
    if (!draft.title.trim()) return;
    commit(buildDrill(draft));
  };

  // Drafts skip the title requirement and force published:false, so a half-finished
  // drill can be saved and resumed later without losing what's typed so far.
  const saveDraft = () => {
    const built = buildDrill({ ...draft, title: draft.title.trim() || "Untitled draft" });
    commit({ ...built, published: false });
  };

  const remove = async (id) => {
    const dayUses = countDailyAssignmentUses(content, "drillId", id);
    const focusUses = content.focusPoints.reduce((n, f) => n + (f.blocks || []).filter((b) => b.type === "drill" && b.drillId === id).length, 0);
    const where = [
      dayUses > 0 && `${dayUses} training block${dayUses === 1 ? "" : "s"}`,
      focusUses > 0 && `${focusUses} practice focus${focusUses === 1 ? "" : "es"}`,
    ].filter(Boolean).join(" and ");
    const msg = where
      ? `This drill is used in ${where} — deleting it will remove it from there.`
      : "This can't be undone.";
    if (!(await confirmDialog({ title: "Delete this drill?", message: msg, confirmLabel: "Delete", danger: true }))) return;
    updateContent((c) => ({ ...c, drills: c.drills.filter((d) => d.id !== id) }));
  };
  const togglePublish = (id) => updateContent((c) => ({ ...c, drills: c.drills.map((d) => (d.id === id ? { ...d, published: !d.published } : d)) }));

  // Duplicating opens the new copy straight into edit mode so it's easy to rename/adjust.
  const duplicate = (d) => {
    const copy = { ...d, id: crypto.randomUUID(), title: `${d.title} (Copy)` };
    updateContent((c) => ({ ...c, drills: [...c.drills, copy] }));
    setCreating(false);
    setEditingId(copy.id);
    setDraft(toDraft(copy));
    media.clearError();
  };

  const previewDraft = () => {
    if (!draft.title.trim()) return;
    setPreviewDrill(planForLevel({ ...buildDrill(draft), id: editingId || "preview" }, planLevel));
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h1 className="admin-h1">Drills</h1>
        <button className="btn btn--primary btn--small" onClick={startCreate}><Plus size={14} /> New drill</button>
      </div>

      {(creating || editingId) && (
        <div className="admin-form" key={editingId || "new"}>
          <h3>{creating ? "Create drill" : "Edit drill"}</h3>
          <div className="admin-form-grid">
            <label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Drill title" /></label>
            <label>Category
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="">No category</option>
                {categoriesOfType(content, "drill").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label>Duration<input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="e.g. 12 min" /></label>
            <label>Equipment<input value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} placeholder="e.g. Full gear" /></label>
            <label className="admin-form-span2">Short description (Main Page)<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="One line for the card" /></label>
            <div className="admin-form-span2 rich-field-wrap"><span className="rich-field-label">Objective</span><RichTextEditor rows={2} value={draft.objective} onChange={(v) => setDraft({ ...draft, objective: v })} placeholder="What this drill improves" /></div>
            <div className="admin-form-span2 media-field">
              <span className="media-field-label">Drill diagram (shown under the objective)</span>
              {draft.diagramUrl ? (
                <div className="media-field-preview">
                  <img src={draft.diagramUrl} alt="" className="media-thumb media-thumb--lg" />
                  <button type="button" className="btn btn--ghost btn--small" onClick={diagram.remove}>Remove</button>
                </div>
              ) : (
                <div className="upload-or-library">
                  <UploadDropzone small getInput={() => diagram.inputRef.current} disabled={diagram.uploading}>
                    <UploadCloud size={18} />
                    <span>{diagram.uploading ? "Uploading…" : "Click or drop a diagram here"}</span>
                  </UploadDropzone>
                  <LibraryPickButton onPick={diagram.pickFromLibrary} disabled={diagram.uploading} />
                </div>
              )}
              <input ref={diagram.inputRef} type="file" accept="image/*" onChange={diagram.onPick} style={{ display: "none" }} />
              {diagram.error && <div className="auth-error" style={{ marginTop: 8 }}><AlertTriangle size={13} /> {diagram.error}</div>}
            </div>
            <label className="admin-form-span2">Steps (one per line)<textarea rows={4} value={draft.stepsText} onChange={(e) => setDraft({ ...draft, stepsText: e.target.value })} placeholder={"Start in your stance.\nMove to the post.\n..."} /></label>
            <label>Sets<input value={draft.sets || ""} onChange={(e) => setDraft({ ...draft, sets: e.target.value })} placeholder="e.g. 3" maxLength={50} /></label>
            <label>Reps<input value={draft.reps || ""} onChange={(e) => setDraft({ ...draft, reps: e.target.value })} placeholder="e.g. 10 each side" maxLength={50} /></label>
            <WorkoutLevelPlans
              draft={draft} setDraft={setDraft} level={planLevel} setLevel={setPlanLevel} label="Drill Progression" noun="drill progression"
              hint="How the drill builds up, step by step, with sets, reps and rest. Add a set description wherever you need to explain a stage — for example what changes from one progression to the next — and move it above, between or below the rows."
            />
            <label className="admin-form-span2">Coaching points (one per line)<textarea rows={3} value={draft.coachingPointsText} onChange={(e) => setDraft({ ...draft, coachingPointsText: e.target.value })} /></label>
            <label className="admin-form-span2">Common mistakes — "mistake | correction" per line<textarea rows={3} value={draft.mistakesText} onChange={(e) => setDraft({ ...draft, mistakesText: e.target.value })} placeholder={"Collapsing early | Hold your seal longer"} /></label>

            <MediaFields draft={draft} media={media} imageLabel="Cover image" />

            <label className="auth-field admin-form-span2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} style={{ width: "auto" }} />
              <span>Published</span>
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="btn btn--ghost btn--small" onClick={previewDraft}><Play size={13} /> Preview</button>
            <button className="btn btn--ghost btn--small" onClick={cancel}>Cancel</button>
            <button className="btn btn--ghost btn--small" onClick={saveDraft}><FileText size={13} /> Save as draft</button>
            <button className="btn btn--primary btn--small" onClick={save}>Save drill</button>
          </div>
        </div>
      )}

      {content.drills.length === 0 ? (
        <div className="empty-state"><p>No drills created.</p><button className="btn btn--primary btn--small" onClick={startCreate}><Plus size={14} /> Create your first drill</button></div>
      ) : (
        <>
          <div className="admin-filter-row">
            <div className="auth-input-icon admin-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drills by title or category…" />
            </div>
            <select className="admin-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categoriesOfType(content, "drill").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {filteredDrills.length === 0 ? (
            <div className="empty-state"><p>No drills match your search.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Category</th><th>Duration</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filteredDrills.map((d) => (
                  <tr key={d.id}>
                    <td>{d.title}</td>
                    <td>{d.category ? <span className="chip"><Tag size={10} /> {d.category}</span> : <span className="dot">—</span>}</td>
                    <td>{d.duration}</td>
                    <td><button className={"status-pill" + (d.published ? " status-pill--live" : "")} onClick={() => togglePublish(d.id)}>{d.published ? <Eye size={12} /> : <EyeOff size={12} />} {d.published ? "Published" : "Draft"}</button></td>
                    <td className="admin-row-actions">
                      <button className="icon-btn" onClick={() => setPreviewDrill(planForLevel(d, planLevel))} aria-label="Preview"><Play size={14} /></button>
                      <button className="icon-btn" onClick={() => startEdit(d)} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => duplicate(d)} aria-label="Duplicate"><Copy size={14} /></button>
                      <button className="icon-btn" onClick={() => remove(d.id)} aria-label="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {previewDrill && (
        <PreviewModal label={`Preview — how ${planLevel} goalies will see this drill`} onClose={() => setPreviewDrill(null)}>
          <DrillDetailPage drill={previewDrill} branding={content.branding} onBack={() => setPreviewDrill(null)} complete={false} onComplete={() => {}} />
        </PreviewModal>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN — CATEGORIES
   ============================================================================ */

const CATEGORY_TYPES = [
  { key: "drill", label: "Drills", collection: "drills" },
  { key: "focus", label: "Practice Focus", collection: "focusPoints" },
  { key: "office", label: "Off-Ice", collection: "offIceWorkouts" },
];

function categoriesOfType(content, type) {
  return (content.categories || []).filter((c) => c.type === type);
}

function AdminCategories({ content, updateContent }) {
  const [activeType, setActiveType] = useState("drill");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // { name, type }
  const [editValue, setEditValue] = useState("");

  const categories = content.categories || [];

  const collectionFor = (type) => CATEGORY_TYPES.find((t) => t.key === type)?.collection;
  // Most collections are arrays (drills, focus points, off-ice workouts); game day and rest
  // day are single objects instead, so count 0 or 1 for those rather than array-filtering.
  const countFor = (name, type) => {
    const data = content[collectionFor(type)];
    if (Array.isArray(data)) return data.filter((item) => item.category === name).length;
    return data && data.category === name ? 1 : 0;
  };

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    if (categories.some((c) => c.type === activeType && c.name.toLowerCase() === name.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setError("");
    updateContent((c) => ({ ...c, categories: [...(c.categories || []), { name, type: activeType }] }));
    setNewName("");
  };

  const startRename = (cat) => { setEditing(cat); setEditValue(cat.name); setError(""); };
  const cancelRename = () => { setEditing(null); setEditValue(""); };

  const saveRename = () => {
    const next = editValue.trim();
    if (!next) return;
    const { name: oldName, type } = editing;
    if (next !== oldName && categories.some((c) => c.type === type && c.name.toLowerCase() === next.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    const key = collectionFor(type);
    updateContent((c) => {
      const data = c[key];
      const renamed = Array.isArray(data)
        ? data.map((item) => (item.category === oldName ? { ...item, category: next } : item))
        : (data && data.category === oldName ? { ...data, category: next } : data);
      return {
        ...c,
        categories: (c.categories || []).map((cat) => (cat.type === type && cat.name === oldName ? { ...cat, name: next } : cat)),
        [key]: renamed,
      };
    });
    cancelRename();
  };

  const removeCategory = async (cat) => {
    const uses = countFor(cat.name, cat.type);
    const msg = uses > 0
      ? `"${cat.name}" is used by ${uses} item${uses === 1 ? "" : "s"} — they'll keep their content but lose this category label.`
      : "";
    if (!(await confirmDialog({ title: `Delete category "${cat.name}"?`, message: msg, confirmLabel: "Delete", danger: true }))) return;
    updateContent((c) => {
      const key = collectionFor(cat.type);
      const data = c[key];
      const cleared = Array.isArray(data)
        ? data.map((item) => (item.category === cat.name ? { ...item, category: "" } : item))
        : (data && data.category === cat.name ? { ...data, category: "" } : data);
      return {
        ...c,
        categories: (c.categories || []).filter((x) => !(x.type === cat.type && x.name === cat.name)),
        [key]: cleared,
      };
    });
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h1 className="admin-h1">Categories</h1>
      </div>

      <div className="admin-panel">
        <h3>Add a category</h3>
        <div className="category-add-row">
          <select className="admin-filter-select" value={activeType} onChange={(e) => { setActiveType(e.target.value); setError(""); }}>
            {CATEGORY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input
            className="category-add-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="e.g. Angles"
          />
          <button className="btn btn--primary btn--small" onClick={addCategory}><Plus size={14} /> Add</button>
        </div>
        {error && <div className="auth-error" style={{ marginTop: 10 }}><AlertTriangle size={13} /> {error}</div>}
      </div>

      {CATEGORY_TYPES.map((t) => {
        const list = categoriesOfType(content, t.key);
        return (
          <div className="category-group" key={t.key}>
            <h3 className="category-group-title">{t.label}</h3>
            {list.length === 0 ? (
              <div className="empty-state"><p>No categories yet for {t.label.toLowerCase()}.</p></div>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Used by</th><th /></tr></thead>
                <tbody>
                  {list.map((cat) => {
                    const isEditing = editing && editing.type === cat.type && editing.name === cat.name;
                    return (
                      <tr key={cat.type + ":" + cat.name}>
                        <td>
                          {isEditing ? (
                            <input
                              className="category-add-input"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveRename()}
                              autoFocus
                            />
                          ) : (
                            <span className="chip"><Tag size={11} /> {cat.name}</span>
                          )}
                        </td>
                        <td>{countFor(cat.name, cat.type)}</td>
                        <td className="admin-row-actions">
                          {isEditing ? (
                            <>
                              <button className="icon-btn" onClick={saveRename} aria-label="Save"><Check size={14} /></button>
                              <button className="icon-btn" onClick={cancelRename} aria-label="Cancel"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button className="icon-btn" onClick={() => startRename(cat)} aria-label="Rename"><Pencil size={14} /></button>
                              <button className="icon-btn" onClick={() => removeCategory(cat)} aria-label="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   ADMIN — FOCUS POINTS
   ============================================================================ */

const BLANK_FOCUS = {
  title: "", explanation: "", cue: "", category: "", published: false,
  imageAssetId: null, imageUrl: "", videoAssetId: null, videoUrl: "",
  blocks: [],
};

// Uploads/removes photo or video for one block inside draft.blocks, keyed by the
// block's own id — mirrors useExerciseMedia (see AdminOffIce) so state stays
// correct even after blocks are added, removed, or reordered.
function useBlockMedia(setDraft) {
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});
  const inputRefs = useRef({});

  const getRef = (blockId) => {
    if (!inputRefs.current[blockId]) inputRefs.current[blockId] = React.createRef();
    return inputRefs.current[blockId];
  };

  const patchBlock = (blockId, patch) => {
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }));
  };

  const upload = async (blockId, file) => {
    setErrors((e) => ({ ...e, [blockId]: "" }));
    setUploading((u) => ({ ...u, [blockId]: true }));
    try {
      const res = await uploadToStorage(await compressImageFile(file));
      patchBlock(blockId, { imageAssetId: res.id, imageUrl: res.url });
    } catch (err) {
      setErrors((e) => ({ ...e, [blockId]: err?.message || "Upload failed. Please try again." }));
    } finally {
      setUploading((u) => ({ ...u, [blockId]: false }));
    }
  };

  return {
    uploading, errors, getRef,
    onPick: (blockId) => (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(blockId, f); },
    pickFromLibrary: (blockId) => (file) => patchBlock(blockId, { imageAssetId: file.path, imageUrl: file.url }),
    removeImage: (blockId) => patchBlock(blockId, { imageAssetId: null, imageUrl: "" }),
    setVideoUrl: (blockId, url) => patchBlock(blockId, { videoAssetId: null, videoUrl: url }),
    clearError: (blockId) => setErrors((e) => ({ ...e, [blockId]: "" })),
  };
}

// Lets a coach build up a practice focus with more than one photo/video plus
// free-form text, in whatever order they want — on top of the single hero
// image/video and the two fixed text fields above.
// Pick a drill for a practice focus: narrow by category first, then choose the drill.
function FocusDrillPicker({ block, drills, categories, onChange }) {
  const current = drills.find((d) => d.id === block.drillId);
  const [category, setCategory] = useState(current?.category || "");
  return (
    <AssignmentPicker
      label="Drill" icon={GoalieMask} items={drills} categories={categories}
      value={block.drillId || ""} onChange={onChange}
      categoryFilter={category} onCategoryFilterChange={setCategory}
    />
  );
}

function FocusBlocksEditor({ blocks, setDraft, blockMedia, drills = [], drillCategories = [] }) {
  const setBlocks = (updater) => setDraft((d) => ({ ...d, blocks: updater(d.blocks) }));
  const updateField = (id, field, value) => setBlocks((list) => list.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  const removeBlock = async (id) => {
    if (!(await confirmDialog({ title: "Remove this content block?", confirmLabel: "Remove", danger: true }))) return;
    setBlocks((list) => list.filter((b) => b.id !== id));
  };
  const moveBlock = (id, dir) => setBlocks((list) => {
    const i = list.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addBlock = (type) => setBlocks((list) => [
    ...list,
    type === "image" ? { id: uid("blk"), type, imageAssetId: null, imageUrl: "" }
      : type === "video" ? { id: uid("blk"), type, videoAssetId: null, videoUrl: "" }
      : type === "drill" ? { id: uid("blk"), type, drillId: "" }
      : { id: uid("blk"), type, heading: "", body: "" },
  ]);
  const typeLabel = { image: "Photo", video: "Video", text: "Text", drill: "Drill" };

  return (
    <div className="admin-form-span2 exercise-editor">
      <span className="media-field-label">Additional content</span>
      {blocks.length === 0 && <p className="exercise-editor-empty">No additional photos, videos, text, or drills yet — add one below.</p>}
      <div className="exercise-editor-list">
        {blocks.map((b, i) => (
          <div className="exercise-editor-card" key={b.id}>
            <div className="exercise-editor-card-head">
              <span className="exercise-editor-num">{i + 1}</span>
              <span className="block-type-label">{typeLabel[b.type]}</span>
              <div className="exercise-editor-card-actions">
                <button type="button" className="icon-btn" onClick={() => moveBlock(b.id, -1)} disabled={i === 0} aria-label="Move up"><ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="icon-btn" onClick={() => moveBlock(b.id, 1)} disabled={i === blocks.length - 1} aria-label="Move down"><ChevronLeft size={14} style={{ transform: "rotate(-90deg)" }} /></button>
                <button type="button" className="icon-btn" onClick={() => removeBlock(b.id)} aria-label="Remove block"><Trash2 size={14} /></button>
              </div>
            </div>

            {b.type === "image" && (
              <div className="media-field">
                {b.imageUrl ? (
                  <div className="media-field-preview">
                    <img src={b.imageUrl} alt="" className="media-thumb media-thumb--lg" />
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => blockMedia.removeImage(b.id)}>Remove</button>
                  </div>
                ) : (
                  <div className="upload-or-library">
                    <UploadDropzone small getInput={() => blockMedia.getRef(b.id).current} disabled={blockMedia.uploading[b.id]}>
                      <UploadCloud size={16} />
                      <span>{blockMedia.uploading[b.id] ? "Uploading…" : "Click or drop a photo here"}</span>
                    </UploadDropzone>
                    <LibraryPickButton onPick={blockMedia.pickFromLibrary(b.id)} disabled={blockMedia.uploading[b.id]} />
                  </div>
                )}
                <input ref={blockMedia.getRef(b.id)} type="file" accept="image/*" onChange={blockMedia.onPick(b.id)} style={{ display: "none" }} />
                {blockMedia.errors[b.id] && <div className="auth-error"><AlertTriangle size={13} /> {blockMedia.errors[b.id]}</div>}
              </div>
            )}

            {b.type === "video" && (
              <YouTubeField value={b.videoUrl} onChange={(url) => blockMedia.setVideoUrl(b.id, url)} label="Video" className="media-field" />
            )}

            {b.type === "drill" && (
              <>
                <FocusDrillPicker block={b} drills={drills} categories={drillCategories} onChange={(v) => updateField(b.id, "drillId", v)} />
                {drills.length === 0 && <p className="planner-hint" style={{ margin: 0 }}>No drills yet — create one in the Drills section first.</p>}
              </>
            )}

            {b.type === "text" && (
              <>
                <label className="exercise-editor-instructions">Heading (optional)
                  <input className="exercise-editor-title" value={b.heading} onChange={(e) => updateField(b.id, "heading", e.target.value)} placeholder="e.g. Coaching point" />
                </label>
                <div className="exercise-editor-instructions rich-field-wrap"><span className="rich-field-label">Text</span><RichTextEditor rows={3} value={b.body} onChange={(v) => updateField(b.id, "body", v)} /></div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="block-add-row">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => addBlock("image")}><Camera size={13} /> Add photo</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => addBlock("video")}><VideoIcon size={13} /> Add video</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => addBlock("text")}><FileText size={13} /> Add text</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => addBlock("drill")}><GoalieMask size={13} /> Add drill</button>
      </div>
    </div>
  );
}

function AdminFocusPoints({ content, updateContent }) {
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK_FOCUS);
  const [previewFocus, setPreviewFocus] = useState(null);
  const media = useMediaFields(setDraft);
  const blockMedia = useBlockMedia(setDraft);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const filteredFocusPoints = content.focusPoints.filter((f) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || f.title.toLowerCase().includes(q) || (f.category || "").toLowerCase().includes(q) || (f.cue || "").toLowerCase().includes(q);
    const matchesCategory = !filterCategory || f.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const startEdit = (f) => { setEditingId(f.id); setDraft({ ...f, blocks: f.blocks || [] }); setCreating(false); media.clearError(); };
  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(BLANK_FOCUS); media.clearError(); };
  const cancel = () => { setCreating(false); setEditingId(null); setDraft(BLANK_FOCUS); media.clearError(); };
  const commit = (built) => {
    if (creating) updateContent((c) => ({ ...c, focusPoints: [...c.focusPoints, { ...built, id: crypto.randomUUID() }] }));
    else updateContent((c) => ({ ...c, focusPoints: c.focusPoints.map((f) => (f.id === editingId ? { ...built, id: editingId } : f)) }));
    cancel();
  };
  const save = () => {
    if (!draft.title.trim()) return;
    commit(draft);
  };
  // Drafts skip the title requirement and force published:false, so a half-finished
  // practice focus can be saved and resumed later without losing what's typed so far.
  const saveDraft = () => {
    commit({ ...draft, title: draft.title.trim() || "Untitled draft", published: false });
  };
  const remove = async (id) => {
    const uses = countDailyAssignmentUses(content, "focusId", id);
    const msg = uses > 0
      ? `This practice focus is assigned in ${uses} place${uses === 1 ? "" : "s"} (a training block) — deleting it will leave those without a focus.`
      : "This can't be undone.";
    if (!(await confirmDialog({ title: "Delete this practice focus?", message: msg, confirmLabel: "Delete", danger: true }))) return;
    updateContent((c) => ({ ...c, focusPoints: c.focusPoints.filter((f) => f.id !== id) }));
  };
  const togglePublish = (id) => updateContent((c) => ({ ...c, focusPoints: c.focusPoints.map((f) => (f.id === id ? { ...f, published: !f.published } : f)) }));

  // Duplicating opens the new copy straight into edit mode so it's easy to rename/adjust.
  const duplicate = (f) => {
    const copy = { ...f, id: crypto.randomUUID(), title: `${f.title} (Copy)`, blocks: f.blocks || [] };
    updateContent((c) => ({ ...c, focusPoints: [...c.focusPoints, copy] }));
    setCreating(false);
    setEditingId(copy.id);
    setDraft({ ...copy });
    media.clearError();
  };

  const previewDraft = () => {
    if (!draft.title.trim()) return;
    setPreviewFocus({ ...draft, id: editingId || "preview" });
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row"><h1 className="admin-h1">Practice Focus</h1><button className="btn btn--primary btn--small" onClick={startCreate}><Plus size={14} /> New practice focus</button></div>
      {(creating || editingId) && (
        <div className="admin-form" key={editingId || "new"}>
          <h3>{creating ? "Create practice focus" : "Edit practice focus"}</h3>
          <div className="admin-form-grid">
            <label className="admin-form-span2">Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Stay patient on your edges." /></label>
            <label>Category
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="">No category</option>
                {categoriesOfType(content, "focus").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="admin-form-span2">Today's cue<input value={draft.cue} onChange={(e) => setDraft({ ...draft, cue: e.target.value })} /></label>
            <div className="admin-form-span2 rich-field-wrap"><span className="rich-field-label">Execution</span><RichTextEditor rows={3} value={draft.explanation} onChange={(v) => setDraft({ ...draft, explanation: v })} /></div>

            <MediaFields draft={draft} media={media} />

            <FocusBlocksEditor blocks={draft.blocks} setDraft={setDraft} blockMedia={blockMedia} drills={content.drills} drillCategories={categoriesOfType(content, "drill")} />

            <label className="auth-field admin-form-span2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} style={{ width: "auto" }} />
              <span>Published</span>
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="btn btn--ghost btn--small" onClick={previewDraft}><Play size={13} /> Preview</button>
            <button className="btn btn--ghost btn--small" onClick={cancel}>Cancel</button>
            <button className="btn btn--ghost btn--small" onClick={saveDraft}><FileText size={13} /> Save as draft</button>
            <button className="btn btn--primary btn--small" onClick={save}>Save</button>
          </div>
        </div>
      )}
      {content.focusPoints.length === 0 ? (
        <div className="empty-state"><p>No practice focus content created.</p></div>
      ) : (
        <>
          <div className="admin-filter-row">
            <div className="auth-input-icon admin-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search practice focus by title, cue, or category…" />
            </div>
            <select className="admin-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categoriesOfType(content, "focus").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {filteredFocusPoints.length === 0 ? (
            <div className="empty-state"><p>No practice focus content matches your search.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Category</th><th>Cue</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filteredFocusPoints.map((f) => (
                  <tr key={f.id}>
                    <td>{f.title}</td>
                    <td>{f.category ? <span className="chip"><Tag size={10} /> {f.category}</span> : <span className="dot">—</span>}</td>
                    <td>{f.cue}</td>
                    <td><button className={"status-pill" + (f.published ? " status-pill--live" : "")} onClick={() => togglePublish(f.id)}>{f.published ? <Eye size={12} /> : <EyeOff size={12} />} {f.published ? "Published" : "Draft"}</button></td>
                    <td className="admin-row-actions">
                      <button className="icon-btn" onClick={() => setPreviewFocus(f)} aria-label="Preview"><Play size={14} /></button>
                      <button className="icon-btn" onClick={() => startEdit(f)} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => duplicate(f)} aria-label="Duplicate"><Copy size={14} /></button>
                      <button className="icon-btn" onClick={() => remove(f.id)} aria-label="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {previewFocus && (
        <PreviewModal label="Preview — how goalies will see this practice focus" onClose={() => setPreviewFocus(null)}>
          <FocusDetailPage focus={previewFocus} branding={content.branding} drills={content.drills} onBack={() => setPreviewFocus(null)} complete={false} onComplete={() => {}} />
        </PreviewModal>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN — OFF-ICE WORKOUTS
   ============================================================================ */

const blankExercise = () => ({
  id: uid("ex"), name: "", sets: "", rest: "", instructions: "",
  imageAssetId: null, imageUrl: "", videoAssetId: null, videoUrl: "",
});

const BLANK_OFFICE = {
  title: "", duration: "", equipment: "", description: "", objective: "", exercises: [], planRows: [], levelPlans: {}, category: "", published: false,
  imageAssetId: null, imageUrl: "", videoAssetId: null, videoUrl: "",
};
const blankPlanRow = () => ({ id: uid("row"), exercise: "", sets: "", reps: "", rest: "" });
// A set description sits in the same list as the exercise rows (anywhere: before, between or after them).
const blankPlanNote = () => ({ id: uid("note"), type: "note", text: "", intensity: "" });
function isPlanNote(item) { return item?.type === "note"; }
function planNoteHasText(item) { return !!String(item?.text || "").replace(/<[^>]*>/g, "").trim(); }
// A set description counts as filled in if it has text or an intensity.
function planNoteHasContent(item) { return planNoteHasText(item) || !!String(item?.intensity || "").trim(); }

// A plan (an off-ice Workout or a Drill Progression) can differ per level: levelPlans[level] is that
// level's own adjusted version, and a level without one follows the shared planRows. Returns the
// workout or drill as a goalie at `level` sees it.
function planForLevel(item, level) {
  const own = item && level ? item.levelPlans?.[level] : null;
  return own ? { ...item, planRows: own } : item;
}

// A workout's plan as goalies follow it, in the coach's order: each run of exercise rows becomes
// one table, each set description a note between them. Shared by the Off-Ice page and the PDF.
function workoutPlanSegments(office) {
  const segments = [];
  for (const item of office.planRows || []) {
    if (isPlanNote(item)) segments.push({ note: item });
    else if (segments.length && segments[segments.length - 1].rows) segments[segments.length - 1].rows.push(item);
    else segments.push({ rows: [item] });
  }
  return segments;
}
// The table columns worth showing: Exercise always, the others only if some row fills them in.
function workoutPlanColumns(office) {
  const items = office.planRows || [];
  return [["exercise", "Exercise"], ["sets", "Sets"], ["reps", "Reps"], ["rest", "Rest"]]
    .filter(([key]) => key === "exercise" || items.some((r) => !isPlanNote(r) && String(r[key] || "").trim()))
    .map(([key, label]) => ({ key, label }));
}

// Uploads/removes photo or video for one exercise inside draft.exercises, keyed by the
// exercise's own id so state stays correct even after rows are added, removed, or reordered.
function useExerciseMedia(setDraft) {
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});
  const inputRefs = useRef({});

  const getRef = (exId) => {
    if (!inputRefs.current[exId]) inputRefs.current[exId] = React.createRef();
    return inputRefs.current[exId];
  };

  const patchExercise = (exId, patch) => {
    setDraft((d) => ({ ...d, exercises: d.exercises.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)) }));
  };

  const upload = async (exId, file) => {
    setErrors((e) => ({ ...e, [exId]: "" }));
    setUploading((u) => ({ ...u, [exId]: true }));
    try {
      const res = await uploadToStorage(await compressImageFile(file));
      patchExercise(exId, { imageAssetId: res.id, imageUrl: res.url });
    } catch (err) {
      setErrors((e) => ({ ...e, [exId]: err?.message || "Upload failed. Please try again." }));
    } finally {
      setUploading((u) => ({ ...u, [exId]: false }));
    }
  };

  return {
    uploading, errors, getRef,
    onPick: (exId) => (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(exId, f); },
    pickFromLibrary: (exId) => (file) => patchExercise(exId, { imageAssetId: file.path, imageUrl: file.url }),
    removeImage: (exId) => patchExercise(exId, { imageAssetId: null, imageUrl: "" }),
    setVideoUrl: (exId, url) => patchExercise(exId, { videoAssetId: null, videoUrl: url }),
    clearError: (exId) => setErrors((e) => ({ ...e, [exId]: "" })),
  };
}

function ExerciseEditor({ exercises, setDraft, exMedia }) {
  const setExercises = (updater) => setDraft((d) => ({ ...d, exercises: updater(d.exercises) }));
  const updateField = (id, field, value) => setExercises((list) => list.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)));
  const removeExercise = async (id) => {
    if (!(await confirmDialog({ title: "Remove this exercise?", confirmLabel: "Remove", danger: true }))) return;
    setExercises((list) => list.filter((ex) => ex.id !== id));
  };
  const moveExercise = (id, dir) => setExercises((list) => {
    const i = list.findIndex((ex) => ex.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addExercise = () => setExercises((list) => [...list, blankExercise()]);

  return (
    <div className="admin-form-span2 exercise-editor">
      <span className="media-field-label">Exercises</span>
      {exercises.length === 0 && <p className="exercise-editor-empty">No exercises yet — add the first one below.</p>}
      <div className="exercise-editor-list">
        {exercises.map((ex, i) => (
          <div className="exercise-editor-card" key={ex.id}>
            <div className="exercise-editor-card-head">
              <span className="exercise-editor-num">{i + 1}</span>
              <input className="exercise-editor-title" value={ex.name} onChange={(e) => updateField(ex.id, "name", e.target.value)} placeholder="Exercise title" />
              <div className="exercise-editor-card-actions">
                <button type="button" className="icon-btn" onClick={() => moveExercise(ex.id, -1)} disabled={i === 0} aria-label="Move up"><ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="icon-btn" onClick={() => moveExercise(ex.id, 1)} disabled={i === exercises.length - 1} aria-label="Move down"><ChevronLeft size={14} style={{ transform: "rotate(-90deg)" }} /></button>
                <button type="button" className="icon-btn" onClick={() => removeExercise(ex.id)} aria-label="Remove exercise"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="exercise-editor-grid">
              <label>Reps / Sets<input value={ex.sets} onChange={(e) => updateField(ex.id, "sets", e.target.value)} placeholder="3 × 8 each side" /></label>
              <label>Rest / Duration<input value={ex.rest} onChange={(e) => updateField(ex.id, "rest", e.target.value)} placeholder="45 sec" /></label>
            </div>
            <div className="exercise-editor-instructions rich-field-wrap"><span className="rich-field-label">Instructions</span><RichTextEditor rows={2} value={ex.instructions} onChange={(v) => updateField(ex.id, "instructions", v)} placeholder="How to perform this exercise" /></div>

            <div className="exercise-editor-media">
              <div className="media-field">
                <span className="media-field-label">Photo</span>
                {ex.imageUrl ? (
                  <div className="media-field-preview">
                    <img src={ex.imageUrl} alt="" className="media-thumb media-thumb--lg" />
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => exMedia.removeImage(ex.id)}>Remove</button>
                  </div>
                ) : (
                  <div className="upload-or-library">
                    <UploadDropzone small getInput={() => exMedia.getRef(ex.id).current} disabled={exMedia.uploading[ex.id]}>
                      <UploadCloud size={16} />
                      <span>{exMedia.uploading[ex.id] ? "Uploading…" : "Add a photo (click or drop)"}</span>
                    </UploadDropzone>
                    <LibraryPickButton onPick={exMedia.pickFromLibrary(ex.id)} disabled={exMedia.uploading[ex.id]} />
                  </div>
                )}
                <input ref={exMedia.getRef(ex.id)} type="file" accept="image/*" onChange={exMedia.onPick(ex.id)} style={{ display: "none" }} />
              </div>
              <YouTubeField value={ex.videoUrl} onChange={(url) => exMedia.setVideoUrl(ex.id, url)} label="Video" className="media-field" />
            </div>
            {exMedia.errors[ex.id] && <div className="auth-error"><AlertTriangle size={13} /> {exMedia.errors[ex.id]}</div>}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--ghost btn--small" onClick={addExercise}><Plus size={13} /> Add exercise</button>
    </div>
  );
}

// The "Workout" section: a plain, ordered list of exercise rows (sets, reps, rest) and set
// descriptions (how to run them — rounds, rest between rounds) that goalies follow like a written
// training plan. No photos or video — that's what the exercise cards above are for.
function WorkoutPlanEditor({ items, setItems, toolbar, label = "Workout", hint }) {
  const updateField = (id, field, value) => setItems((list) => list.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const remove = (id) => setItems((list) => list.filter((r) => r.id !== id));
  const move = (id, dir) => setItems((list) => {
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const hasRows = items.some((r) => !isPlanNote(r));

  const actions = (item, i, what) => (
    <div className="plan-item-actions">
      <button type="button" className="icon-btn" onClick={() => move(item.id, -1)} disabled={i === 0} aria-label={`Move ${what} up`}><ChevronUp size={14} /></button>
      <button type="button" className="icon-btn" onClick={() => move(item.id, 1)} disabled={i === items.length - 1} aria-label={`Move ${what} down`}><ChevronDown size={14} /></button>
      <button type="button" className="icon-btn" onClick={() => remove(item.id)} aria-label={`Remove ${what}`}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div className="admin-form-span2 plan-table-editor">
      <span className="media-field-label">{label}</span>
      <p className="planner-hint" style={{ marginTop: 0 }}>
        {hint || <>The exercises goalies follow, with their sets, reps and rest. Add a set description wherever you need to explain how to do them —
        for example rounds, or rest between rounds — and move it above, between or below the exercises.</>}
      </p>
      {toolbar}
      {items.length === 0 ? (
        <p className="exercise-editor-empty">Nothing yet — add an exercise or a set description below.</p>
      ) : (
        <div className="plan-table-rows">
          {hasRows && (
            <div className="plan-table-row plan-table-row--head">
              <span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest</span><span />
            </div>
          )}
          {items.map((item, i) => (isPlanNote(item) ? (
            <div className="plan-note-item" key={item.id}>
              <div className="plan-note-item-head">
                <span className="rich-field-label">Set description</span>
                {actions(item, i, "set description")}
              </div>
              <label className="plan-note-intensity-field">
                <span>Intensity</span>
                <input
                  value={item.intensity || ""} onChange={(e) => updateField(item.id, "intensity", e.target.value)}
                  placeholder="e.g. 80%, RPE 7 or Moderate" maxLength={40} list="plan-intensity-options"
                />
              </label>
              <RichTextEditor
                rows={2} value={item.text} onChange={(v) => updateField(item.id, "text", v)}
                placeholder="e.g. Do each exercise once, then repeat for 2 more rounds (3 rounds total). Rest 90 sec between rounds."
              />
            </div>
          ) : (
            <div className="plan-table-row" key={item.id}>
              <input value={item.exercise} onChange={(e) => updateField(item.id, "exercise", e.target.value)} placeholder="e.g. Box jumps" aria-label="Exercise" />
              <input value={item.sets} onChange={(e) => updateField(item.id, "sets", e.target.value)} placeholder="3" aria-label="Sets" />
              <input value={item.reps} onChange={(e) => updateField(item.id, "reps", e.target.value)} placeholder="10" aria-label="Reps" />
              <input value={item.rest} onChange={(e) => updateField(item.id, "rest", e.target.value)} placeholder="45 sec" aria-label="Rest" />
              {actions(item, i, "row")}
            </div>
          )))}
        </div>
      )}
      <datalist id="plan-intensity-options">
        <option value="Low" /><option value="Moderate" /><option value="High" /><option value="Max effort" />
      </datalist>
      <div className="plan-add-buttons">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setItems((list) => [...list, blankPlanRow()])}><Plus size={13} /> Add exercise</button>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setItems((list) => [...list, blankPlanNote()])}><Plus size={13} /> Add set description</button>
      </div>
    </div>
  );
}

// Workout rows and set descriptions, tidied for the editor (older rows may lack ids or fields).
function normalizePlanItems(list) {
  return (list || []).map((r) => (isPlanNote(r)
    ? { id: r.id || uid("note"), type: "note", text: r.text || "", intensity: r.intensity || "" }
    : { id: r.id || uid("row"), exercise: r.exercise || "", sets: r.sets || "", reps: r.reps || "", rest: r.rest || "" }));
}
// Empty rows and empty descriptions (an editor left with only "<br>") are dropped on save.
function cleanPlanItems(list) {
  return (list || [])
    .filter((r) => (isPlanNote(r) ? planNoteHasContent(r) : r.exercise.trim() || r.sets.trim() || r.reps.trim() || r.rest.trim()))
    .map((r) => (isPlanNote(r)
      ? { ...r, intensity: (r.intensity || "").trim(), text: planNoteHasText(r) ? r.text : "" }
      : { ...r, exercise: r.exercise.trim() }));
}

// The Workout with a Youth / Junior / Pro toggle. What's filled in is shared by all three levels;
// "Adjust for <level>" gives that level its own copy to change (structure, reps…) without touching
// the others, and "Use the shared workout" drops the copy again.
function WorkoutLevelPlans({ draft, setDraft, level, setLevel, label = "Workout", hint, noun = "workout" }) {
  const own = draft.levelPlans?.[level];
  const items = own || draft.planRows || [];
  const setItems = (updater) => setDraft((d) => (d.levelPlans?.[level]
    ? { ...d, levelPlans: { ...d.levelPlans, [level]: updater(d.levelPlans[level]) } }
    : { ...d, planRows: updater(d.planRows || []) }));
  const sharedLevels = EXPERIENCE_LEVELS.filter((lv) => !draft.levelPlans?.[lv]);
  const adjust = () => setDraft((d) => ({
    ...d, levelPlans: { ...d.levelPlans, [level]: (d.planRows || []).map((r) => ({ ...r, id: uid(isPlanNote(r) ? "note" : "row") })) },
  }));
  const useShared = async () => {
    if (!(await confirmDialog({ title: `Use the shared ${noun} for ${level}?`, message: `Your ${level} changes are removed and ${level} goalies get the shared ${noun} again.`, confirmLabel: `Use shared ${noun}`, danger: true }))) return;
    setDraft((d) => { const { [level]: _, ...rest } = d.levelPlans || {}; return { ...d, levelPlans: rest }; });
  };
  const toolbar = (
    <div className="plan-level-bar">
      <div className="level-tabs" role="tablist" aria-label={`${label} for level`}>
        {EXPERIENCE_LEVELS.map((lv) => (
          <button key={lv} type="button" role="tab" aria-selected={level === lv} className={"level-tab" + (level === lv ? " active" : "")} onClick={() => setLevel(lv)}>
            {lv}{draft.levelPlans?.[lv] && <span className="level-tab-dot" title="Adjusted for this level" />}
          </button>
        ))}
      </div>
      {own ? (
        <div className="plan-level-status plan-level-status--own">
          <span><strong>Adjusted for {level}.</strong> Changes here only apply to {level} goalies.</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={useShared}>Use the shared {noun}</button>
        </div>
      ) : (
        <div className="plan-level-status">
          <span>{sharedLevels.length > 1
            ? <><strong>Shared by {sharedLevels.slice(0, -1).join(", ")} and {sharedLevels[sharedLevels.length - 1]}.</strong> Changes here apply to {sharedLevels.length === 2 ? "both" : "all three"}.</>
            : <><strong>Shared {noun}.</strong> The other levels have their own versions, so changes here only apply to {level}.</>}</span>
          {sharedLevels.length > 1 && <button type="button" className="btn btn--ghost btn--small" onClick={adjust}><Pencil size={12} /> Adjust for {level} only</button>}
        </div>
      )}
    </div>
  );
  return <WorkoutPlanEditor key={level + (own ? "-own" : "")} items={items} setItems={setItems} toolbar={toolbar} label={label} hint={hint} />;
}

function AdminOffIce({ content, updateContent }) {
  const [planLevel, setPlanLevel] = useState("Youth");
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK_OFFICE);
  const [previewOffice, setPreviewOffice] = useState(null);
  const media = useMediaFields(setDraft);
  const exMedia = useExerciseMedia(setDraft);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const filteredWorkouts = content.offIceWorkouts.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || o.title.toLowerCase().includes(q) || (o.category || "").toLowerCase().includes(q);
    const matchesCategory = !filterCategory || o.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Older workouts and exercises may predate per-exercise media/ids — backfill so the editor has stable keys.
  const toDraft = (o) => ({
    ...o,
    description: o.description || "",
    objective: o.objective || "",
    exercises: (o.exercises || []).map((ex) => ({
      id: ex.id || uid("ex"), name: ex.name || "", sets: ex.sets || "", rest: ex.rest || "", instructions: ex.instructions || "",
      imageAssetId: ex.imageAssetId || null, imageUrl: ex.imageUrl || "", videoAssetId: ex.videoAssetId || null, videoUrl: ex.videoUrl || "",
    })),
    planRows: normalizePlanItems(o.planRows),
    levelPlans: Object.fromEntries(Object.entries(o.levelPlans || {}).map(([lv, list]) => [lv, normalizePlanItems(list)])),
  });
  const startEdit = (o) => { setEditingId(o.id); setDraft(toDraft(o)); setCreating(false); media.clearError(); };
  const startCreate = () => { setCreating(true); setEditingId(null); setDraft(BLANK_OFFICE); media.clearError(); };
  const cancel = () => { setCreating(false); setEditingId(null); setDraft(BLANK_OFFICE); media.clearError(); };

  const buildOffice = (d) => ({
    title: d.title, duration: d.duration, equipment: d.equipment, description: d.description || "", objective: d.objective || "", category: d.category, published: d.published,
    exercises: (d.exercises || [])
      .filter((ex) => ex.name.trim() || ex.instructions.trim() || ex.imageUrl || ex.videoUrl)
      .map((ex) => ({ ...ex, name: ex.name.trim() || "Untitled exercise" })),
    planRows: cleanPlanItems(d.planRows),
    levelPlans: Object.fromEntries(Object.entries(d.levelPlans || {}).map(([lv, list]) => [lv, cleanPlanItems(list)])),
    imageAssetId: d.imageAssetId || null, imageUrl: d.imageUrl || "", videoAssetId: d.videoAssetId || null, videoUrl: d.videoUrl || "",
  });

  const commit = (built) => {
    if (creating) updateContent((c) => ({ ...c, offIceWorkouts: [...c.offIceWorkouts, { ...built, id: crypto.randomUUID() }] }));
    else updateContent((c) => ({ ...c, offIceWorkouts: c.offIceWorkouts.map((o) => (o.id === editingId ? { ...built, id: editingId } : o)) }));
    cancel();
  };
  const save = () => {
    if (!draft.title.trim()) return;
    commit(buildOffice(draft));
  };
  // Drafts skip the title requirement and force published:false, so a half-finished
  // workout can be saved and resumed later without losing what's typed so far.
  const saveDraft = () => {
    const built = buildOffice({ ...draft, title: draft.title.trim() || "Untitled draft" });
    commit({ ...built, published: false });
  };
  const remove = async (id) => {
    const uses = countDailyAssignmentUses(content, "workoutId", id);
    const msg = uses > 0
      ? `This workout is used in ${uses} training block${uses === 1 ? "" : "s"} — deleting it will leave those blocks without an off-ice workout.`
      : "This can't be undone.";
    if (!(await confirmDialog({ title: "Delete this workout?", message: msg, confirmLabel: "Delete", danger: true }))) return;
    updateContent((c) => ({ ...c, offIceWorkouts: c.offIceWorkouts.filter((o) => o.id !== id) }));
  };
  const togglePublish = (id) => updateContent((c) => ({ ...c, offIceWorkouts: c.offIceWorkouts.map((o) => (o.id === id ? { ...o, published: !o.published } : o)) }));

  // Duplicating opens the new copy straight into edit mode so it's easy to rename/adjust.
  const duplicate = (o) => {
    const copy = { ...o, id: crypto.randomUUID(), title: `${o.title} (Copy)`, exercises: (o.exercises || []).map((ex) => ({ ...ex, id: uid("ex") })) };
    updateContent((c) => ({ ...c, offIceWorkouts: [...c.offIceWorkouts, copy] }));
    setCreating(false);
    setEditingId(copy.id);
    setDraft(toDraft(copy));
    media.clearError();
  };

  const previewDraft = () => {
    if (!draft.title.trim()) return;
    setPreviewOffice(planForLevel({ ...buildOffice(draft), id: editingId || "preview" }, planLevel));
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row"><h1 className="admin-h1">Off-Ice</h1><button className="btn btn--primary btn--small" onClick={startCreate}><Plus size={14} /> New workout</button></div>
      {(creating || editingId) && (
        <div className="admin-form" key={editingId || "new"}>
          <h3>{creating ? "Create workout" : "Edit workout"}</h3>
          <div className="admin-form-grid">
            <label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label>Duration<input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="25 min" /></label>
            <label>Equipment<input value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} /></label>
            <label>Category
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="">No category</option>
                {categoriesOfType(content, "office").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="admin-form-span2">Short description<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="One line for the card" /></label>
            <div className="admin-form-span2 rich-field-wrap"><span className="rich-field-label">Description / objective</span><RichTextEditor rows={4} value={draft.objective} onChange={(v) => setDraft({ ...draft, objective: v })} placeholder="What this workout is for and what it builds" /></div>

            <ExerciseEditor exercises={draft.exercises} setDraft={setDraft} exMedia={exMedia} />

            <WorkoutLevelPlans draft={draft} setDraft={setDraft} level={planLevel} setLevel={setPlanLevel} />

            <span className="admin-form-span2 media-section-label">Workout cover photo/video</span>
            <MediaFields draft={draft} media={media} />

            <label className="auth-field admin-form-span2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} style={{ width: "auto" }} />
              <span>Published</span>
            </label>
          </div>
          <div className="admin-form-actions">
            <button className="btn btn--ghost btn--small" onClick={previewDraft}><Play size={13} /> Preview</button>
            <button className="btn btn--ghost btn--small" onClick={cancel}>Cancel</button>
            <button className="btn btn--ghost btn--small" onClick={saveDraft}><FileText size={13} /> Save as draft</button>
            <button className="btn btn--primary btn--small" onClick={save}>Save</button>
          </div>
        </div>
      )}
      {content.offIceWorkouts.length === 0 ? (
        <div className="empty-state"><p>No off-ice workouts created.</p></div>
      ) : (
        <>
          <div className="admin-filter-row">
            <div className="auth-input-icon admin-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workouts by title or category…" />
            </div>
            <select className="admin-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categoriesOfType(content, "office").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {filteredWorkouts.length === 0 ? (
            <div className="empty-state"><p>No workouts match your search.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Title</th><th>Category</th><th>Duration</th><th>Exercises</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filteredWorkouts.map((o) => (
                  <tr key={o.id}>
                    <td>{o.title}</td>
                    <td>{o.category ? <span className="chip"><Tag size={10} /> {o.category}</span> : <span className="dot">—</span>}</td>
                    <td>{o.duration}</td><td>{o.exercises.length}</td>
                    <td><button className={"status-pill" + (o.published ? " status-pill--live" : "")} onClick={() => togglePublish(o.id)}>{o.published ? <Eye size={12} /> : <EyeOff size={12} />} {o.published ? "Published" : "Draft"}</button></td>
                    <td className="admin-row-actions">
                      <button className="icon-btn" onClick={() => setPreviewOffice(planForLevel(o, planLevel))} aria-label="Preview"><Play size={14} /></button>
                      <button className="icon-btn" onClick={() => startEdit(o)} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => duplicate(o)} aria-label="Duplicate"><Copy size={14} /></button>
                      <button className="icon-btn" onClick={() => remove(o.id)} aria-label="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {previewOffice && (
        <PreviewModal label={`Preview — how ${planLevel} goalies will see this workout`} onClose={() => setPreviewOffice(null)}>
          <OffIceDetailPage office={previewOffice} branding={content.branding} onBack={() => setPreviewOffice(null)} complete={false} onComplete={() => {}} />
        </PreviewModal>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN — DAILY TRAINING CALENDAR
   ============================================================================ */

// Under the Off-Ice picker of a training block: which version of the workout this level's goalies get.
function planLevelNote(item, level, noun) {
  if (!item || !Object.keys(item.levelPlans || {}).length) return null;
  return item.levelPlans[level] ? `${level} goalies get the ${level} version of this ${noun}.` : `${level} goalies get the shared version of this ${noun}.`;
}

function AssignmentPicker({ label, icon: Icon, items, categories, value, onChange, categoryFilter, onCategoryFilterChange, note }) {
  // Drafts can be assigned so blocks can be built before content is published; they are labelled,
  // and goalies only see an item once it is published.
  const filtered = items.filter((it) => it.id === value || !categoryFilter || it.category === categoryFilter);
  return (
    <div className="planner-section">
      <div className="planner-section-head"><Icon size={14} /> {label}</div>
      {categories.length > 0 && (
        <div className="category-pill-row">
          <button type="button" className={"category-pill" + (!categoryFilter ? " active" : "")} onClick={() => onCategoryFilterChange("")}>All</button>
          {categories.map((c) => (
            <button type="button" key={c.name} className={"category-pill" + (categoryFilter === c.name ? " active" : "")} onClick={() => onCategoryFilterChange(c.name)}>{c.name}</button>
          ))}
        </div>
      )}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not assigned</option>
        {filtered.map((it) => <option key={it.id} value={it.id}>{it.title}{!it.published ? " (Draft — hidden from goalies until published)" : ""}</option>)}
      </select>
      {filtered.length === 0 && <p className="planner-empty-hint">Nothing in this category yet.</p>}
      {note && <p className="planner-level-note"><Check size={12} /> {note}</p>}
    </div>
  );
}

function formatCreated(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function AdminTrainingDays({ content, updateContent, saveContent }) {
  const [level, setLevel] = useState("Youth");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [drillCat, setDrillCat] = useState("");
  const [focusCat, setFocusCat] = useState("");
  const [officeCat, setOfficeCat] = useState("");
  const [copyingId, setCopyingId] = useState(null);
  const [copyAfter, setCopyAfter] = useState(0);

  const list = content.trainingDays?.[level] || [];
  const LEVELS = ["Youth", "Junior", "Pro"];
  // Edits are held as a draft per block until "Save block". Saving also copies each changed field
  // to the same-numbered block in the other levels while those still match, so a freshly built
  // block stays identical everywhere until the coach tweaks a level by hand.
  const [drafts, setDrafts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [savedIds, setSavedIds] = useState({});
  const setDraft = (id, patch) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setSavedIds((m) => ({ ...m, [id]: false }));
  };
  const saveBlock = async (i) => {
    const day = list[i];
    const patch = drafts[day.id] || {};
    if (!Object.keys(patch).length) return;
    setSaving(day.id); setSaveError(null);
    const next = { ...content.trainingDays };
    for (const lv of LEVELS) {
      const arr = content.trainingDays[lv] || [];
      if (lv === level) {
        next[lv] = arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
      } else if (arr[i]) {
        const follow = Object.fromEntries(Object.entries(patch).filter(([k]) => (arr[i][k] || "") === (day[k] || "")));
        if (Object.keys(follow).length) next[lv] = arr.map((d, idx) => (idx === i ? { ...d, ...follow } : d));
      }
    }
    const ok = await saveContent({ trainingDays: next });
    setSaving(null);
    if (ok) {
      setDrafts((d) => { const { [day.id]: _, ...rest } = d; return rest; });
      setSavedIds((m) => ({ ...m, [day.id]: true }));
    } else setSaveError(`Block ${i + 1} could not be saved. Check your connection and try again.`);
  };
  const addDay = () => {
    const now = new Date().toISOString();
    const ids = Object.fromEntries(LEVELS.map((lv) => [lv, crypto.randomUUID()]));
    updateContent((c) => ({
      ...c,
      trainingDays: Object.fromEntries(LEVELS.map((lv) => [lv, [...(c.trainingDays[lv] || []), { id: ids[lv], drillId: "", focusId: "", workoutId: "", title: "", subtitle: "", createdAt: now }]])),
    }));
    setEditingId(ids[level]);
    setQuery("");
  };
  // Moving swaps the same-numbered blocks in Youth, Junior and Pro together (like add, copy and
  // delete), so "Block 4" keeps meaning the same slot in every level.
  const moveDay = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    updateContent((c) => ({
      ...c,
      trainingDays: Object.fromEntries(LEVELS.map((lv) => {
        const arr = [...(c.trainingDays[lv] || [])];
        if (arr[i] && arr[j]) [arr[i], arr[j]] = [arr[j], arr[i]];
        return [lv, arr];
      })),
    }));
  };
  // Deleting removes the same-numbered block from Youth, Junior and Pro together, so the levels stay lined up.
  const removeDay = async (i) => {
    if (!(await confirmDialog({ title: `Delete Block ${i + 1}${list[i].title ? ` (${list[i].title})` : ""}?`, message: `It's removed from Youth, Junior and Pro. Every later block moves up one, so goalies partway through the list will see different training next.`, confirmLabel: "Delete", danger: true }))) return;
    if (editingId === list[i].id) setEditingId(null);
    updateContent((c) => ({
      ...c,
      trainingDays: Object.fromEntries(LEVELS.map((lv) => [lv, (c.trainingDays[lv] || []).filter((_, idx) => idx !== i)])),
    }));
  };

  const openCopy = (day) => { setCopyingId(day.id); setCopyAfter(list.length); };
  // The copy goes into every level, each taken from that level's own version of the block, at the
  // same position (or the end of a shorter list).
  const copyDay = (i) => {
    const source = { ...list[i], ...drafts[list[i].id] };
    const now = new Date().toISOString();
    updateContent((c) => ({
      ...c,
      trainingDays: Object.fromEntries(LEVELS.map((lv) => {
        const arr = c.trainingDays[lv] || [];
        const base = lv === level ? source : arr[i] || source;
        const copy = { ...base, id: crypto.randomUUID(), createdAt: now };
        const at = Math.min(copyAfter, arr.length);
        return [lv, [...arr.slice(0, at), copy, ...arr.slice(at)]];
      })),
    }));
    setCopyingId(null);
  };

  const blockMatches = (d, i) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const drill = content.drills.find((x) => x.id === d.drillId);
    const focus = content.focusPoints.find((x) => x.id === d.focusId);
    const office = content.offIceWorkouts.find((x) => x.id === d.workoutId);
    const hay = [`block ${i + 1}`, d.title, d.subtitle, drill?.title, drill?.category, focus?.title, focus?.category, office?.title, office?.category, formatCreated(d.createdAt)]
      .filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const matchCount = list.filter((d, i) => blockMatches({ ...d, ...drafts[d.id] }, i)).length;

  const dayIsEmpty = (d) => !d.drillId && !d.focusId && !d.workoutId;
  // Saved blocks without all three parts published are drafts: goalies skip them.
  const draftChip = (saved) => (dayIsEmpty(saved) ? "Empty" : blockIsReady(content, saved) ? null : "Draft — skipped by goalies");

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h1 className="admin-h1">Training blocks</h1>
        <button type="button" className="btn btn--ghost btn--small" aria-expanded={aboutOpen} aria-controls="training-blocks-about" onClick={() => setAboutOpen((v) => !v)}>
          <Info size={14} /> About
        </button>
      </div>
      {aboutOpen && (
      <div className="admin-sub training-blocks-about" id="training-blocks-about">
        <p>Build the ordered list of training blocks for each level. A new block is added to Youth, Junior and Pro at once and what you fill in and save is copied to all three. If you select a level afterwards, you can switch its drills or titles.</p>
        <p>Moving, copying or deleting a block does the same in all three levels, so each block number always lines up.</p>
        <p>Each ideal week has 3 blocks of 2 days. With nothing marked for that week, block 1 runs Monday–Tuesday, block 2 Wednesday–Thursday, block 3 Friday–Saturday, and Sunday is an automatic rest day. If a goalie marks a game or rest day within that week, Sunday opens up as a training day and the blocks shift along the days they have left (a game day Wednesday and a rest day Saturday means the blocks go Monday–Tuesday, Thursday–Friday, and Sunday alone as block 3). If there are two game days in a row followed by a rest day (for example game days Friday and Saturday and a rest day Sunday), there are only two blocks that week: Monday–Tuesday and Wednesday–Thursday.</p>
        <p>A new goalie starts at Block 1 the first day they open the app. If a goalie is away when the next block should start, their list pauses until they're back, so they don't miss any blocks.</p>
        <p>A block needs a drill, a practice focus and an off-ice workout, all published. Until then it's a draft: goalies skip it and get the next complete block.</p>
        <p>When a goalie has had every block of their level, they start again from Block 1 so they always have training. As soon as you add new blocks, they go on to those next.</p>
      </div>
      )}

      <div className="admin-panel">
        <div className="planner-header">
          <h3>{level} — {list.length} training block{list.length === 1 ? "" : "s"}</h3>
          <div className="level-tabs">
            {EXPERIENCE_LEVELS.map((lv) => (
              <button key={lv} type="button" className={"level-tab" + (level === lv ? " active" : "")} onClick={() => setLevel(lv)}>
                {lv}{(content.trainingDays?.[lv] || []).length > 0 && <span className="level-tab-dot" />}
              </button>
            ))}
          </div>
        </div>
        <p className="planner-hint">Goalies are already partway through this list once they've signed up, so inserting, deleting, or reordering blocks changes what each of them sees next. Adding new blocks at the end is always safe.</p>
      </div>

      {list.length > 0 && (
        <div className="training-block-search">
          <Search size={15} />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks by title, drill, focus, off-ice, category or date…" aria-label="Search training blocks"
          />
          {query && <span className="training-block-search-count">{matchCount} of {list.length}</span>}
        </div>
      )}
      {query && list.length > 0 && matchCount === 0 && <p className="planner-empty-hint">No {level} blocks match "{query}".</p>}

      {list.map((saved, i) => {
        const draft = drafts[saved.id];
        const day = { ...saved, ...draft };
        if (!blockMatches(day, i)) return null;
        const dirty = !!draft && Object.keys(draft).length > 0;
        const editing = editingId === saved.id;
        return (
        <div className="admin-panel training-day-card" key={saved.id}>
          <div className="planner-header">
            <div className="training-block-head">
              <h3>Block {i + 1}{day.title && <span className="training-block-title"> — {day.title}</span>}{draftChip(saved) && <span className="chip" style={{ marginLeft: 8 }}>{draftChip(saved)}</span>}</h3>
              <span className="training-block-date">Created {formatCreated(saved.createdAt)}{dirty && " · unsaved changes"}</span>
            </div>
            <div className="admin-row-actions">
              <button className="icon-btn" onClick={() => setEditingId(editing ? null : saved.id)} aria-label={`${editing ? "Close editor for" : "Edit"} Block ${i + 1}`} title="Edit"><Pencil size={15} /></button>
              <button className="icon-btn" onClick={() => setPreviewIndex(i)} aria-label={`Preview Block ${i + 1}`} title="Preview"><Eye size={15} /></button>
              <button className="icon-btn" onClick={() => (copyingId === day.id ? setCopyingId(null) : openCopy(day))} aria-label={`Copy Block ${i + 1}`} title="Copy"><Copy size={15} /></button>
              <button className="icon-btn" onClick={() => removeDay(i)} aria-label={`Delete Block ${i + 1}`} title="Delete"><Trash2 size={15} /></button>
              <button className="icon-btn" onClick={() => moveDay(i, -1)} disabled={i === 0} aria-label={`Move Block ${i + 1} up`} title="Move up"><ChevronUp size={15} /></button>
              <button className="icon-btn" onClick={() => moveDay(i, 1)} disabled={i === list.length - 1} aria-label={`Move Block ${i + 1} down`} title="Move down"><ChevronDown size={15} /></button>
            </div>
          </div>

          {copyingId === day.id && (
            <div className="training-day-copy">
              <label>Insert a copy of Block {i + 1} after
                <select value={copyAfter} onChange={(e) => setCopyAfter(Number(e.target.value))}>
                  {list.map((_, k) => <option key={k} value={k + 1}>Block {k + 1}{k + 1 === list.length ? " (end of list)" : ""}</option>)}
                </select>
              </label>
              <p className="planner-hint">The copy is added to Youth, Junior and Pro at once. It becomes Block {copyAfter + 1}{copyAfter < list.length ? `, and every block after it moves down one` : ""}.</p>
              <div className="admin-form-actions" style={{ marginTop: 0 }}>
                <button className="btn btn--ghost btn--small" onClick={() => setCopyingId(null)}>Cancel</button>
                <button className="btn btn--primary btn--small" onClick={() => copyDay(i)}><Copy size={13} /> Insert copy</button>
              </div>
            </div>
          )}

          {editing && (<>
          <div className="admin-form-grid" style={{ marginBottom: 20 }}>
            <label>Title (optional)
              <input value={day.title || ""} placeholder="e.g. Today's training." onChange={(e) => setDraft(saved.id, { title: e.target.value })} />
            </label>
            <label>Subtitle (optional)
              <input value={day.subtitle || ""} placeholder="e.g. Three things to focus on today." onChange={(e) => setDraft(saved.id, { subtitle: e.target.value })} />
            </label>
          </div>

          <div className="planner-grid">
            <AssignmentPicker
              label="Drill of the block" icon={GoalieMask} items={content.drills} categories={categoriesOfType(content, "drill")}
              value={day.drillId} onChange={(v) => setDraft(saved.id, { drillId: v })} categoryFilter={drillCat} onCategoryFilterChange={setDrillCat}
              note={planLevelNote(content.drills.find((x) => x.id === day.drillId), level, "drill")}
            />
            <AssignmentPicker
              label="Practice focus" icon={HockeyNet} items={content.focusPoints} categories={categoriesOfType(content, "focus")}
              value={day.focusId} onChange={(v) => setDraft(saved.id, { focusId: v })} categoryFilter={focusCat} onCategoryFilterChange={setFocusCat}
            />
            <AssignmentPicker
              label="Off-Ice" icon={CircleDot} items={content.offIceWorkouts} categories={categoriesOfType(content, "office")}
              value={day.workoutId} onChange={(v) => setDraft(saved.id, { workoutId: v })} categoryFilter={officeCat} onCategoryFilterChange={setOfficeCat}
              note={planLevelNote(content.offIceWorkouts.find((x) => x.id === day.workoutId), level, "workout")}
            />
          </div>

          <div className="training-block-save">
            <span className={"status-pill" + (dirty ? "" : savedIds[saved.id] ? " status-pill--live" : "")}>
              {dirty ? "Unsaved changes" : savedIds[saved.id] ? "Saved" : "No changes"}
            </span>
            <button className="btn btn--primary btn--small" onClick={() => saveBlock(i)} disabled={!dirty || saving === saved.id}>
              {saving === saved.id ? "Saving…" : "Save block"}
            </button>
          </div>
          </>)}
        </div>
        );
      })}

      {saveError && <div className="email-status email-status--error"><AlertTriangle size={14} /> {saveError}</div>}
      {previewIndex !== null && list[previewIndex] && (() => {
        const d = { ...list[previewIndex], ...drafts[list[previewIndex].id] };
        const drill = planForLevel(content.drills.find((x) => x.id === d.drillId), level);
        const focus = content.focusPoints.find((x) => x.id === d.focusId);
        const office = planForLevel(content.offIceWorkouts.find((x) => x.id === d.workoutId), level);
        const noop = () => {};
        return (
          <PreviewModal label={`Preview — Block ${previewIndex + 1} (${level})`} onClose={() => setPreviewIndex(null)}>
            <div className="page detail">
              <h1 className="detail-title">{d.title || `Block ${previewIndex + 1}`}</h1>
              {d.subtitle && <p className="hero-sub">{d.subtitle}</p>}
              {!drill && !focus && !office && <p className="planner-empty-hint">Nothing is assigned to this block yet.</p>}
              {drill && <DrillDetailPage drill={drill} branding={content.branding} onBack={noop} complete={false} onComplete={noop} />}
              {focus && <FocusDetailPage focus={focus} branding={content.branding} drills={content.drills} level={level} onBack={noop} complete={false} onComplete={noop} />}
              {office && <OffIceDetailPage office={office} branding={content.branding} onBack={noop} complete={false} onComplete={noop} />}
            </div>
          </PreviewModal>
        );
      })()}
      <button className="btn btn--primary" onClick={addDay}><Plus size={15} /> Add training block</button>
    </div>
  );
}

const NOTE_HISTORY_LIMIT = 50;
const BLANK_GAME_DAY = { note: "", noteDraft: undefined, quote: "" };
const BLANK_REST_DAY = { note: "", noteDraft: undefined };

// The coach's notes for a game/rest day. What they type is a draft; goalies only see the
// version last saved and made live (data.note), which stays on every such day until replaced.
// "Save & make live" publishes the notes together with any extra fields on the page (extraPatch,
// e.g. the game day quote), waits for the database to confirm, and reports the result.
function DayNotesEditor({ data, setFields, onPublish, extraDirty = false, extraPatch = {}, placeholder }) {
  const live = data.note || "";
  const saved = data.noteDraft ?? live;
  const [text, setText] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const dirty = text !== live || extraDirty;
  const history = data.noteHistory || [];
  const saveDraft = () => { if (text !== saved) setFields({ noteDraft: text }); };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Making a note live moves whichever note it replaces into the history list, so it can be
  // brought back later; a note that's live is never also listed in the history.
  const saveAndMakeLive = async () => {
    let nextHistory = history;
    if (live && live !== text) nextHistory = [{ id: crypto.randomUUID(), text: live, replacedAt: Date.now() }, ...history.filter((h) => h.text !== live)];
    nextHistory = nextHistory.filter((h) => h.text !== text).slice(0, NOTE_HISTORY_LIMIT);
    setSaving(true);
    setSaveError("");
    const ok = await onPublish({ ...extraPatch, note: text, noteDraft: text, noteHistory: nextHistory });
    setSaving(false);
    if (ok) setSavedAt(new Date());
    else setSaveError("Couldn't save — nothing was made live. Check your connection and try again.");
  };
  const reuse = (item) => { setSaveError(""); setText(item.text); setFields({ noteDraft: item.text }); };
  const removeFromHistory = async (item) => {
    if (!(await confirmDialog({ title: "Delete this note from the list?", message: "This can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    setFields({ noteHistory: history.filter((h) => h.id !== item.id) });
  };
  return (
    <div className="planner-section" style={{ marginTop: 16 }}>
      <div className="planner-section-head"><FileText size={14} /> Coach notes</div>
      <textarea rows={6} value={text} onChange={(e) => { setSaveError(""); setText(e.target.value); }} onBlur={saveDraft} placeholder={placeholder} />
      {saveError && <div className="email-status email-status--error"><AlertTriangle size={14} /> {saveError}</div>}
      <div className="daytype-notes-actions">
        <span className={"status-pill" + (dirty ? "" : live || savedAt ? " status-pill--live" : "")}>
          {dirty ? <EyeOff size={12} /> : <Check size={12} />}
          {" "}{dirty ? "Unsaved changes — goalies still see the last live version" : savedAt ? "Saved & live — " + savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : live ? "Saved & live" : "Nothing live"}
        </span>
        <button className="btn btn--primary btn--small" disabled={!dirty || saving} onClick={saveAndMakeLive}>
          <Check size={13} /> {saving ? "Saving…" : "Save & make live"}
        </button>
      </div>
      <p className="planner-hint">Goalies see the live version on every day they mark, until you make a new one live. Leave the notes empty and make it live to remove them. Each note you replace is kept below so you can use it again.</p>

      <div className="note-history">
        <div className="planner-section-head"><Copy size={14} /> Previous notes{history.length > 0 ? " (" + history.length + ")" : ""}</div>
        {history.length === 0 ? (
          <p className="planner-hint" style={{ margin: 0 }}>Nothing here yet. When you make a new note live, the one it replaces is saved here.</p>
        ) : history.map((h) => (
          <div className="note-history-item" key={h.id}>
            <p className="note-history-text">{h.text || "(empty)"}</p>
            <div className="note-history-meta">
              <span>Replaced {new Date(h.replacedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
              <div className="admin-row-actions">
                <button className="btn btn--ghost btn--small" onClick={() => reuse(h)}><Copy size={13} /> Use again</button>
                <button className="icon-btn" onClick={() => removeFromHistory(h)} aria-label="Delete this note"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminGameDay({ content, updateContent, saveContent }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const gameDay = content.gameDay || BLANK_GAME_DAY;
  const [quote, setQuote] = useState(gameDay.quote || "");
  const setFields = (patch) =>
    updateContent((c) => ({ ...c, gameDay: { ...(c.gameDay || BLANK_GAME_DAY), ...patch } }));
  const publish = (patch) => saveContent({ gameDay: { ...gameDay, ...patch } });

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h1 className="admin-h1">Game Day</h1>
        <button className="btn btn--ghost btn--small" onClick={() => setPreviewOpen(true)}><Play size={13} /> Preview</button>
      </div>
      <p className="planner-hint">Not tied to a specific date — goalies mark their own game days on their profile calendar, and this is what shows up instead of their normal training that day. The quote and the notes go live together when you press Save & make live.</p>
      <div className="admin-panel">
        <div className="planner-section">
          <div className="planner-section-head"><Megaphone size={14} /> Quote</div>
          <input value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="e.g. Pressure is a privilege." />
        </div>
        <DayNotesEditor
          data={gameDay} setFields={setFields} onPublish={publish}
          extraDirty={quote !== (gameDay.quote || "")} extraPatch={{ quote }}
          placeholder="e.g. Arrive 90 min early, light stretch, visualize your first ten saves."
        />
      </div>

      {previewOpen && (
        <PreviewModal label="Preview — how goalies will see Game Day (with your draft)" onClose={() => setPreviewOpen(false)}>
          <DayTypePage hideClear type="game" data={{ ...gameDay, quote, note: gameDay.noteDraft ?? gameDay.note }} viewDate={TODAY_DATE} canGoBack={false} canGoForward={false} onPrevDay={() => {}} onNextDay={() => {}} onClear={() => true} gameLog={null} onSaveGameLog={() => true} restNote="" onSaveRestNote={() => true} dayTypes={{}} onSetDayType={() => {}} onLogGame={() => true} />
        </PreviewModal>
      )}
    </div>
  );
}

function AdminRestDay({ content, updateContent, saveContent }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const restDay = content.restDay || BLANK_REST_DAY;
  const setFields = (patch) =>
    updateContent((c) => ({ ...c, restDay: { ...(c.restDay || BLANK_REST_DAY), ...patch } }));
  const publish = (patch) => saveContent({ restDay: { ...restDay, ...patch } });

  return (
    <div className="admin-page">
      <div className="admin-header-row">
        <h1 className="admin-h1">Rest Day</h1>
        <button className="btn btn--ghost btn--small" onClick={() => setPreviewOpen(true)}><Play size={13} /> Preview</button>
      </div>
      <p className="planner-hint">Not tied to a specific date — goalies mark their own rest days on their profile calendar (and Sunday is a rest day automatically in a week they haven't marked anything), and this is what shows up instead of their normal training that day.</p>
      <div className="admin-panel">
        <DayNotesEditor data={restDay} setFields={setFields} onPublish={publish} placeholder="e.g. Full rest, light stretching only, hydrate and sleep 9+ hours." />
      </div>

      {previewOpen && (
        <PreviewModal label="Preview — how goalies will see Rest Day (with your draft)" onClose={() => setPreviewOpen(false)}>
          <DayTypePage hideClear type="rest" data={{ ...restDay, note: restDay.noteDraft ?? restDay.note }} viewDate={TODAY_DATE} canGoBack={false} canGoForward={false} onPrevDay={() => {}} onNextDay={() => {}} onClear={() => true} restNote="" onSaveRestNote={() => true} dayTypes={{}} onSetDayType={() => {}} onLogGame={() => true} />
        </PreviewModal>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN — USERS (real registered accounts)
   ============================================================================ */

function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getProfilesMap().then((u) => setUsers(u || {})); }, []);

  const activeCoachCount = (list) => Object.values(list).filter((u) => u.role === "coach" && !u.removed).length;

  const toggleRole = async (email) => {
    setError("");
    const u = users[email];
    const demotingLastCoach = u.role === "coach" && activeCoachCount(users) <= 1;
    if (demotingLastCoach) {
      setError("You can't remove coach access from the last coach account — promote someone else first.");
      return;
    }
    const nextRole = u.role === "coach" ? "goalie" : "coach";
    const ok = await updateUserFields(u.id, { role: nextRole });
    if (!ok) { setError("Couldn't save that — check your connection and try again."); return; }
    setUsers((prev) => ({ ...prev, [email]: { ...prev[email], role: nextRole } }));
  };

  const removeUser = async (email) => {
    const u = users[email];
    if (u.role === "coach" && activeCoachCount(users) <= 1) {
      setError("You can't remove the last coach account.");
      return;
    }
    if (!(await confirmDialog({ title: `Remove ${u.name || email}?`, message: "They'll no longer be able to log in, but you can restore them later.", confirmLabel: "Remove", danger: true }))) return;
    setError("");
    const ok = await updateUserFields(u.id, { removed: true });
    if (!ok) { setError("Couldn't save that — check your connection and try again."); return; }
    setUsers((prev) => ({ ...prev, [email]: { ...prev[email], removed: true } }));
  };

  const restoreUser = async (email) => {
    setError("");
    const ok = await updateUserFields(users[email].id, { removed: false });
    if (!ok) { setError("Couldn't save that — check your connection and try again."); return; }
    setUsers((prev) => ({ ...prev, [email]: { ...prev[email], removed: false } }));
  };

  // For deletion requests (the goalie's right to erasure): removes the login and every
  // record of theirs for good. Only offered once an account has been removed.
  const deleteUserPermanently = async (email) => {
    const u = users[email];
    if (!(await confirmDialog({ title: `Permanently delete ${u.name || email}?`, message: "Their account, calendar, game stats and notes will be erased. This can't be undone.", confirmLabel: "Delete permanently", danger: true }))) return;
    setError("");
    const res = await deleteAccount(u.id);
    if (!res.ok) { setError(`Couldn't delete that account: ${res.error}`); return; }
    setUsers((prev) => { const next = { ...prev }; delete next[email]; return next; });
  };

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Users</h1>
      {error && <div className="auth-error" style={{ marginBottom: 16 }}><AlertTriangle size={13} /> {error}</div>}
      {users === null ? (
        <div className="skeleton-hero" style={{ height: 140 }} />
      ) : Object.keys(users).length === 0 ? (
        <div className="empty-state"><p>No users have signed up yet.</p></div>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Experience</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {Object.values(users).map((u) => (
              <tr key={u.email} style={u.removed ? { opacity: 0.5 } : undefined}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.position}</td><td>{u.role === "coach" ? "—" : u.experience}</td>
                <td>{u.role === "coach" ? "Coach / Admin" : "Goalie"}</td>
                <td>{u.removed ? <span className="chip">Removed</span> : <span className="chip chip--done">Active</span>}</td>
                <td className="admin-row-actions">
                  {u.removed ? (
                    <>
                      <button className="status-pill" onClick={() => restoreUser(u.email)}>Restore</button>
                      {u.role !== "coach" && (
                        <button className="icon-btn" onClick={() => deleteUserPermanently(u.email)} aria-label="Delete permanently" title="Delete permanently"><Trash2 size={14} /></button>
                      )}
                    </>
                  ) : (
                    <>
                      <button className="status-pill" onClick={() => toggleRole(u.email)}>{u.role === "coach" ? "Make goalie" : "Make coach"}</button>
                      <button className="icon-btn" onClick={() => removeUser(u.email)} aria-label="Remove user"><Trash2 size={14} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN — MEDIA (a real, shared library backed by Supabase Storage — uploads
   persist for every coach and survive reloads/redeploys)
   ============================================================================ */

// Images the app itself shows (hard-coded), so they're listed but can't be deleted.
const BUILTIN_MEDIA = {
  "content/gameday-banner.jpg": "Game Day page banner",
  "content/restday-banner.jpg": "Rest Day page banner",
};
const FRONT_PAGE_IMAGE_LABELS = { drill: "Drill card image", focus: "Practice Focus card image", office: "Off-Ice card image" };
const MEDIA_SETTING_KEYS = [["gameDay", "Game Day page"], ["restDay", "Rest Day page"], ["welcome", "Welcome screen"], ["announcement", "Announcement"]];

// Where a stored file is used, as readable labels ("Drill "Butterfly" — cover", ...).
function mediaUsages(content, path) {
  const uses = [];
  const has = (v) => typeof v === "string" && v.includes(path);
  if (BUILTIN_MEDIA[path]) uses.push(`${BUILTIN_MEDIA[path]} (built into the app)`);
  for (const d of content.drills || []) {
    if (has(d.imageUrl)) uses.push(`Drill “${d.title}” — cover`);
    if (has(d.diagramUrl)) uses.push(`Drill “${d.title}” — diagram`);
  }
  for (const f of content.focusPoints || []) {
    if (has(f.imageUrl)) uses.push(`Practice Focus “${f.title}” — cover`);
    if ((f.blocks || []).some((b) => has(b.imageUrl))) uses.push(`Practice Focus “${f.title}” — photo`);
  }
  for (const o of content.offIceWorkouts || []) {
    if (has(o.imageUrl)) uses.push(`Off-Ice “${o.title}” — cover`);
    for (const ex of o.exercises || []) if (has(ex.imageUrl)) uses.push(`Off-Ice “${o.title}” — exercise “${ex.name}”`);
  }
  for (const [key, entry] of Object.entries(content.branding || {})) if (has(entry?.url)) uses.push(`Front Page — ${FRONT_PAGE_IMAGE_LABELS[key] || key}`);
  for (const [key, label] of MEDIA_SETTING_KEYS) if (JSON.stringify(content[key] ?? "").includes(path)) uses.push(label);
  return uses;
}

// A copy of a content value with every reference to the file blanked out, so nothing is left
// pointing at an image that's about to be deleted.
function withoutMedia(value, path) {
  if (typeof value === "string") return value.includes(path) ? "" : value;
  if (Array.isArray(value)) return value.map((v) => withoutMedia(v, path));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutMedia(v, path)]));
  return value;
}

// The media library: every image uploaded anywhere in the app. Removing an image from a drill,
// focus or workout only unlinks it; this is the only place a file is deleted for good.
function AdminMedia({ content, saveContent }) {
  const [files, setFiles] = useState(undefined);
  const [filter, setFilter] = useState("all"); // all | used | unused
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyPath, setBusyPath] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  const load = async () => setFiles(await listMediaLibrary());
  useEffect(() => { load(); }, []);

  const items = (files || []).map((f) => {
    const uses = mediaUsages(content, f.path);
    return { ...f, uses, builtin: !!BUILTIN_MEDIA[f.path], label: f.name || BUILTIN_MEDIA[f.path] || `Image from ${formatCreated(f.createdAt)}` };
  });
  const unused = items.filter((f) => !f.uses.length);
  const q = query.trim().toLowerCase();
  const shown = items
    .filter((f) => filter === "all" || (filter === "used" ? f.uses.length > 0 : !f.uses.length))
    .filter((f) => !q || f.label.toLowerCase().includes(q) || f.uses.some((u) => u.toLowerCase().includes(q)));
  const totalBytes = items.reduce((n, f) => n + f.sizeBytes, 0);

  const onPick = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    setError(""); setMessage("");
    setUploading(true);
    try {
      for (const f of picked) await uploadToStorage(f.type.startsWith("image/") ? await compressImageFile(f) : f, "content", f.name);
      setMessage(`Uploaded ${picked.length} image${picked.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      load();
    }
  };

  const remove = async (item) => {
    const where = item.uses;
    const ok = await confirmDialog({
      title: `Delete “${item.label}” permanently?`,
      message: where.length
        ? `It's used in ${where.length} place${where.length === 1 ? "" : "s"}: ${where.join("; ")}. It will be removed from ${where.length === 1 ? "there" : "all of them"} too. This can't be undone.`
        : "It isn't used anywhere in the app. This can't be undone.",
      confirmLabel: "Delete permanently", danger: true,
    });
    if (!ok) return;
    setBusyPath(item.path); setError(""); setMessage("");
    try {
      if (where.length) {
        // Unlink it everywhere first; only delete the file once that has saved.
        const patch = {};
        for (const key of ["drills", "focusPoints", "offIceWorkouts", "branding", ...MEDIA_SETTING_KEYS.map(([k]) => k)]) {
          if (content[key] === undefined) continue;
          const next = withoutMedia(content[key], item.path);
          if (JSON.stringify(next) !== JSON.stringify(content[key])) patch[key] = next;
        }
        if (Object.keys(patch).length && !(await saveContent(patch))) {
          setError("Couldn't remove it from the items that use it, so nothing was deleted. Please try again.");
          return;
        }
      }
      if (!(await deleteMediaFiles([item.path]))) { setError("Couldn't delete that file. Please try again."); return; }
      setMessage(`Deleted “${item.label}”.`);
    } finally {
      setBusyPath(null);
      load();
    }
  };

  const removeUnused = async () => {
    const bytes = unused.reduce((n, f) => n + f.sizeBytes, 0);
    const ok = await confirmDialog({
      title: `Delete ${unused.length} unused image${unused.length === 1 ? "" : "s"} (${formatBytes(bytes)})?`,
      message: "Nothing in the app uses them. They'll be deleted permanently. This can't be undone.",
      confirmLabel: "Delete permanently", danger: true,
    });
    if (!ok) return;
    setBusyPath("*"); setError(""); setMessage("");
    const done = await deleteMediaFiles(unused.map((f) => f.path));
    setBusyPath(null);
    if (done) setMessage(`Deleted ${unused.length} unused image${unused.length === 1 ? "" : "s"}.`);
    else setError("Couldn't delete those files. Please try again.");
    load();
  };

  return (
    <div className="admin-page">
      <div className="admin-header-row"><h1 className="admin-h1">Media</h1></div>
      <p className="planner-hint">
        Every image uploaded anywhere in the app. Removing an image from a drill, practice focus or workout (or deleting that item)
        only unlinks it — the file stays here. Delete it here to remove it for good.
      </p>
      {error && <div className="auth-error" style={{ marginBottom: 16 }}><AlertTriangle size={13} /> {error}</div>}
      {message && <div className="profile-password-success" style={{ marginBottom: 16 }}><Check size={13} /> {message}</div>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={onPick} style={{ display: "none" }} disabled={uploading} />
      <UploadDropzone getInput={() => inputRef.current} disabled={uploading} dropLabel="Drop to upload these images">
        <UploadCloud size={22} />
        <span>{uploading ? "Uploading…" : "Click to upload images, or drag them here"}</span>
        <span className="upload-dropzone-hint">JPEG, PNG, WEBP, GIF — add videos as YouTube links</span>
      </UploadDropzone>

      {files === undefined ? (
        <div className="skeleton-hero" style={{ height: 140 }} />
      ) : files === null ? (
        <div className="auth-error"><AlertTriangle size={13} /> Couldn't load the media library — reload to try again.</div>
      ) : (
        <>
          <div className="media-toolbar">
            <div className="level-tabs">
              {[["all", `All (${items.length})`], ["used", `In use (${items.length - unused.length})`], ["unused", `Not used (${unused.length})`]].map(([key, label]) => (
                <button key={key} type="button" className={"level-tab" + (filter === key ? " active" : "")} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
            <input className="media-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or where it's used…" aria-label="Search media" />
            <span className="media-total">{formatBytes(totalBytes)} in total</span>
            {unused.length > 0 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={removeUnused} disabled={!!busyPath}>
                <Trash2 size={13} /> Delete all unused ({unused.length})
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <div className="empty-state"><p>{items.length ? "No images match." : "No images uploaded yet."}</p></div>
          ) : (
            <div className="media-grid">
              {shown.map((f) => (
                <div className="media-tile media-tile--file" key={f.path}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="media-thumb-link" aria-label={`Open ${f.label} full size`}>
                    <img src={f.url} alt="" className="media-thumb" loading="lazy" />
                  </a>
                  <span className="media-name" title={f.label}>{f.label}</span>
                  <span className="media-type"><ImageIcon size={10} /> {formatBytes(f.sizeBytes)}</span>
                  {f.uses.length ? (
                    <ul className="media-uses" title={f.uses.join("\n")}>
                      {f.uses.slice(0, 2).map((u) => <li key={u}>{u}</li>)}
                      {f.uses.length > 2 && <li>+{f.uses.length - 2} more</li>}
                    </ul>
                  ) : <span className="chip">Not used</span>}
                  {!f.builtin && (
                    <button className="media-remove" onClick={() => remove(f)} disabled={!!busyPath} aria-label={`Delete ${f.label} permanently`}><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DEFAULT_ACCENT = "#BE202E";
// Shown to goalies while Admin -> Settings -> "Goalies can use the app" is off.
function ComingSoonScreen({ onLogout }) {
  return (
    <div className="coming-soon">
      <img src={LOGO_SRC} alt="10DTendy" className="brand-logo brand-logo--auth" />
      <h1 className="auth-headline">We're getting things ready.</h1>
      <p className="auth-sub">Your coach is setting up new training for you. The app will be back soon — check again in a little while.</p>
      <button className="btn btn--ghost" onClick={onLogout}><LogOut size={14} /> Log out</button>
    </div>
  );
}

function AccessSwitch({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="access-row">
      <div className="access-row-text">
        <span className="access-row-label">{label}</span>
        <span className="access-row-hint">{hint}</span>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={"access-switch" + (checked ? " on" : "")} onClick={() => onChange(!checked)} disabled={disabled}>
        <span className="access-switch-knob" />
      </button>
    </div>
  );
}

function AdminAccess() {
  const access = useAppAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { refreshAppAccess(); }, []);
  const change = async (patch, confirmOptions) => {
    if (confirmOptions && !(await confirmDialog(confirmOptions))) return;
    setBusy(true); setError("");
    const ok = await setAppAccess(patch);
    await refreshAppAccess();
    setBusy(false);
    if (!ok) setError("Couldn't save that — check your connection and try again.");
  };
  return (
    <div className="admin-panel">
      <h3>Access</h3>
      {access === undefined ? <div className="skeleton-hero" style={{ height: 80 }} /> : access === null ? (
        <div className="auth-error"><AlertTriangle size={13} /> Couldn't load the access settings — reload to try again.</div>
      ) : (
        <>
          <AccessSwitch
            label="Allow new sign-ups"
            hint={access.signupsOpen
              ? "Anyone can create a goalie account from the sign-up page."
              : "Closed: nobody can create an account. Coach invite links still work."}
            checked={access.signupsOpen} disabled={busy}
            onChange={(v) => change({ signupsOpen: v }, v ? { title: "Open sign-ups?", message: "Anyone with the link will be able to create a goalie account.", confirmLabel: "Open sign-ups" } : null)}
          />
          <AccessSwitch
            label="Goalies can use the app"
            hint={access.goaliesEnabled
              ? "Goalies who already have an account can log in and train."
              : "Off: only coaches can use the app. Goalies who log in see a \u201ccoming soon\u201d message."}
            checked={access.goaliesEnabled} disabled={busy}
            onChange={(v) => change({ goaliesEnabled: v }, v ? null : { title: "Turn off goalie access?", message: "Goalies will see a \u201ccoming soon\u201d screen until you turn it back on. Their accounts and data are kept.", confirmLabel: "Turn off", danger: true })}
          />
        </>
      )}
      {error && <div className="auth-error" style={{ marginTop: 10 }}><AlertTriangle size={13} /> {error}</div>}
    </div>
  );
}

/* ============================================================================
   ADMIN — BACKUP (export / import of all training content)
   ============================================================================ */

// A backup is one .zip: backup.json (everything Import needs), images/ (every file in the media
// library) and content.html (a readable copy that opens in any browser). Goalie accounts and
// their history aren't part of it — only the training content and settings the coach builds.
const BACKUP_KIND = "10dtendy-content-backup";
const BACKUP_VERSION = 1;
const BACKUP_CONTENT_KEYS = ["drills", "focusPoints", "offIceWorkouts", "categories", "trainingDays", "gameDay", "restDay", "branding", "accentColor", "welcome", "announcement", "confirmationEmail"];

function countOf(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
function backupSummary(c) {
  const blocks = EXPERIENCE_LEVELS.reduce((n, lv) => n + (c.trainingDays?.[lv] || []).length, 0);
  return `${countOf(c.drills.length, "drill", "drills")}, ${countOf(c.focusPoints.length, "practice focus", "practice focuses")}, ${countOf(c.offIceWorkouts.length, "off-ice workout", "off-ice workouts")}, ${countOf(blocks, "training block", "training blocks")}`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backupFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `10dtendy-backup-${dateKey(d)}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

// The readable copy: every drill, practice focus, off-ice workout and the block lists, with images
// pointing at the images/ folder next to it.
function backupReadableHtml(backup) {
  const c = backup.content;
  const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fileByPath = new Map(backup.media.map((m) => [m.path, m.file]));
  const img = (url, alt = "") => {
    if (!url) return "";
    const path = storagePathFromUrl(url);
    return `<img src="${esc((path && fileByPath.get(path)) || url)}" alt="${esc(alt)}">`;
  };
  const rich = (v) => (richTextToPlain(v) ? `<div class="rich">${renderRichText(v)}</div>` : "");
  const meta = (...parts) => { const t = parts.filter((x) => String(x || "").trim()).map(esc).join(" · "); return t ? `<p class="meta">${t}</p>` : ""; };
  const draft = (item) => (item.published ? "" : ' <span class="tag">Draft</span>');
  const video = (url) => (url ? `<p class="meta">Video: <a href="${esc(url)}">${esc(url)}</a></p>` : "");
  const planTable = (items) => workoutPlanSegments({ planRows: items }).map((seg) => (seg.note
    ? `<div class="note">${seg.note.intensity ? `<strong>Intensity: ${esc(seg.note.intensity)}</strong>` : ""}${rich(seg.note.text)}</div>`
    : (() => {
      const cols = workoutPlanColumns({ planRows: seg.rows });
      return `<table><tr>${cols.map((col) => `<th>${col.label}</th>`).join("")}</tr>${seg.rows.map((r) => `<tr>${cols.map((col) => `<td>${esc(r[col.key])}</td>`).join("")}</tr>`).join("")}</table>`;
    })())).join("");
  const plans = (item, heading) => {
    const parts = [];
    if ((item.planRows || []).length) parts.push(`<h4>${heading}${Object.keys(item.levelPlans || {}).length ? " — shared" : ""}</h4>${planTable(item.planRows)}`);
    for (const lv of EXPERIENCE_LEVELS) if (item.levelPlans?.[lv]) parts.push(`<h4>${heading} — ${lv} version</h4>${planTable(item.levelPlans[lv])}`);
    return parts.join("");
  };
  const list = (title, items) => (items?.length ? `<h4>${title}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const name = (items, id) => { const it = items.find((x) => x.id === id); return it ? esc(it.title) + (it.published ? "" : " (draft)") : "—"; };

  const drills = c.drills.map((d) => `<section><h3>${esc(d.title)}${draft(d)}</h3>${meta(d.category, d.duration, d.equipment)}
    ${img(d.imageUrl, d.title)}${d.description ? `<p>${esc(d.description)}</p>` : ""}${video(d.videoUrl)}
    ${richTextToPlain(d.objective) ? `<h4>Objective</h4>${rich(d.objective)}` : ""}${img(d.diagramUrl, "Diagram")}
    ${d.steps?.length ? `<h4>How to perform</h4><ol>${d.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${meta(d.sets && `Sets: ${d.sets}`, d.reps && `Reps: ${d.reps}`)}${plans(d, "Drill Progression")}
    ${list("Coaching points", d.coachingPoints)}${list("Common mistakes", (d.mistakes || []).map((m) => m.correction ? `${m.mistake} → ${m.correction}` : m.mistake))}</section>`).join("");
  const focuses = c.focusPoints.map((f) => `<section><h3>${esc(f.title)}${draft(f)}</h3>${meta(f.category)}${img(f.imageUrl, f.title)}${video(f.videoUrl)}
    ${f.cue ? `<h4>Today's cue</h4><p>${esc(f.cue)}</p>` : ""}${richTextToPlain(f.explanation) ? `<h4>Execution</h4>${rich(f.explanation)}` : ""}
    ${(f.blocks || []).map((b) => (b.type === "image" ? img(b.imageUrl) : b.type === "video" ? video(b.videoUrl) : b.type === "drill" ? `<p><strong>Drill:</strong> ${name(c.drills, b.drillId)}</p>` : `${b.heading ? `<h4>${esc(b.heading)}</h4>` : ""}${rich(b.body)}`)).join("")}</section>`).join("");
  const workouts = c.offIceWorkouts.map((o) => `<section><h3>${esc(o.title)}${draft(o)}</h3>${meta(o.category, o.duration, o.equipment)}
    ${img(o.imageUrl, o.title)}${o.description ? `<p>${esc(o.description)}</p>` : ""}${video(o.videoUrl)}
    ${richTextToPlain(o.objective) ? `<h4>Objective</h4>${rich(o.objective)}` : ""}
    ${(o.exercises || []).length ? `<h4>Exercises</h4>${o.exercises.map((ex) => `<div class="exercise"><strong>${esc(ex.name)}</strong>${meta(ex.sets, ex.rest)}${rich(ex.instructions)}${img(ex.imageUrl, ex.name)}${video(ex.videoUrl)}</div>`).join("")}` : ""}
    ${plans(o, "Workout")}</section>`).join("");
  const blocks = EXPERIENCE_LEVELS.map((lv) => `<h3>${lv}</h3>${(c.trainingDays?.[lv] || []).length ? `<table><tr><th>Block</th><th>Title</th><th>Drill</th><th>Practice focus</th><th>Off-ice</th></tr>${c.trainingDays[lv].map((b, i) => `<tr><td>${i + 1}${blockIsReady(c, b) ? "" : " (draft)"}</td><td>${esc(b.title || "")}</td><td>${name(c.drills, b.drillId)}</td><td>${name(c.focusPoints, b.focusId)}</td><td>${name(c.offIceWorkouts, b.workoutId)}</td></tr>`).join("")}</table>` : "<p>No blocks.</p>"}`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>10DTendy content — ${esc(backup.exportedAt.slice(0, 10))}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:860px;margin:0 auto;padding:24px 16px;color:#18181b;line-height:1.5}
h1{margin:0 0 4px}h2{margin:40px 0 8px;padding-bottom:6px;border-bottom:2px solid #be202e}h3{margin:28px 0 4px}h4{margin:16px 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#52525b}
section{padding-bottom:16px;border-bottom:1px solid #e4e4e7}.meta{color:#71717a;font-size:14px;margin:2px 0}.tag{font-size:12px;background:#f4f4f5;border-radius:6px;padding:2px 6px;color:#71717a}
img{display:block;max-width:100%;max-height:320px;border-radius:8px;margin:10px 0}table{border-collapse:collapse;width:100%;margin:6px 0;font-size:14px}th,td{border:1px solid #e4e4e7;padding:6px 8px;text-align:left}th{background:#fafafa}
.note{background:#fafafa;border-left:3px solid #be202e;padding:6px 10px;margin:8px 0}.exercise{margin:10px 0}nav a{margin-right:14px}</style></head><body>
<h1>10DTendy training content</h1><p class="meta">Backup from ${esc(new Date(backup.exportedAt).toLocaleString())} · ${esc(backupSummary(c))}</p>
<nav><a href="#drills">Drills</a><a href="#focus">Practice focus</a><a href="#office">Off-ice</a><a href="#blocks">Training blocks</a></nav>
<h2 id="drills">Drills</h2>${drills || "<p>None.</p>"}<h2 id="focus">Practice focus</h2>${focuses || "<p>None.</p>"}
<h2 id="office">Off-ice workouts</h2>${workouts || "<p>None.</p>"}<h2 id="blocks">Training blocks</h2>${blocks}</body></html>`;
}

async function buildContentBackup(content, onStatus) {
  const [{ zipSync, strToU8 }, legal, library] = await Promise.all([import("fflate"), getLegal(), listMediaLibrary()]);
  if (!library || !legal) throw new Error("Couldn't read your media or legal texts — check your connection and try again.");
  const files = {};
  const media = [];
  for (const [i, m] of library.entries()) {
    onStatus(`Adding images… ${i + 1} of ${library.length}`);
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`Couldn't download ${m.name || m.path} — try again.`);
    const file = "images/" + m.path.split("/").pop();
    files[file] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }]; // photos are already compressed
    media.push({ path: m.path, name: m.name, contentType: m.contentType, file });
  }
  const backup = {
    kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), mediaBase: mediaPublicBase(),
    content: Object.fromEntries(BACKUP_CONTENT_KEYS.filter((k) => content[k] !== undefined).map((k) => [k, content[k]])),
    legal: legal.docs || {}, media,
  };
  files["backup.json"] = strToU8(JSON.stringify(backup, null, 2));
  files["content.html"] = strToU8(backupReadableHtml(backup));
  return new Blob([zipSync(files)], { type: "application/zip" });
}

async function readContentBackup(file) {
  const { unzipSync, strFromU8 } = await import("fflate");
  let entries;
  try { entries = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new Error("That file isn't a .zip backup."); }
  if (!entries["backup.json"]) throw new Error("That .zip isn't a 10DTendy backup (backup.json is missing).");
  let backup;
  try { backup = JSON.parse(strFromU8(entries["backup.json"])); } catch { throw new Error("The backup file is damaged and can't be read."); }
  const c = backup?.content;
  if (backup?.kind !== BACKUP_KIND || !c || !Array.isArray(c.drills) || !Array.isArray(c.focusPoints) || !Array.isArray(c.offIceWorkouts)) {
    throw new Error("That .zip isn't a 10DTendy content backup.");
  }
  if (backup.version > BACKUP_VERSION) throw new Error("This backup was made by a newer version of the app.");
  return { backup, entries };
}

// Puts a backup back: missing images first (so every link works), then all content (items not in
// the backup are removed, so the app ends up exactly as it was), then the legal texts.
async function restoreContentBackup({ backup, entries }, saveContent, onStatus) {
  onStatus("Checking images…");
  const library = await listMediaLibrary();
  if (!library) throw new Error("Couldn't read the media library — check your connection and try again.");
  const have = new Set(library.map((m) => m.path));
  const missing = (backup.media || []).filter((m) => !have.has(m.path) && entries[m.file]);
  for (const [i, m] of missing.entries()) {
    onStatus(`Restoring images… ${i + 1} of ${missing.length}`);
    if (!(await restoreMediaFile(m.path, new Blob([entries[m.file]], { type: m.contentType || "" }), m.name))) throw new Error(`Couldn't restore ${m.name || m.path}.`);
  }
  onStatus("Restoring content…");
  // Image links point at the project the backup came from; repoint them at this one.
  let text = JSON.stringify(backup.content);
  const base = mediaPublicBase();
  if (backup.mediaBase && backup.mediaBase !== base) text = text.split(backup.mediaBase).join(base);
  const restored = JSON.parse(text);
  const patch = Object.fromEntries(BACKUP_CONTENT_KEYS.filter((k) => restored[k] !== undefined).map((k) => [k, restored[k]]));
  if (patch.trainingDays) patch.trainingDays = Object.fromEntries(EXPERIENCE_LEVELS.map((lv) => [lv, patch.trainingDays[lv] || []]));
  if (!(await saveContent(patch))) throw new Error("Some content couldn't be restored. Reload the page and import the backup again.");
  onStatus("Restoring legal texts…");
  for (const [doc, langs] of Object.entries(backup.legal || {})) {
    for (const [lang, v] of Object.entries(langs || {})) {
      if (typeof v?.body === "string" && !(await saveLegalDoc(doc, lang, v.body))) throw new Error("The legal texts couldn't be restored. Import the backup again.");
    }
  }
  await refreshLegal();
}

function AdminBackup({ content, saveContent }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState(null); // { ok, text }
  const fileRef = useRef(null);

  const exportNow = async () => {
    setBusy(true); setMessage(null);
    try {
      downloadBlob(await buildContentBackup(content, setStatus), backupFileName());
      setMessage({ ok: true, text: "Backup downloaded. Keep it somewhere safe, like your computer or Google Drive." });
    } catch (e) {
      setMessage({ ok: false, text: e.message || "The backup couldn't be made. Try again." });
    }
    setBusy(false); setStatus("");
  };

  const importFile = async (file) => {
    setMessage(null);
    let parsed;
    try { parsed = await readContentBackup(file); } catch (e) { setMessage({ ok: false, text: e.message }); return; }
    const ok = await confirmDialog({
      title: "Replace all content with this backup?",
      message: `Backup from ${new Date(parsed.backup.exportedAt).toLocaleString()}: ${backupSummary(parsed.backup.content)}. Everything you've added since is removed. Goalie accounts and their history aren't touched. A backup of your current content downloads first, just in case.`,
      confirmLabel: "Replace content", danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      setStatus("Backing up your current content first…");
      downloadBlob(await buildContentBackup(content, setStatus), backupFileName());
      await restoreContentBackup(parsed, saveContent, setStatus);
      setMessage({ ok: true, text: "Backup restored. Your content is back as it was when the backup was made." });
    } catch (e) {
      setMessage({ ok: false, text: e.message || "The backup couldn't be restored." });
    }
    setBusy(false); setStatus("");
  };

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Backup</h1>
      <p className="admin-sub">Your content lives in the database. Download a backup now and then, especially after adding a lot, and keep it somewhere safe.</p>
      <div className="admin-panel">
        <h3>Export</h3>
        <p className="planner-hint">Downloads one .zip file with <strong>backup.json</strong> (everything Import needs), an <strong>images</strong> folder with every photo and diagram, and <strong>content.html</strong>, a readable copy of all drills, practice focuses, off-ice workouts and training blocks that opens in any browser. Videos stay on YouTube. Goalie accounts and their history aren't included.</p>
        <button className="btn btn--primary btn--small" onClick={exportNow} disabled={busy}><Download size={14} /> Download backup</button>
      </div>
      <div className="admin-panel">
        <h3>Import</h3>
        <p className="planner-hint">Puts a backup .zip back: all drills, practice focuses, off-ice workouts, training blocks, categories, pages, settings and legal texts return to how they were, and any missing images are uploaded again. Anything added after the backup is removed.</p>
        <button className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()} disabled={busy}><UploadCloud size={14} /> Import backup…</button>
        <input ref={fileRef} type="file" accept=".zip,application/zip" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importFile(f); }} />
      </div>
      {status && <p className="planner-hint" role="status">{status}</p>}
      {message && <div className={"email-status" + (message.ok ? "" : " email-status--error")} role="status">{message.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {message.text}</div>}
    </div>
  );
}

function AdminSettings({ content, updateContent }) {
  const accentColor = content.accentColor || DEFAULT_ACCENT;
  const setAccent = (color) => updateContent((c) => ({ ...c, accentColor: color }));
  return (
    <div className="admin-page">
      <h1 className="admin-h1">Settings</h1>
      <AdminAccess />
      <div className="admin-panel">
        <label className="settings-row">
          <span>Accent color</span>
          <div className="settings-accent-row">
            <input type="color" value={accentColor} onChange={(e) => setAccent(e.target.value)} className="settings-color-swatch" aria-label="Accent color" />
            <span className="settings-accent-hex">{accentColor.toUpperCase()}</span>
            {accentColor.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() && (
              <button className="btn btn--ghost btn--small" onClick={() => setAccent(DEFAULT_ACCENT)}>Reset to default</button>
            )}
          </div>
        </label>
        <p className="planner-hint">Changes every button, link, and highlight across the app for every goalie and coach — it's shared, not per-account.</p>
      </div>
    </div>
  );
}

// Drag (or click) anywhere on the photo to place the focal point, or type exact
// percentages — either way it's stored as a CSS object-position "x% y%" string.
function FocalPointPicker({ src, value, onChange }) {
  const containerRef = useRef(null);
  const { x, y } = parseFocalPoint(value);

  const pointFromEvent = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    const px = Math.max(0, Math.min(1, (p.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (p.clientY - rect.top) / rect.height));
    return { x: Math.round(px * 1000) / 10, y: Math.round(py * 1000) / 10 };
  };

  const startDrag = (e) => {
    e.preventDefault();
    onChange(pointFromEvent(e));
    const onMove = (ev) => onChange(pointFromEvent(ev));
    const onEnd = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  const nudge = (e) => {
    const step = e.shiftKey ? 10 : 1;
    const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = deltas[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ x: Math.max(0, Math.min(100, x + d[0])), y: Math.max(0, Math.min(100, y + d[1])) });
  };

  return (
    <div className="focal-picker" ref={containerRef} style={{ backgroundImage: `url("${src}")` }} onMouseDown={startDrag} onTouchStart={startDrag}>
      <div
        className="focal-marker" style={{ left: x + "%", top: y + "%" }}
        tabIndex={0} role="slider" aria-label="Focal point" aria-valuetext={`${Math.round(x)}%, ${Math.round(y)}%`}
        onKeyDown={nudge}
      />
    </div>
  );
}

function AdminFrontPage({ content, updateContent }) {
  const sections = [
    { key: "drill", label: "Drill card image", fallback: DRILL_IMG },
    { key: "focus", label: "Practice Focus card image", fallback: FOCUS_IMG },
    { key: "office", label: "Off-Ice card image", fallback: OFFICE_IMG },
  ];
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState("");

  const branding = content.branding || {};
  const setEntry = (key, patch) => {
    updateContent((c) => ({ ...c, branding: { ...c.branding, [key]: { ...(c.branding || {})[key], ...patch } } }));
  };

  const onPick = async (key, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const res = await uploadToStorage(await compressImageFile(file));
      setEntry(key, { assetId: res.id, url: res.url });
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const resetToDefault = (key) => {
    updateContent((c) => {
      const rest = { ...(c.branding || {}) };
      delete rest[key];
      return { ...c, branding: rest };
    });
  };

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Front Page</h1>
      <p className="admin-sub">Replace the site's default images and choose which part of each photo stays in frame. A per-drill, per-focus-point, or per-workout photo (set on that item) always takes priority over these defaults.</p>
      {error && <div className="media-banner"><AlertTriangle size={14} /> {error}</div>}

      {sections.map((s) => {
        const entry = branding[s.key];
        const previewSrc = entry?.url || s.fallback;
        const focalPoint = entry?.focalPoint || "center center";
        const { x, y } = parseFocalPoint(focalPoint);
        const setPoint = (p) => setEntry(s.key, { focalPoint: `${p.x}% ${p.y}%` });
        return (
          <FileDropArea
            key={s.key} className="admin-panel front-page-panel"
            getInput={() => document.getElementById("front-page-upload-" + s.key)} disabled={!!uploading[s.key]}
          >
            <h3 className="front-page-panel-title">{s.label}</h3>
            <div className="front-page-panel-body">
              <FocalPointPicker src={previewSrc} value={focalPoint} onChange={setPoint} />
              <div className="brand-image-controls">
                <div className="brand-image-actions">
                  <input id={"front-page-upload-" + s.key} type="file" accept="image/*" onChange={(e) => onPick(s.key, e)} style={{ display: "none" }} />
                  <label htmlFor={"front-page-upload-" + s.key} className="btn btn--ghost btn--small">
                    {uploading[s.key] ? "Uploading…" : entry?.url ? "Replace image" : "Upload image"}
                  </label>
                  <LibraryPickButton asButton onPick={(file) => setEntry(s.key, { assetId: file.path, url: file.url })} disabled={!!uploading[s.key]} />
                  {entry?.url && <button type="button" className="btn btn--ghost btn--small" onClick={() => resetToDefault(s.key)}>Reset to default</button>}
                </div>
                <span className="brand-image-hint">Focal point — drag on the photo, or type exact percentages</span>
                <div className="focal-inputs">
                  <label>X <input type="number" min={0} max={100} value={Math.round(x)} onChange={(e) => setPoint({ x: Math.max(0, Math.min(100, Number(e.target.value) || 0)), y })} />%</label>
                  <label>Y <input type="number" min={0} max={100} value={Math.round(y)} onChange={(e) => setPoint({ x, y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />%</label>
                </div>
                <span className="brand-image-hint">Or drag an image onto this panel to replace it.</span>
              </div>
            </div>
          </FileDropArea>
        );
      })}
    </div>
  );
}

function AdminWelcome({ content, updateContent, saveContent }) {
  const savedWelcome = content.welcome || DEFAULT_WELCOME;
  const announcement = content.announcement || DEFAULT_ANNOUNCEMENT;
  const [previewWhich, setPreviewWhich] = useState(null);

  // The welcome screen is edited as a draft and only goes live when it's saved, so there's
  // an explicit, confirmed "published" moment (the announcement below works the same way).
  const [draft, setDraft] = useState(savedWelcome);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const welcome = draft;
  const dirty = draft.title !== savedWelcome.title || draft.body !== savedWelcome.body || (draft.videoUrl || "") !== (savedWelcome.videoUrl || "");
  const setWelcomeField = (patch) => { setSaveError(""); setDraft((d) => ({ ...d, ...patch })); };
  const saveWelcome = async () => {
    setSaving(true);
    setSaveError("");
    const ok = await saveContent({ welcome: { ...draft, videoAssetId: null } });
    setSaving(false);
    if (ok) setSavedAt(new Date());
    else setSaveError("Couldn't save — nothing was published. Check your connection and try again.");
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const setAnnouncementField = (patch) => updateContent((c) => ({ ...c, announcement: { ...(c.announcement || DEFAULT_ANNOUNCEMENT), ...patch } }));

  const publishAnnouncement = () => setAnnouncementField({ enabled: true, id: uid("ann") });
  const clearAnnouncement = () => setAnnouncementField({ enabled: false });

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Welcome</h1>
      <p className="admin-sub">Control what a goalie sees the first time they open the app, and optionally broadcast a one-off message to everyone.</p>

      <div className="admin-form">
        <h3>Default welcome screen</h3>
        <p className="planner-hint">Shown once, automatically, the first time a new goalie account logs in. Editing this only changes what future first-time logins see — it won't re-show to goalies who already dismissed it.</p>
        <div className="admin-form-grid">
          <label className="admin-form-span2">Title<input value={welcome.title} onChange={(e) => setWelcomeField({ title: e.target.value })} /></label>
          <label className="admin-form-span2">Message (one paragraph per line)<textarea rows={6} value={welcome.body} onChange={(e) => setWelcomeField({ body: e.target.value })} /></label>
          <YouTubeField value={welcome.videoUrl} onChange={(url) => setWelcomeField({ videoAssetId: null, videoUrl: url })} label="Video (optional)" />
        </div>
        {saveError && <div className="email-status email-status--error"><AlertTriangle size={14} /> {saveError}</div>}
        <div className="daytype-notes-actions">
          <span className={"status-pill" + (dirty ? "" : " status-pill--live")}>
            {dirty ? <EyeOff size={12} /> : <Check size={12} />}
            {" "}{dirty ? "Unsaved changes — new goalies still see the last saved version" : savedAt ? "Saved & live — " + savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Saved & live"}
          </span>
          <div className="admin-row-actions">
            <button className="btn btn--ghost btn--small" onClick={() => setPreviewWhich("welcome")}><Play size={13} /> Preview</button>
            <button className="btn btn--primary btn--small" disabled={!dirty || saving} onClick={saveWelcome}>
              <Check size={13} /> {saving ? "Saving…" : "Save & publish"}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-form">
        <div className="admin-header-row">
          <h3>Announcement</h3>
          <span className={"status-pill" + (announcement.enabled ? " status-pill--live" : "")}>{announcement.enabled ? <Eye size={12} /> : <EyeOff size={12} />} {announcement.enabled ? "Live" : "Off"}</span>
        </div>
        <p className="planner-hint">Optional. Publish a one-off message and every goalie will see it once, next time they open the app — including anyone who already dismissed an earlier announcement. Turn it off to stop showing it to goalies who haven't seen it yet.</p>
        <div className="admin-form-grid">
          <label className="admin-form-span2">Title<input value={announcement.title} onChange={(e) => setAnnouncementField({ title: e.target.value })} /></label>
          <label className="admin-form-span2">Message (one paragraph per line)<textarea rows={5} value={announcement.body} onChange={(e) => setAnnouncementField({ body: e.target.value })} /></label>
          <YouTubeField value={announcement.videoUrl} onChange={(url) => setAnnouncementField({ videoAssetId: null, videoUrl: url })} label="Video (optional)" />
        </div>
        <div className="admin-form-actions">
          <button className="btn btn--ghost btn--small" onClick={() => setPreviewWhich("announcement")}><Play size={13} /> Preview</button>
          {announcement.enabled && <button className="btn btn--ghost btn--small" onClick={clearAnnouncement}>Turn off</button>}
          <button className="btn btn--primary btn--small" disabled={!announcement.title.trim()} onClick={publishAnnouncement}>
            <Megaphone size={13} /> {announcement.enabled ? "Republish to everyone" : "Publish announcement"}
          </button>
        </div>
      </div>

      {previewWhich && (
        <WelcomeModal
          label={"Preview — " + (previewWhich === "welcome" ? "Welcome screen" : "Announcement")}
          data={previewWhich === "welcome" ? welcome : announcement}
          onClose={() => setPreviewWhich(null)}
        />
      )}
    </div>
  );
}

function AdminConfirmationEmail({ content, updateContent }) {
  const email = content.confirmationEmail || DEFAULT_CONFIRMATION_EMAIL;
  const accentColor = content.accentColor || DEFAULT_ACCENT;
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(null); // { ok, message }

  const setField = (patch) => {
    setStatus(null);
    updateContent((c) => ({ ...c, confirmationEmail: { ...(c.confirmationEmail || DEFAULT_CONFIRMATION_EMAIL), ...patch } }));
  };

  const publish = async () => {
    setPublishing(true);
    setStatus(null);
    const res = await publishConfirmationEmail({ ...email, accentColor });
    setPublishing(false);
    setStatus(res.ok
      ? { ok: true, message: "Live — new confirmation emails will use this." }
      : { ok: false, message: res.error || "Failed to publish." });
  };

  const previewHtml = buildConfirmationEmailHtml({ ...email, accentColor, confirmUrl: "#", logoUrl: LOGO_SRC });

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Confirmation Email</h1>
      <p className="admin-sub">This is the one email Supabase sends a new goalie or coach — it both welcomes them and verifies their address. Edits here only take effect once you publish.</p>

      <div className="admin-form">
        <h3>Content</h3>
        <div className="admin-form-grid">
          <label className="admin-form-span2">Subject line<input value={email.subject} onChange={(e) => setField({ subject: e.target.value })} /></label>
          <label className="admin-form-span2">Heading<input value={email.heading} onChange={(e) => setField({ heading: e.target.value })} /></label>
          <label className="admin-form-span2">Message (one paragraph per line)<textarea rows={4} value={email.body} onChange={(e) => setField({ body: e.target.value })} /></label>
          <label>Button text<input value={email.buttonText} onChange={(e) => setField({ buttonText: e.target.value })} /></label>
          <label className="admin-form-span2">Footer note<input value={email.footer} onChange={(e) => setField({ footer: e.target.value })} /></label>
        </div>
        <p className="planner-hint">The button always links to the real confirmation link Supabase generates — that part can't be edited. Layout and accent color match the app's Settings page accent.</p>
        <div className="admin-form-actions">
          <button className="btn btn--ghost btn--small" onClick={() => setShowPreview(true)}><Eye size={13} /> Preview</button>
          <button className="btn btn--primary btn--small" disabled={publishing || !email.subject.trim() || !email.heading.trim() || !email.buttonText.trim()} onClick={publish}>
            <Mail size={13} /> {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
        {status && (
          <div className={"email-status" + (status.ok ? " email-status--ok" : " email-status--error")}>
            {status.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {status.message}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <h3>First-time setup</h3>
        <p className="planner-hint">Publishing requires a one-time secret set directly in the Supabase dashboard (never through this app): generate a Personal Access Token under Account → Access Tokens, then add it as <code>MANAGEMENT_API_TOKEN</code> under Project Settings → Edge Functions → Secrets. Until that's done, Publish will show an error explaining what's missing.</p>
      </div>

      {showPreview && (
        <PreviewModal label="Preview" onClose={() => setShowPreview(false)} panelClassName="email-preview-panel">
          <iframe title="Email preview" className="email-preview-frame" sandbox="" srcDoc={previewHtml} />
        </PreviewModal>
      )}
    </div>
  );
}

/* ============================================================================
   ADMIN SHELL
   ============================================================================ */

/* ============================================================================
   ADMIN — LEGAL (privacy policy, terms of use, cookie policy)
   ============================================================================ */

// A new Terms/Privacy version is named after the day it's published: "2026-10-02", then
// "2026-10-02-2" if there's a second one the same day, and so on.
function nextLegalVersion(current) {
  const today = dateKey(new Date());
  if (!current || !current.startsWith(today)) return today;
  const n = parseInt(current.slice(today.length + 1), 10);
  return `${today}-${Number.isNaN(n) ? 2 : n + 1}`;
}

function AdminLegal() {
  const legal = useLegal();
  const [doc, setDoc] = useState("privacy");
  const [lang, setLang] = useState("en");
  const [draft, setDraft] = useState(null); // null = showing what's saved
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [acceptance, setAcceptance] = useState(null);

  useEffect(() => { refreshLegal(); }, []);
  useEffect(() => {
    if (legal?.version) legalAcceptanceCount(legal.version).then(setAcceptance);
  }, [legal?.version]);

  if (legal === undefined) return <div className="admin-page"><h1 className="admin-h1">Legal</h1><div className="skeleton-hero" style={{ height: 140 }} /></div>;
  if (legal === null) return <div className="admin-page"><h1 className="admin-h1">Legal</h1><div className="auth-error"><AlertTriangle size={13} /> Couldn't load the legal texts — check your connection and reload.</div></div>;

  const saved = legal.docs?.[doc]?.[lang];
  const savedBody = saved?.body || "";
  const current = draft ?? savedBody;
  const dirty = draft !== null && sanitizeRichHtml(draft, true) !== sanitizeRichHtml(savedBody, true);
  const versioned = doc !== "cookies";

  const switchTo = async (nextDoc, nextLang) => {
    if (nextDoc === doc && nextLang === lang) return;
    if (dirty && !(await confirmDialog({ title: "Discard unsaved changes?", message: "Your edits to this text haven't been saved.", confirmLabel: "Discard", danger: true }))) return;
    setDoc(nextDoc); setLang(nextLang); setDraft(null); setMessage(""); setError("");
  };

  const save = async (publish) => {
    setMessage(""); setError("");
    const body = sanitizeRichHtml(current, true);
    const isEmpty = !body.replace(/<[^>]*>/g, "").trim();
    if (isEmpty && lang === "en") { setError("The English version can't be empty."); return; }
    if (publish && !(await confirmDialog({ title: "Publish a new version?", message: "Every goalie will be asked to read and accept the updated Terms of Use and Privacy Policy the next time they open the app.", confirmLabel: "Publish" }))) return;
    setBusy(true);
    try {
      if (dirty) {
        const ok = await saveLegalDoc(doc, lang, isEmpty ? "" : body);
        if (!ok) { setError("Couldn't save — check your connection and try again."); return; }
      }
      if (publish) {
        const ok = await publishLegalVersion(nextLegalVersion(legal.version));
        if (!ok) { setError("The text was saved, but the new version couldn't be published. Try publishing again."); await refreshLegal(); setDraft(null); return; }
      }
      await refreshLegal();
      setDraft(null);
      setMessage(publish
        ? "Published. Goalies will be asked to accept the new version the next time they open the app."
        : isEmpty ? "Slovak version removed — goalies see the English text." : "Saved. Goalies see the new text right away.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-h1">Legal</h1>
      <p className="planner-hint legal-admin-intro">
        The texts goalies see from the links on the login screen, the signup form and their profile page.
        Pasting from Word or Google Docs keeps headings, bold, italic, lists and links.
      </p>

      <div className="legal-admin-status">
        <span>Terms & Privacy version <strong>{legal.version || "—"}</strong>{legal.publishedAt && <>, published {formatLegalDate(legal.publishedAt, "en")}</>}</span>
        {acceptance && <span>{acceptance.accepted} of {acceptance.total} goalie{acceptance.total === 1 ? " has" : "s have"} accepted it</span>}
      </div>

      <div className="legal-admin-tabs">
        <div className="level-tabs">
          {Object.keys(LEGAL_DOC_LABELS).map((d) => (
            <button key={d} type="button" className={"level-tab" + (doc === d ? " active" : "")} onClick={() => switchTo(d, lang)}>{LEGAL_DOC_LABELS[d]}</button>
          ))}
        </div>
        <div className="level-tabs">
          {[["en", "English"], ["sk", "Slovenčina"]].map(([l, label]) => (
            <button key={l} type="button" className={"level-tab" + (lang === l ? " active" : "")} onClick={() => switchTo(doc, l)}>
              {label}{legal.docs?.[doc]?.[l]?.body?.trim() && <span className="level-tab-dot" />}
            </button>
          ))}
        </div>
      </div>

      {lang === "sk" && !savedBody.trim() && (
        <p className="planner-hint">There's no Slovak version yet, so goalies only see English. Paste the Slovak text here and save to add one — goalies can then switch languages.</p>
      )}
      {saved?.updatedAt && <p className="planner-hint">Last saved {formatLegalDate(saved.updatedAt, "en")} — shown to goalies as "Last updated".</p>}

      <RichTextEditor key={`${doc}-${lang}-${saved?.updatedAt || ""}`} value={current} onChange={setDraft} legal rows={18} placeholder="Paste or type the text here…" />

      {error && <div className="auth-error" style={{ marginTop: 12 }}><AlertTriangle size={13} /> {error}</div>}
      {message && <div className="profile-password-success" style={{ marginTop: 12 }}><Check size={13} /> {message}</div>}

      <div className="admin-form-actions legal-admin-actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setPreviewing(true)}><Eye size={14} /> Preview</button>
        {dirty && <button type="button" className="btn btn--ghost btn--small" onClick={() => { setDraft(null); setMessage(""); setError(""); }} disabled={busy}>Discard changes</button>}
        <button type="button" className={"btn btn--small " + (versioned ? "btn--ghost" : "btn--primary")} onClick={() => save(false)} disabled={busy || !dirty}>
          {busy ? "Saving…" : versioned ? "Save correction" : "Save"}
        </button>
        {versioned && (
          <button type="button" className="btn btn--primary btn--small" onClick={() => save(true)} disabled={busy}>Publish new version</button>
        )}
      </div>
      {versioned && (
        <ul className="legal-admin-help">
          <li><strong>Save correction</strong> — for typos and small wording fixes. The text updates right away and goalies aren't asked anything.</li>
          <li><strong>Publish new version</strong> — for real changes, such as new rules or adding payments. It saves the text and asks every goalie to accept the Terms of Use and Privacy Policy again.</li>
        </ul>
      )}

      {previewing && (
        <PreviewModal label="Preview — how goalies will see it" onClose={() => setPreviewing(false)}>
          <div className="legal-doc">
            <LegalDocContent doc={doc} lang={lang} body={current} updatedAt={dirty ? new Date().toISOString() : saved?.updatedAt} />
          </div>
        </PreviewModal>
      )}
    </div>
  );
}

// ---- Choosing an existing image from the media library ------------------------------------
// Lets an image that's already uploaded be reused (e.g. the same exercise photo in two workouts)
// instead of uploading a duplicate. The admin's current content is shared through this context
// so the picker can show where each image is already used.
const AdminContentContext = React.createContext(null);

function LibraryPickButton({ onPick, disabled, asButton }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button" className={asButton ? "btn btn--ghost btn--small" : "library-pick-link"}
        onClick={() => setOpen(true)} disabled={disabled}
      >
        <ImageIcon size={13} /> Choose from library
      </button>
      {open && <MediaPickerDialog onClose={() => setOpen(false)} onPick={(file) => { setOpen(false); onPick(file); }} />}
    </>
  );
}

function MediaPickerDialog({ onPick, onClose }) {
  const content = useContext(AdminContentContext);
  const [files, setFiles] = useState(undefined);
  const [query, setQuery] = useState("");
  useEffect(() => { listMediaLibrary().then(setFiles); }, []);
  const items = (files || [])
    .filter((f) => (f.contentType || "image/").startsWith("image/"))
    .map((f) => {
      const uses = content ? mediaUsages(content, f.path) : [];
      return { ...f, uses, label: f.name || BUILTIN_MEDIA[f.path] || `Image from ${formatCreated(f.createdAt)}` };
    });
  const q = query.trim().toLowerCase();
  const shown = items.filter((f) => !q || f.label.toLowerCase().includes(q) || f.uses.some((u) => u.toLowerCase().includes(q)));
  return (
    <PreviewModal label="Choose from media library" onClose={onClose}>
      <div className="media-picker">
        <input
          className="media-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="Search by name or where it's used…" aria-label="Search media"
        />
        {files === undefined ? <div className="skeleton-hero" style={{ height: 120 }} />
          : files === null ? <div className="auth-error"><AlertTriangle size={13} /> Couldn't load the media library. Try again.</div>
          : shown.length === 0 ? <div className="empty-state"><p>{items.length ? "No images match." : "The media library is empty — upload the image instead."}</p></div>
          : (
            <div className="media-grid media-picker-grid">
              {shown.map((f) => (
                <button type="button" className="media-tile media-tile--file media-picker-tile" key={f.path} onClick={() => onPick(f)}>
                  <img src={f.url} alt="" className="media-thumb" loading="lazy" />
                  <span className="media-name" title={f.label}>{f.label}</span>
                  {f.uses.length > 0
                    ? <span className="media-uses-line" title={f.uses.join("\n")}>{f.uses[0]}{f.uses.length > 1 ? ` +${f.uses.length - 1}` : ""}</span>
                    : <span className="media-uses-line">Not used yet</span>}
                </button>
              ))}
            </div>
          )}
      </div>
    </PreviewModal>
  );
}

// ---- Drag-and-drop uploads ----------------------------------------------------------------
// Every upload spot keeps its own hidden <input type="file">. Dropping files onto a drop target
// hands them to that same input (as if picked in the file dialog), so dropped files go through
// exactly the same checks, compression and upload as clicked ones.
function fileMatchesAccept(file, accept) {
  const rules = String(accept || "").split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
}
const dragHasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

function useFileDrop(getInput, disabled) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const dropProps = {
    onDragEnter: (e) => {
      if (!dragHasFiles(e) || disabled) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (!dragHasFiles(e) || disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e) => {
      if (!dragHasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    },
    onDrop: (e) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const input = getInput();
      if (disabled || !input) return;
      let files = [...e.dataTransfer.files].filter((f) => fileMatchesAccept(f, input.accept));
      if (!input.multiple) files = files.slice(0, 1);
      if (!files.length) return;
      const list = new DataTransfer();
      files.forEach((f) => list.items.add(f));
      input.files = list.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
  };
  return { dragging, dropProps };
}

// An upload box you can click or drop files onto.
function UploadDropzone({ getInput, disabled, small, dropLabel = "Drop to upload", children }) {
  const { dragging, dropProps } = useFileDrop(getInput, disabled);
  return (
    <button
      type="button" disabled={disabled} onClick={() => getInput()?.click()} {...dropProps}
      className={"upload-dropzone" + (small ? " upload-dropzone--small" : "") + (dragging ? " upload-dropzone--dragging" : "")}
    >
      {dragging ? <><UploadCloud size={small ? 18 : 22} /><span>{dropLabel}</span></> : children}
    </button>
  );
}

// A whole area (e.g. a Front Page image panel) that accepts dropped files.
function FileDropArea({ getInput, disabled, className = "", children }) {
  const { dragging, dropProps } = useFileDrop(getInput, disabled);
  return (
    <div className={className + " file-drop-area" + (dragging ? " file-drop-area--dragging" : "")} {...dropProps}>
      {children}
      {dragging && <div className="file-drop-overlay"><UploadCloud size={22} /><span>Drop to upload</span></div>}
    </div>
  );
}

function AdminApp({ content, updateContent, saveContent }) {
  const [section, setSection] = useState("dashboard");
  // A file dropped next to an upload box would otherwise make the browser open it, leaving the
  // page and losing unsaved edits. Drop targets handle their own drops before this runs.
  useEffect(() => {
    const onDragOver = (e) => { if (dragHasFiles(e) && !e.defaultPrevented) { e.preventDefault(); e.dataTransfer.dropEffect = "none"; } };
    const onDrop = (e) => { if (dragHasFiles(e) && !e.defaultPrevented) e.preventDefault(); };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => { window.removeEventListener("dragover", onDragOver); window.removeEventListener("drop", onDrop); };
  }, []);
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "calendar", label: "Training Blocks", icon: CalendarIcon, red: true },
    { key: "categories", label: "Categories", icon: Tag },
    { key: "drills", label: "Drills", icon: GoalieMask, bold: true },
    { key: "focus", label: "Practice Focus", icon: HockeyNet, bold: true },
    { key: "office", label: "Off-Ice", icon: CircleDot, bold: true },
    { key: "gameday", label: "Game Day", icon: CrossedSticks, bold: true },
    { key: "restday", label: "Rest Day", icon: Armchair, bold: true },
    { key: "frontpage", label: "Front Page", icon: LayoutTemplate },
    { key: "welcome", label: "Welcome", icon: Megaphone },
    { key: "email", label: "Confirmation Email", icon: Mail },
    { key: "legal", label: "Legal", icon: Scale },
    { key: "users", label: "Users", icon: UsersIcon },
    { key: "media", label: "Media", icon: ImageIcon },
    { key: "settings", label: "Settings", icon: SettingsIcon },
    { key: "backup", label: "Backup", icon: Download },
  ];
  return (
    <AdminContentContext.Provider value={content}>
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {nav.map((n) => (
          <button key={n.key} className={"admin-nav-item" + (section === n.key ? " active" : "") + (n.bold ? " admin-nav-item--bold" : "") + (n.red ? " admin-nav-item--red" : "")} onClick={() => setSection(n.key)}>
            <n.icon size={15} /> {n.label}
          </button>
        ))}
      </aside>
      <div className="admin-content">
        {section === "dashboard" && <AdminDashboard content={content} />}
        {section === "calendar" && <AdminTrainingDays content={content} updateContent={updateContent} saveContent={saveContent} />}
        {section === "drills" && <AdminDrills content={content} updateContent={updateContent} />}
        {section === "categories" && <AdminCategories content={content} updateContent={updateContent} />}
        {section === "focus" && <AdminFocusPoints content={content} updateContent={updateContent} />}
        {section === "office" && <AdminOffIce content={content} updateContent={updateContent} />}
        {section === "gameday" && <AdminGameDay content={content} updateContent={updateContent} saveContent={saveContent} />}
        {section === "restday" && <AdminRestDay content={content} updateContent={updateContent} saveContent={saveContent} />}
        {section === "frontpage" && <AdminFrontPage content={content} updateContent={updateContent} />}
        {section === "welcome" && <AdminWelcome content={content} updateContent={updateContent} saveContent={saveContent} />}
        {section === "email" && <AdminConfirmationEmail content={content} updateContent={updateContent} />}
        {section === "legal" && <AdminLegal />}
        {section === "users" && <AdminUsers />}
        {section === "media" && <AdminMedia content={content} saveContent={saveContent} />}
        {section === "settings" && <AdminSettings content={content} updateContent={updateContent} />}
        {section === "backup" && <AdminBackup content={content} saveContent={saveContent} />}
      </div>
    </div>
    </AdminContentContext.Provider>
  );
}

/* ============================================================================
   PRINT SHEET
   ============================================================================ */

function PrintCard({ label, image, canBreak, children }) {
  return (
    <section className={"print-card" + (canBreak ? " print-card--can-break" : "")}>
      {image && <img src={image.src} style={image.style} alt="" className="print-card-img" />}
      <div className="print-card-body">
        <div className="print-card-top">
          <span className="print-card-label">{label}</span>
          <span className="print-check"><span className="print-check-box" />Done</span>
        </div>
        {children}
      </div>
    </section>
  );
}
function PrintHeading({ children }) { return <h3 className="print-section-heading">{children}</h3>; }

// The "Download Training PDF" sheet: hidden on screen, the only thing printed (see @media print).
// One clean page per training day — header, day title, and a card each for the drill, practice
// focus and off-ice workout, with a "Done" box to tick on paper.
function PrintSheet({ content, date, assignment }) {
  const printDate = date || TODAY_DATE;
  const drill = assignment && planForLevel(content.drills.find((d) => d.id === assignment.drillId && d.published), assignment.level);
  const focus = assignment && content.focusPoints.find((f) => f.id === assignment.focusId && f.published);
  const office = assignment && planForLevel(content.offIceWorkouts.find((o) => o.id === assignment.workoutId && o.published), assignment.level);
  const drillImg = drill ? brandImage(drill.imageUrl, content.branding?.drill, DRILL_IMG) : null;
  const focusImg = focus ? brandImage(focus.imageUrl, content.branding?.focus, FOCUS_IMG) : null;
  const officeImg = office ? brandImage(office.imageUrl, content.branding?.office, OFFICE_IMG) : null;
  const title = assignment?.title || (assignment ? trainingBlockName(assignment.block) : (dateKey(printDate) === dateKey(TODAY_DATE) ? "Today's Training" : "Training Day"));
  const subtitle = (assignment?.subtitle || "").trim();

  const meta = (...values) => values.map((v) => (v || "").trim()).filter(Boolean);

  return (
    <div className="print-sheet">
      <header className="print-header">
        <img src={LOGO_PRINT_SRC} alt="10DTendy" className="print-logo" />
        <div className="print-header-meta">
          <span className="print-kicker">Training day</span>
          <span className="print-date">{WEEKDAY_NAMES[printDate.getDay()]}, {printDate.getDate()} {MONTH_NAMES[printDate.getMonth()]} {printDate.getFullYear()}</span>
        </div>
      </header>
      <h1 className="print-title">{title}</h1>
      {subtitle && <p className="print-subtitle">{subtitle}</p>}

      <PrintCard label="Drill of the day" image={drillImg} canBreak={!!drill && workoutPlanSegments(drill).length > 0}>
        {drill ? (
          <>
            <h2 className="print-card-title">{drill.title}</h2>
            {meta(drill.duration, drill.equipment).length > 0 && (
              <div className="print-meta">{meta(drill.duration, drill.equipment).map((m) => <span key={m}>{m}</span>)}</div>
            )}
            {richTextToPlain(drill.objective) && <><PrintHeading>Objective</PrintHeading><RichText className="print-rich" value={drill.objective} /></>}
            {drill.steps.length > 0 && (
              <>
                <PrintHeading>How to perform</PrintHeading>
                <ol className="print-steps">{drill.steps.map((st, i) => <li key={i}><span className="print-step-num">{i + 1}</span><span>{st}</span></li>)}</ol>
              </>
            )}
            {meta(drill.sets, drill.reps).length > 0 && (
              <div className="print-pills">
                {(drill.sets || "").trim() && <span className="print-pill"><small>Sets</small>{drill.sets.trim()}</span>}
                {(drill.reps || "").trim() && <span className="print-pill"><small>Reps</small>{drill.reps.trim()}</span>}
              </div>
            )}
            <PrintPlan item={drill} heading="Drill Progression" />
          </>
        ) : <p className="print-muted">Not assigned</p>}
      </PrintCard>

      <PrintCard label="Practice focus" image={focusImg}>
        {focus ? (
          <>
            <h2 className="print-card-title">{focus.title}</h2>
            {(focus.cue || "").trim() && (
              <div className="print-cue"><small>Today's cue</small>{focus.cue.trim()}</div>
            )}
            {richTextToPlain(focus.explanation) && <><PrintHeading>Execution</PrintHeading><RichText className="print-rich" value={focus.explanation} /></>}
          </>
        ) : <p className="print-muted">Not assigned</p>}
      </PrintCard>

      <PrintCard label="Off-ice" image={officeImg} canBreak>
        {office ? (
          <>
            <h2 className="print-card-title">{office.title}</h2>
            {richTextToPlain(office.objective) && <><PrintHeading>Objective</PrintHeading><RichText className="print-rich" value={office.objective} /></>}
            <PrintPlan item={office} heading="Workout" />
          </>
        ) : <p className="print-muted">Not assigned</p>}
      </PrintCard>

      <footer className="print-footer">
        <span>10DTENDY · Elite Goalie Development</span>
        <span>app.10dtendy.com</span>
      </footer>
    </div>
  );
}

/* ============================================================================
   ROOT APP
   ============================================================================ */

export default function App() {
  useEffect(() => { refreshLegal(); refreshAppAccess(); }, []);
  return (
    <ErrorBoundary>
      <AppInner />
      <CookieConsent />
      <DialogHost />
    </ErrorBoundary>
  );
}

// The consent banner (shown until a choice is made, and again from "Cookie settings")
// and the cookie policy, both reachable from the login screen and the profile page.
function CookieConsent() {
  const consent = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null); // null | "privacy" | "terms" | "cookies"
  useEffect(() => {
    const showSettings = () => setSettingsOpen(true);
    const showDoc = (e) => { if (LEGAL_DOC_LABELS[e.detail]) setLegalDoc(e.detail); };
    window.addEventListener("open-cookie-settings", showSettings);
    window.addEventListener("open-legal-doc", showDoc);
    return () => {
      window.removeEventListener("open-cookie-settings", showSettings);
      window.removeEventListener("open-legal-doc", showDoc);
    };
  }, []);
  const choose = (youtube) => { setConsent(youtube); setSettingsOpen(false); };

  return (
    <div className="cookie-root">
      {(!consent || settingsOpen) && (
        <div className="cookie-banner no-print" role="dialog" aria-label="Cookie settings">
          <div className="cookie-banner-text">
            <div className="cookie-banner-title"><Cookie size={16} /> Cookies</div>
            <p>
              We use cookies and similar technologies to keep you logged in and to play training videos,
              including some set by third-party services. Details are in our{" "}
              <button type="button" className="cookie-link" onClick={() => setLegalDoc("cookies")}>Cookie policy</button>.
            </p>
            {consent && <p className="cookie-banner-current">Current choice: {consent.youtube ? "all cookies accepted" : "essential only"}.</p>}
          </div>
          <div className="cookie-banner-actions">
            {/* Equal weight on purpose: declining must be as easy as accepting. */}
            <button type="button" className="cookie-btn" onClick={() => choose(false)}>Essential only</button>
            <button type="button" className="cookie-btn" onClick={() => choose(true)}>Accept</button>
          </div>
          {consent && <button type="button" className="icon-btn cookie-banner-close" onClick={() => setSettingsOpen(false)} aria-label="Close"><X size={16} /></button>}
        </div>
      )}
      {legalDoc && (
        <PreviewModal label={LEGAL_DOC_LABELS[legalDoc]} onClose={() => setLegalDoc(null)}>
          <LegalDocView doc={legalDoc} onOpenSettings={() => { setLegalDoc(null); setSettingsOpen(true); }} />
        </PreviewModal>
      )}
    </div>
  );
}

const LEGAL_DOC_LABELS = { privacy: "Privacy policy", terms: "Terms of use", cookies: "Cookie policy" };
const LEGAL_DOC_LABELS_SK = { privacy: "Zásady ochrany osobných údajov", terms: "Podmienky používania", cookies: "Zásady používania cookies" };
const LEGAL_CONTACT_EMAIL = "info@10dtendy.com";

function LegalLinks() {
  return (
    <div className="legal-links">
      <button type="button" className="cookie-link" onClick={() => openLegalDoc("privacy")}>Privacy policy</button>
      <button type="button" className="cookie-link" onClick={() => openLegalDoc("terms")}>Terms of use</button>
      <button type="button" className="cookie-link" onClick={() => openLegalDoc("cookies")}>Cookie policy</button>
      <button type="button" className="cookie-link" onClick={openCookieSettings}>Cookie settings</button>
    </div>
  );
}

// The two agreements every goalie gives, at signup and again whenever a new version is published.
function LegalCheckboxes({ terms, age, onTerms, onAge }) {
  return (
    <div className="legal-checks">
      <label className="legal-check">
        <input type="checkbox" checked={terms} onChange={(e) => onTerms(e.target.checked)} />
        <span>
          I agree to the <button type="button" className="cookie-link" onClick={() => openLegalDoc("terms")}>Terms of Use</button> and
          have read the <button type="button" className="cookie-link" onClick={() => openLegalDoc("privacy")}>Privacy Policy</button>.
        </span>
      </label>
      <label className="legal-check">
        <input type="checkbox" checked={age} onChange={(e) => onAge(e.target.checked)} />
        <span>I'm 16 or older, or my parent or legal guardian has agreed to me using 10DTendy.</span>
      </label>
    </div>
  );
}

// Shown to goalies who haven't accepted the current Terms of Use / Privacy Policy yet
// (accounts created before they existed, or after an update). It can't be dismissed.
function TermsUpdatePrompt({ updated, onAccept, onLogout }) {
  const panelRef = useRef(null);
  const labelId = useId();
  useDialogBehavior(panelRef, null); // must be answered: Escape and outside clicks don't close it
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accept = async () => {
    if (!terms || !age) { setError("Please tick both boxes to continue."); return; }
    setBusy(true); setError("");
    const ok = await onAccept();
    setBusy(false);
    if (!ok) setError("Couldn't save that — check your connection and try again.");
  };
  return (
    <div className="content-preview-overlay no-print">
      <div ref={panelRef} className="content-preview-panel welcome-panel" {...dialogProps(labelId)}>
        <div className="content-preview-header"><span className="content-preview-label">Terms & privacy</span></div>
        <div className="main welcome-modal-body">
          <h2 className="welcome-title" id={labelId}>{updated ? "We've updated our terms" : "Please review our terms"}</h2>
          <p className="welcome-text">
            {updated
              ? "We've made changes to our Terms of Use and Privacy Policy. Please read them and confirm to keep training."
              : "We've published Terms of Use and a Privacy Policy for 10DTendy, explaining how the app works and how we look after your data. Please read them and confirm to keep training."}
          </p>
          <LegalCheckboxes terms={terms} age={age} onTerms={setTerms} onAge={setAge} />
          {error && <div className="auth-error"><AlertTriangle size={13} /> {error}</div>}
          <div className="admin-form-actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={onLogout} disabled={busy}>Log out</button>
            <button type="button" className="btn btn--primary btn--small" onClick={accept} disabled={busy}>{busy ? "Saving…" : "Accept and continue"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Legal texts live in the database (edited in Admin -> Legal) and are shared by the login
// screen, the policy windows, the terms prompt and the admin page, so they're kept in one
// small store. undefined = still loading, null = couldn't be loaded.
let legalState;
const legalListeners = new Set();
async function refreshLegal() {
  const next = await getLegal();
  if (next || legalState === undefined) {
    legalState = next;
    legalListeners.forEach((fn) => fn());
  }
}
function subscribeLegal(fn) { legalListeners.add(fn); return () => legalListeners.delete(fn); }
function useLegal() { return useSyncExternalStore(subscribeLegal, () => legalState); }

// The access switches (see getAppAccess), shared by the login screen, the app and
// Admin -> Settings. undefined = still loading, null = couldn't be loaded.
let appAccessState;
const appAccessListeners = new Set();
async function refreshAppAccess() {
  const next = await getAppAccess();
  if (next || appAccessState === undefined) {
    appAccessState = next;
    appAccessListeners.forEach((fn) => fn());
  }
}
function subscribeAppAccess(fn) { appAccessListeners.add(fn); return () => appAccessListeners.delete(fn); }
function useAppAccess() { return useSyncExternalStore(subscribeAppAccess, () => appAccessState); }

function formatLegalDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// One document as goalies see it. `body`/`updatedAt` override what's saved (the admin preview).
function LegalDocContent({ doc, lang, body, updatedAt }) {
  return (
    <>
      <h2>{(lang === "sk" ? LEGAL_DOC_LABELS_SK : LEGAL_DOC_LABELS)[doc]}</h2>
      {updatedAt && <p className="legal-updated">{lang === "sk" ? "Posledná aktualizácia" : "Last updated"} {formatLegalDate(updatedAt, lang)}</p>}
      <div className="legal-body" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body, true) }} />
    </>
  );
}

function LegalDocView({ doc, onOpenSettings }) {
  const legal = useLegal();
  const [lang, setLang] = useState("en");
  if (legal === undefined) return <div className="legal-doc"><p>Loading…</p></div>;
  const versions = legal?.docs?.[doc] || {};
  const hasSk = !!versions.sk?.body?.trim();
  const shownLang = lang === "sk" && hasSk ? "sk" : "en";
  const entry = versions[shownLang];
  if (!entry?.body?.trim()) {
    return (
      <div className="legal-doc">
        <h2>{LEGAL_DOC_LABELS[doc]}</h2>
        <p>This document couldn't be loaded. Please check your connection and try again, or contact us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
      </div>
    );
  }
  return (
    <div className="legal-doc">
      {hasSk && (
        <div className="level-tabs legal-lang-tabs">
          <button type="button" className={"level-tab" + (shownLang === "en" ? " active" : "")} onClick={() => setLang("en")}>English</button>
          <button type="button" className={"level-tab" + (shownLang === "sk" ? " active" : "")} onClick={() => setLang("sk")}>Slovenčina</button>
        </div>
      )}
      <LegalDocContent doc={doc} lang={shownLang} body={entry.body} updatedAt={entry.updatedAt} />
      {doc === "cookies" && onOpenSettings && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onOpenSettings}><Cookie size={14} /> {shownLang === "sk" ? "Nastavenia cookies" : "Cookie settings"}</button>
      )}
    </div>
  );
}

// A coach-chosen accent color, applied by overriding the --accent custom property
// after the main stylesheet — later in source order wins for an equal-specificity
// custom property, so this doesn't need !important. Validated defensively even
// though it only ever comes from an <input type="color">, since it lands in a
// literal <style> text node.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function AccentOverride({ color }) {
  if (!color || !HEX_COLOR_RE.test(color)) return null;
  return <style>{`:root{--accent:${color}}`}</style>;
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("10DTendy crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <style>{CSS}</style>
          <div className="crash-screen">
            <AlertTriangle size={28} color="var(--accent)" />
            <h2>Something went wrong.</h2>
            <p>{String(this.state.error?.message || this.state.error)}</p>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const legal = useLegal();
  const access = useAppAccess();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("today");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Lets a coach preview any experience level's Today/Game/Rest day without a second account.
  const [previewLevel, setPreviewLevel] = useState("Youth");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const popupsCheckedRef = useRef(false);

  const [content, setContent] = useState(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Opening the reset link from an email lands here with type=recovery in the URL.
  const [recovering, setRecovering] = useState(() => /type=recovery/.test(window.location.hash || ""));
  const [navCalendarOpen, setNavCalendarOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const planPromptedRef = useRef(false);

  // Goalies can browse today plus the MAX_DAYS_BACK days before it — nothing older, nothing in the future.
  const [viewDate, setViewDate] = useState(TODAY_DATE);
  const minViewDate = addDays(TODAY_DATE, -MAX_DAYS_BACK);
  const canGoBack = viewDate.getTime() > minViewDate.getTime();
  const canGoForward = viewDate.getTime() < TODAY_DATE.getTime();
  const goPrevDay = () => setViewDate((d) => (d.getTime() > minViewDate.getTime() ? addDays(d, -1) : d));
  const goNextDay = () => setViewDate((d) => (d.getTime() < TODAY_DATE.getTime() ? addDays(d, 1) : d));

  // What the goalie ticked off for the viewed day, saved to their account.
  const progress = (user && user.dayProgress?.[dateKey(viewDate)]) || NO_PROGRESS;

  // Resolve session + content on load. Session persistence itself is handled by
  // supabase-js (its own token, refreshed automatically) — this just checks
  // whether one exists and loads the matching profile.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const finishRecovery = async () => {
    setRecovering(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const profile = await fetchCurrentProfile();
    if (profile && !profile.removed) { setContent(await getContent()); setUser(profile); }
    else await supabase.auth.signOut();
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // The account and the content load side by side, so a signed-in goalie waits for one round trip, not two.
      const contentLoad = getContent();
      if (session) {
        const profile = await fetchCurrentProfile();
        if (profile && !profile.removed) setUser(profile);
        else if (profile?.removed) await supabase.auth.signOut();
        else {
          // A stored login for an account that no longer exists: Auth rejects it
          // outright (not a network blip), so clear it and start at the login screen.
          const { error } = await supabase.auth.getUser();
          if (error?.status === 401 || error?.status === 403) await supabase.auth.signOut({ scope: "local" });
        }
      }
      setContent(await contentLoad);
      setAuthChecked(true);
    })();
  }, []);

  // "Online" is a heuristic, not a real presence system: while this account has the
  // app open and on screen, stamp lastActive every minute so the admin dashboard can count
  // anyone active in the last few minutes as online. A phone with the app in the background
  // doesn't keep writing.
  useEffect(() => {
    if (!user) return;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      await updateUserFields(user.id, { lastActive: Date.now() });
    };
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // "Today" is worked out when the app loads. A phone can keep the home-screen app open in the
  // background for days, so when a goalie comes back to it on a later date, reload it: that shows
  // the new day's training and records that they opened the app today (so their list doesn't
  // wait for them). Coaches are left alone so an admin form they're partway through isn't lost.
  useEffect(() => {
    if (!user || user.role === "coach") return;
    const check = () => {
      if (document.visibilityState === "visible" && dateKey(new Date()) !== dateKey(TODAY_DATE)) window.location.reload();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [user?.role, !!user]);

  // Record that this account opened the app today (a block only starts on a day they're in the app).
  useEffect(() => {
    if (!user?.id) return;
    const today = dateKey(TODAY_DATE);
    if (user.loginDays?.[today]) return;
    recordLoginDay(user.id, today).then((ok) => {
      if (ok) setUser((prev) => (prev ? { ...prev, loginDays: { ...(prev.loginDays || {}), [today]: true } } : prev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // A goalie who hasn't accepted the current Terms/Privacy version sees that prompt first;
  // the welcome, announcement and month-planning popups wait until it's answered.
  const termsPending = !!(user && user.role !== "coach" && legal?.version && user.termsVersion !== legal.version);

  // First-time-login welcome screen, and/or a coach-published announcement — checked
  // once per session, right after both the account and the shared content are loaded.
  useEffect(() => {
    if (popupsCheckedRef.current) return;
    if (!user || !content || user.role === "coach" || legal === undefined || termsPending) return;
    popupsCheckedRef.current = true;
    if (!user.hasSeenWelcome) {
      setWelcomeOpen(true);
    } else if (content.announcement?.enabled && content.announcement.id && user.lastSeenAnnouncementId !== content.announcement.id) {
      setAnnouncementOpen(true);
    }
  }, [user, content, legal, termsPending]);

  // Once per visit, right after any welcome/announcement popup, ask new-month planning questions.
  useEffect(() => {
    if (planPromptedRef.current || !user || !content || user.role === "coach" || welcomeOpen || announcementOpen || legal === undefined || termsPending) return;
    planPromptedRef.current = true;
    if (getReminders(user).some((r) => r.action === "plan-month")) setPlanOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, content, welcomeOpen, announcementOpen, legal, termsPending]);

  const setMonthPlan = async (mode) => {
    const key = dateKey(TODAY_DATE).slice(0, 7);
    return updateProfile({ monthPlans: { ...(user.monthPlans || {}), [key]: mode } });
  };

  const markWelcomeSeen = async () => {
    setWelcomeOpen(false);
    const ok = await updateUserFields(user.id, { hasSeenWelcome: true });
    if (!ok) return;
    setUser((prev) => ({ ...prev, hasSeenWelcome: true }));
    if (content.announcement?.enabled && content.announcement.id && user.lastSeenAnnouncementId !== content.announcement.id) {
      setAnnouncementOpen(true);
    }
  };
  const markAnnouncementSeen = async () => {
    setAnnouncementOpen(false);
    const id = content.announcement.id;
    const ok = await updateUserFields(user.id, { lastSeenAnnouncementId: id });
    if (ok) setUser((prev) => ({ ...prev, lastSeenAnnouncementId: id }));
  };

  // Unlike updateContent (fire-and-forget), this waits for the database and returns whether the
  // write succeeded, so a screen can show a real "saved" confirmation. The local copy is only
  // updated once the save has gone through.
  // Removing an image from an item never deletes the file — files are only deleted from Media.
  const saveContent = async (patch) => {
    const ok = await updateContentFields(patch, content);
    if (ok) setContent((prev) => ({ ...prev, ...patch }));
    return ok;
  };

  const updateContent = (fn) => {
    setContent((prev) => {
      const next = fn(prev);
      const patch = {};
      for (const key of Object.keys(next)) {
        if (next[key] === prev[key]) continue;
        if (key === "trainingDays") {
          // Only the levels whose list actually changed, so editing one level never rewrites the others.
          const changed = {};
          for (const lv of EXPERIENCE_LEVELS) {
            if (next.trainingDays[lv] !== prev.trainingDays?.[lv]) changed[lv] = next.trainingDays[lv];
          }
          patch.trainingDays = changed;
        } else {
          patch[key] = next[key];
        }
      }
      updateContentFields(patch, prev).then(async (ok) => {
        if (ok) return;
        setSaveFailed(true);
        setContent(await getContent());
      });
      return next;
    });
  };

  // Saved straight away (shown at once, undone again if the save fails).
  const toggleComplete = async (field) => {
    const key = dateKey(viewDate);
    const prev = progress;
    const next = { ...prev, [field]: !prev[field] };
    const setDay = (value) => setUser((u) => ({ ...u, dayProgress: { ...(u.dayProgress || {}), [key]: value } }));
    setDay(next);
    const ok = await updateUserFields(user.id, { dayProgress: { [key]: next } });
    if (!ok) { setDay(prev); setSaveFailed(true); }
  };

  // Content tables are only readable once signed in, so the fetch at page load (before
  // login) comes back empty — pull it again now that there's a session.
  const onAuthed = async (u) => {
    setContent(await getContent());
    setUser(u);
  };
  const changePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return !error;
  };
  const updateProfile = async (patch) => {
    const ok = await updateUserFields(user.id, patch);
    if (ok) setUser((prev) => ({ ...prev, ...patch }));
    return ok;
  };
  const setDayType = async (dateStr, type) => {
    // "none" (not deletion) so clearing a Sunday turns its automatic rest day back into training.
    const value = type || "none";
    const ok = await updateUserFields(user.id, { dayTypes: { [dateStr]: value } });
    if (ok) setUser((prev) => ({ ...prev, dayTypes: { ...(prev.dayTypes || {}), [dateStr]: value } }));
    return ok;
  };
  const setGameLog = async (dateStr, log) => {
    const ok = await updateUserFields(user.id, { gameLogs: { [dateStr]: log } });
    if (ok) setUser((prev) => ({ ...prev, gameLogs: { ...(prev.gameLogs || {}), [dateStr]: log } }));
    return ok;
  };
  const setRestNote = async (dateStr, note) => {
    const ok = await updateUserFields(user.id, { restNotes: { [dateStr]: note } });
    if (ok) setUser((prev) => ({ ...prev, restNotes: { ...(prev.restNotes || {}), [dateStr]: note } }));
    return ok;
  };
  const onLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setView("today");
    setViewDate(TODAY_DATE);
  };

  const deleteMyAccount = async () => {
    const res = await deleteAccount(user.id);
    if (res.ok) await onLogout();
    return res;
  };
  const acceptTerms = () => updateProfile({ termsVersion: legal.version });

  const goTo = (v) => { setView(v); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  // Distinct from goTo("today"): a detail page's own "back" button means "return to
  // the day I was already looking at", but the nav's "Today" (and the logo) mean
  // literally today — without this, browsing a past day and clicking "Today" left
  // you stuck on that past date since only the view changed, never viewDate.
  const openReminderDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    setIsAdmin(false);
    setMobileOpen(false);
    setView("today");
    setViewDate(new Date(y, m - 1, d));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const goToToday = () => { setView("today"); setViewDate(TODAY_DATE); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const handlePDF = () => window.print();

  if (recovering) {
    return (
      <div className="app"><style>{CSS}</style>
        <ResetPasswordScreen onDone={finishRecovery} />
      </div>
    );
  }

  if (!authChecked || !content) {
    return (
      <div className="app"><style>{CSS}</style>
        <div className="main"><div className="page"><div className="skeleton-hero" /></div></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app"><style>{CSS}</style>
        <AccentOverride color={content.accentColor} />
        <AuthScreen onAuthed={onAuthed} />
      </div>
    );
  }

  const isCoach = user.role === "coach";
  if (!isCoach && access?.goaliesEnabled === false) {
    return (
      <div className="app"><style>{CSS}</style>
        <AccentOverride color={content.accentColor} />
        <ComingSoonScreen onLogout={onLogout} />
      </div>
    );
  }
  const experience = isCoach ? previewLevel : (EXPERIENCE_LEVELS.includes(user.experience) ? user.experience : "Junior");
  const assignment = trainingDayForDate(content, user, dateKey(viewDate), experience);
  const drill = assignment && planForLevel(content.drills.find((d) => d.id === assignment.drillId && d.published), experience);
  const focus = assignment && content.focusPoints.find((f) => f.id === assignment.focusId && f.published);
  const office = assignment && planForLevel(content.offIceWorkouts.find((o) => o.id === assignment.workoutId && o.published), experience);
  const dayType = resolveDayType(user, dateKey(viewDate));
  const reminders = getReminders(user);

  return (
    <MonthPlanContext.Provider value={{
      monthPlans: user.monthPlans || {},
      isGoalie: user.role !== "coach",
      setPlan: (key, mode) => updateProfile({ monthPlans: { ...(user.monthPlans || {}), [key]: mode } }),
    }}>
    <div className="app">
      <style>{CSS}</style>
      <AccentOverride color={content.accentColor} />

      {!isAdmin && (
        <NavBar
          view={view} setView={goTo} isAdmin={isAdmin} setIsAdmin={setIsAdmin} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
          user={user} onLogout={onLogout} previewLevel={previewLevel} setPreviewLevel={setPreviewLevel} dayType={dayType} viewingToday={dateKey(viewDate) === dateKey(TODAY_DATE)} onGoToday={goToToday}
          reminders={reminders} onOpenReminder={openReminderDate} onOpenCalendar={() => setNavCalendarOpen(true)} onOpenPlan={() => setPlanOpen(true)}
        />
      )}
      {isAdmin && (
        <div className="admin-topbar">
          <div className="nav-logo"><img src={LOGO_SRC} alt="10DTendy" className="brand-logo brand-logo--nav" /><span className="admin-badge">ADMIN</span></div>
          <button className="nav-admin-toggle nav-admin-toggle--active" onClick={() => setIsAdmin(false)}>Exit admin</button>
        </div>
      )}

      {saveFailed && (
        <div className="save-failed-banner no-print" role="alert">
          <AlertTriangle size={15} /> Your last change couldn't be saved, so the page was refreshed to match what is stored. Please make the change again.
          <button onClick={() => setSaveFailed(false)}>Dismiss</button>
        </div>
      )}
      <main className="main no-print">
        {isAdmin ? (
          <AdminApp content={content} updateContent={updateContent} saveContent={saveContent} />
        ) : (
          <>
            {(() => {
              const dateStr = dateKey(viewDate);
              const todayPage = dayType ? (
                <DayTypePage
                  type={dayType} data={(dayType === "game" ? content.gameDay : content.restDay) || {}}
                  viewDate={viewDate} canGoBack={canGoBack} canGoForward={canGoForward} onPrevDay={goPrevDay} onNextDay={goNextDay}
                  onClear={() => setDayType(dateStr, null)}
                  gameLog={(user.gameLogs || {})[dateStr]} onSaveGameLog={(log) => setGameLog(dateStr, log)}
                  restNote={(user.restNotes || {})[dateStr]} onSaveRestNote={(note) => setRestNote(dateStr, note)}
                  dayTypes={user.dayTypes || {}} onSetDayType={setDayType}
                  gameLogs={user.gameLogs || {}} restNotes={user.restNotes || {}}
                  onLogGame={setGameLog} onSetRestNote={setRestNote}
                />
              ) : (
                <TodayPage
                  content={content} progress={progress} viewDate={viewDate} assignment={assignment}
                  onMakeRest={!isCoach && viewDate.getDay() === 0 && (user.dayTypes || {})[dateStr] === "none" ? () => setDayType(dateStr, "rest") : undefined}
                  canGoBack={canGoBack} canGoForward={canGoForward} onPrevDay={goPrevDay} onNextDay={goNextDay}
                  openDrill={() => goTo("drill")} openFocus={() => goTo("focus")} openOffice={() => goTo("office")} onDownloadPDF={handlePDF}
                  dayTypes={user.dayTypes || {}} onSetDayType={setDayType}
                  gameLogs={user.gameLogs || {}} restNotes={user.restNotes || {}}
                  onLogGame={setGameLog} onSetRestNote={setRestNote}
                />
              );
              if (view === "drill") return drill ? <DrillDetailPage drill={drill} branding={content.branding} onBack={() => goTo("today")} complete={progress.drill} onComplete={() => toggleComplete("drill")} /> : todayPage;
              if (view === "focus") return focus ? <FocusDetailPage focus={focus} branding={content.branding} drills={content.drills} level={experience} onBack={() => goTo("today")} complete={progress.focus} onComplete={() => toggleComplete("focus")} /> : todayPage;
              if (view === "office") return office ? <OffIceDetailPage office={office} branding={content.branding} onBack={() => goTo("today")} complete={progress.office} onComplete={() => toggleComplete("office")} /> : todayPage;
              if (view === "progress") return <ProgressPage user={user} />;
              if (view === "profile") return <ProfilePage user={user} onLogout={onLogout} onChangePassword={changePassword} onUpdateProfile={updateProfile} onDeleteAccount={deleteMyAccount} />;
              return todayPage;
            })()}
          </>
        )}
      </main>

      <PrintSheet content={content} date={viewDate} assignment={assignment} />

      {!isAdmin && (
        <BottomNav
          view={view} onToday={goToToday} onGoTo={goTo} trainingDay={!dayType} onProgress={() => goTo("progress")}
          onOpenCalendar={() => setNavCalendarOpen(true)} showCalendar={!isCoach}
        />
      )}
      {planOpen && user.role !== "coach" && (
        <PreviewModal label={`Plan ${MONTH_NAMES[TODAY_DATE.getMonth()]}`} onClose={() => setPlanOpen(false)}>
          <MonthPlanPrompt
            monthName={MONTH_NAMES[TODAY_DATE.getMonth()]}
            current={(user.monthPlans || {})[dateKey(TODAY_DATE).slice(0, 7)]}
            onChoose={async (mode) => {
              const ok = await setMonthPlan(mode);
              if (ok) { setPlanOpen(false); if (mode === "own") setNavCalendarOpen(true); }
              return ok;
            }}
            onOpenCalendar={() => { setPlanOpen(false); setNavCalendarOpen(true); }}
            onLater={() => setPlanOpen(false)}
          />
        </PreviewModal>
      )}
      {navCalendarOpen && (
        <PreviewModal label="Games & Rest" onClose={() => setNavCalendarOpen(false)} resizeIn>
          <ProfileCalendar dayTypes={user.dayTypes || {}} onSetDayType={setDayType} onClose={() => setNavCalendarOpen(false)} gameLogs={user.gameLogs || {}} restNotes={user.restNotes || {}} onLogGame={setGameLog} onSetRestNote={setRestNote} />
        </PreviewModal>
      )}
      {welcomeOpen && <WelcomeModal label="Welcome" data={content.welcome || DEFAULT_WELCOME} onClose={markWelcomeSeen} />}
      {announcementOpen && <WelcomeModal label="Announcement" data={content.announcement} onClose={markAnnouncementSeen} />}
      {termsPending && <TermsUpdatePrompt updated={!!user.termsVersion} onAccept={acceptTerms} onLogout={onLogout} />}
    </div>
    </MonthPlanContext.Provider>
  );
}

/* ============================================================================
   STYLES
   ============================================================================ */

const CSS = `

:root {
  --bg: #0A0A0C;
  --surface: #131316;
  --surface-2: #1B1B1F;
  --border: #26262B;
  --text: #F3F3F1;
  --text-dim: #8D8D93;
  --text-faint: #5C5C61;
  --accent: #BE202E;
  --accent-dim: color-mix(in srgb, var(--accent) 16%, transparent);
  --radius: 14px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); height: 100%; overscroll-behavior-y: none; }
#root { min-height: 100%; }
.app { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; min-height: 100dvh; -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4 { font-family: 'Archivo', sans-serif; margin: 0; letter-spacing: -0.02em; }
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
input, select, textarea { font-family: inherit; }
a { color: inherit; }

/* Replaces the browser's default yellow/blue focus ring with a faint, static glow —
   neutral for text-entry fields, accent-red for buttons/pills (nearly everything
   clickable in this app, category pills included, renders as a <button>). Box-shadow
   follows each element's own border-radius, so the glow always traces its real shape.
   A few inputs (email/password/search) render inside an icon wrapper with no border
   of their own — the wrapper gets the glow via :focus-within so it traces that pill
   shape instead of the plain input's square edges. */
input:focus, select:focus, textarea:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.05), 0 0 6px 1px rgba(255,255,255,0.07);
}
.auth-input-icon input:focus { box-shadow: none; }
.auth-input-icon:focus-within {
  box-shadow: 0 0 0 3px rgba(255,255,255,0.05), 0 0 6px 1px rgba(255,255,255,0.07);
}
button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(190,32,46,0.10), 0 0 6px 1px rgba(190,32,46,0.12);
}
.label { font-size: 11px; letter-spacing: 0.10em; color: var(--text-dim); font-weight: 600; }
.dot { color: var(--text-faint); }

/* ---------------- AUTH ---------------- */
.auth-screen { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }
.auth-side { position: relative; background: linear-gradient(160deg, #10201d, #0A0A0C 65%); display: flex; align-items: center; padding: 60px; overflow: hidden; }
.auth-arc { position: absolute; right: -40px; bottom: -30px; width: 420px; }
.auth-badge { position: absolute; top: 50%; left: 50%; width: 560px; max-width: 70%; transform: translate(-50%, -50%) rotate(-8deg); opacity: 0.1; pointer-events: none; }
.auth-side-content { position: relative; z-index: 1; max-width: 420px; }
.auth-headline { font-size: 34px; font-weight: 900; line-height: 1.15; margin: 28px 0 14px; }
.auth-sub { color: var(--text-dim); font-size: 15px; line-height: 1.5; }
.auth-form-wrap { display: flex; align-items: center; justify-content: center; padding: 40px; }
.auth-form-card { width: 100%; max-width: 360px; }
.auth-tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 30px; padding: 4px; margin-bottom: 28px; }
.auth-tab { flex: 1; text-align: center; padding: 9px; border-radius: 26px; font-size: 13px; font-weight: 600; color: var(--text-dim); }
.auth-tab.active { background: var(--surface-2); color: var(--text); box-shadow: inset 0 0 0 1px var(--border); }
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.auth-field input, .auth-field select { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 11px 12px; color: var(--text); font-size: 14px; width: 100%; }
.auth-input-icon { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0 12px; }
.auth-input-icon svg { color: var(--text-faint); flex-shrink: 0; }
.auth-input-icon input { border: none; background: none; padding: 11px 0; flex: 1; }
.auth-invite-link { align-self: flex-start; font-size: 12px; color: var(--text-faint); text-decoration: underline; text-underline-offset: 2px; }
.auth-invite-link:hover { color: var(--text-dim); }
.auth-error { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #ff8a80; background: rgba(255,90,70,0.1); border: 1px solid rgba(255,90,70,0.3); border-radius: 8px; padding: 8px 10px; }
.auth-submit { width: 100%; justify-content: center; margin-top: 4px; }
.password-rules { list-style: none; margin: -4px 0 4px; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-dim); }
.password-rules li { display: flex; align-items: center; gap: 6px; }
.password-rules li.ok { color: #22C55E; }
.password-mismatch { font-size: 12px; color: #ef4444; }
.auth-reset-title { font-size: 20px; margin: 0; }
.auth-reset-sub { font-size: 14px; color: var(--text-dim); margin: 0 0 4px; }
.auth-check-email { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 20px 0; color: var(--text-dim); }
.auth-check-email h2 { color: var(--text); font-size: 18px; margin: 0; }
.auth-check-email p { font-size: 13px; line-height: 1.5; margin: 0 0 8px; }

/* ---------------- NAV ---------------- */
.nav { position: sticky; top: 0; z-index: 20; background: rgba(10,10,12,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
.nav-inner { max-width: 1280px; margin: 0 auto; padding: calc(16px + env(safe-area-inset-top)) 28px 16px; display: flex; align-items: center; justify-content: space-between; }
.nav-logo { display: flex; align-items: center; gap: 10px; font-family: 'Archivo'; font-weight: 900; font-size: 16px; letter-spacing: 0.02em; flex-shrink: 0; }
.brand-logo { display: block; width: auto; }
.brand-logo--nav { height: 20px; }
.brand-logo--auth { height: 26px; }
.brand-logo--print { height: 16px; }
.admin-badge { font-size: 11px; letter-spacing: 0.1em; color: var(--text-dim); font-weight: 600; }
.nav-links { display: flex; gap: 6px; }
.nav-link { padding: 8px 14px; border-radius: 20px; font-size: 14px; color: var(--text-dim); transition: all .18s ease; white-space: nowrap; flex-shrink: 0; }
.nav-link:hover { color: var(--text); }
.nav-link--active { color: var(--bg); background: var(--accent); font-weight: 600; }
.nav-right { display: flex; align-items: center; gap: 8px; }
.nav-admin-toggle { font-size: 12px; padding: 7px 12px; border-radius: 20px; border: 1px solid var(--border); color: var(--text-dim); transition: all .18s ease; }
.nav-admin-toggle:hover { border-color: var(--accent); color: var(--text); }
.nav-admin-toggle--active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.nav-level-select { font-size: 12px; padding: 6px 10px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim); }
.nav-mobile-level { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px; font-size: 13px; color: var(--text-dim); border-bottom: 1px solid var(--border); }
.nav-mobile-level select { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: var(--text); font-size: 13px; }
.nav-icon-btn { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-dim); transition: all .18s ease; font-size: 12px; font-weight: 700; }
.nav-icon-btn:hover { color: var(--text); background: var(--surface-2); }
.nav-avatar { background: var(--surface-2); color: var(--text); overflow: hidden; padding: 0; }
.nav-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.nav-avatar--active { box-shadow: 0 0 0 2px var(--accent); }
.nav-notif-wrap { position: relative; }
.nav-notif-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); }
.nav-notif-panel { position: fixed; top: 68px; right: 16px; width: 280px; max-width: calc(100vw - 32px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 12px 30px rgba(0,0,0,0.4); z-index: 50; overflow: hidden; }
.nav-notif-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; }
.nav-notif-empty { padding: 16px 14px; font-size: 13px; color: var(--text-dim); margin: 0; }
.nav-notif-list { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.nav-notif-list li { font-size: 13px; line-height: 1.4; padding: 10px; border-radius: 8px; background: var(--surface-2); }
.nav-notif-list li:has(.nav-notif-item) { padding: 0; }
.nav-notif-item { display: block; width: 100%; text-align: left; padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.4; color: var(--text); }
.nav-notif-item:hover { background: var(--accent-dim); }
.nav-mobile-toggle { display: none; }
.nav-mobile-panel { display: none; flex-direction: column; padding: 8px 20px 16px; gap: 2px; border-top: 1px solid var(--border); }
.bottom-nav { display: none; position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(14px + env(safe-area-inset-bottom)); z-index: 30; gap: 2px; padding: 6px; border-radius: 999px; background: rgba(24,24,28,0.82); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.bottom-nav-btn { width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--text-dim); transition: background .15s ease, color .15s ease; }
.bottom-nav-btn--active { color: var(--text); background: rgba(255,255,255,0.12); }
.nav-mobile-profile { display: flex; align-items: center; gap: 10px; }
.nav-mobile-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--surface-2); color: var(--text); font-size: 11px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; }
.nav-mobile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.nav-mobile-link.nav-mobile-link--active { color: var(--accent); }
.nav-mobile-link { text-align: left; padding: 12px 8px; font-size: 15px; color: var(--text-dim); border-bottom: 1px solid var(--border); }

/* Transitions.dev — Icon swap */
:root {
  --icon-swap-dur: 250ms;
  --icon-swap-blur: 2px;
  --icon-swap-start-scale: 0.25;
  --icon-swap-ease: ease-in-out;
}
.t-icon-swap {
  position: relative;
  display: inline-grid;
}
.t-icon-swap .t-icon {
  grid-area: 1 / 1;
  transition:
    opacity   var(--icon-swap-dur) var(--icon-swap-ease),
    filter    var(--icon-swap-dur) var(--icon-swap-ease),
    transform var(--icon-swap-dur) var(--icon-swap-ease);
  will-change: opacity, filter, transform;
}
.t-icon-swap[data-state="a"] .t-icon[data-icon="a"],
.t-icon-swap[data-state="b"] .t-icon[data-icon="b"] {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
}
.t-icon-swap[data-state="a"] .t-icon[data-icon="b"],
.t-icon-swap[data-state="b"] .t-icon[data-icon="a"] {
  opacity: 0;
  filter: blur(var(--icon-swap-blur));
  transform: scale(var(--icon-swap-start-scale));
}
@media (prefers-reduced-motion: reduce) {
  .t-icon-swap .t-icon { transition: none !important; }
}
.admin-topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: calc(16px + env(safe-area-inset-top)) 28px 16px; border-bottom: 1px solid var(--border); background: var(--bg); }

/* ---------------- LAYOUT ---------------- */
.main { max-width: 1280px; margin: 0 auto; padding: 0 28px calc(80px + env(safe-area-inset-bottom)); }
.page { padding-top: 40px; }
.detail { max-width: 760px; margin: 0 auto; padding-top: 32px; }
.back-link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-dim); margin-bottom: 28px; }
.back-link:hover { color: var(--text); }

/* ---------------- HERO ---------------- */
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
.eyebrow { font-size: 12px; letter-spacing: 0.10em; color: var(--accent); font-weight: 600; margin-bottom: 14px; }
.eyebrow-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.eyebrow-row .eyebrow { margin-bottom: 0; }
.daytype-eyebrow-stack { display: inline-flex; align-items: baseline; gap: 0; line-height: 1.3; }
.day-nav-badge { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint); background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
.hero-title { font-size: 44px; font-weight: 900; line-height: 1.02; }
.hero-sub { color: var(--text-dim); font-size: 16px; margin-top: 10px; }
.ticket-ring-wrap { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
.ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-count { font-family: 'Archivo'; font-weight: 900; font-size: 14px; }
.ring-caption { font-size: 8px; color: var(--text-dim); letter-spacing: 0.06em; margin-top: 1px; }
.hero--progress { margin-bottom: 48px; }

/* ---------------- BENTO ---------------- */
.bento { display: grid; grid-template-columns: 1.6fr 1fr; grid-template-rows: auto auto; gap: 18px; margin-bottom: 20px; }
.card { text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; position: relative; overflow: hidden; transition: transform .22s ease, border-color .22s ease; }
.card:hover { transform: translateY(-3px); border-color: #34343a; }
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; position: relative; z-index: 1; }
/* The big card on the right (today: the off-ice workout), spanning both rows. */
.card--feature {
  grid-column: 2; grid-row: 1 / 3; display: flex; flex-direction: column;
  background:
    radial-gradient(460px 320px at 100% 100%, rgba(190,32,46,0.16), transparent 62%),
    radial-gradient(280px 200px at 0% 0%, rgba(255,255,255,0.035), transparent 70%),
    linear-gradient(165deg, #17171b 0%, var(--surface) 55%, #0d0d0f 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 44px -24px rgba(0,0,0,0.55);
}
.card--feature:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 54px -22px rgba(0,0,0,0.6); }
.card-badge { position: absolute; right: -46px; bottom: -34px; width: 240px; height: auto; z-index: 0; opacity: 0.18; transform: rotate(-14deg); pointer-events: none; }
.card-visual { height: 180px; border-radius: 10px; background: linear-gradient(160deg, var(--surface-2), #0d0d0f); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; position: relative; z-index: 1; overflow: hidden; }
.card-visual--feature { color: var(--text-faint); height: auto; min-height: 200px; flex: 1 1 200px; }
.card-visual--compact { height: 120px; margin-bottom: 12px; }
.media-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.card-title { font-size: 20px; font-weight: 700; }
.card-desc { color: var(--text-dim); font-size: 14px; line-height: 1.5; }
.meta-row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-dim); margin: 4px 0; }
.meta-row--lg { font-size: 14px; margin-top: 14px; }
.card-cta { margin-top: auto; font-size: 14px; font-weight: 600; color: var(--accent); padding-top: 8px; position: relative; z-index: 1; }
.card-cta--light { color: var(--text); }
.chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 20px; background: var(--accent-dim); color: var(--accent); font-weight: 600; }
.card--focus { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; background: var(--surface); position: relative; }
.card-photo-bg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.card-photo-scrim { position: absolute; inset: 0; z-index: 0; background: linear-gradient(200deg, rgba(10,10,12,0.55) 10%, rgba(10,10,12,0.94) 85%); }
.focus-quote { font-family: 'Archivo'; font-size: 24px; font-weight: 700; line-height: 1.2; margin: 12px 0 auto; position: relative; z-index: 1; }
.daytype-quote { font-family: 'Archivo'; font-style: italic; font-size: 19px; font-weight: 700; color: var(--accent); margin-top: 14px; }
/* A wide, short strip rather than the photo's own (much taller) native shape — this
   is a plain atmospheric backdrop with nothing centered that needs to stay fully in
   frame, so cropping top/bottom via object-fit:cover to hit this ratio is fine. */
.daytype-banner { position: relative; border-radius: var(--radius); overflow: hidden; aspect-ratio: 3.5; margin-bottom: 28px; }
.daytype-banner img { width: 100%; height: 100%; object-fit: cover; object-position: center bottom; display: block; }
.daytype-card { padding: 28px; margin-bottom: 20px; }
.daytype-empty { color: var(--text-dim); font-size: 14px; margin: 0 0 14px; }
.daytype-note { margin-top: 18px; font-size: 15px; font-weight: 500; white-space: pre-line; overflow-wrap: anywhere; }
.note-history { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.note-history-item { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; min-width: 0; }
.note-history-text { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: var(--text); white-space: pre-line; overflow-wrap: anywhere; max-height: 9em; overflow-y: auto; }
.note-history-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--text-faint); }
.daytype-notes-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.daytype-clear { width: 100%; justify-content: center; }
.restnote-hint { display: flex; justify-content: space-between; gap: 12px; }
.restnote-hint span:last-child { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.gamelog-opponent-row { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px; align-items: end; }
@media (min-width: 641px) { .gamelog-opponent-row { grid-template-columns: minmax(0, 1fr) 190px; } }
.gamelog-opponent-row--single { grid-template-columns: minmax(0, 1fr); }
.restnote-textarea { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; color: var(--text); font-size: 14px; font-family: inherit; resize: vertical; margin-top: 6px; }
.restnote-text { font-size: 15px; line-height: 1.5; margin: 0; white-space: pre-wrap; }

.gamelog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }
.gamelog-toggle-row { display: flex; gap: 8px; }
.gamelog-dressed { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; }
.gamelog-dressed input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.gamelog-dressed-track { flex-shrink: 0; position: relative; width: 38px; height: 22px; margin-top: 1px; border-radius: 11px; background: var(--border); transition: background 0.15s; }
.gamelog-dressed-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--text); transition: transform 0.15s; }
.gamelog-dressed input:checked + .gamelog-dressed-track { background: var(--accent); }
.gamelog-dressed input:checked + .gamelog-dressed-track::after { transform: translateX(16px); }
.gamelog-dressed input:focus-visible + .gamelog-dressed-track { outline: 2px solid var(--accent); outline-offset: 2px; }
.gamelog-dressed-text { display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
.gamelog-dressed-text strong { font-weight: 600; color: var(--text); }
.gamelog-dressed-text small { font-size: 12px; color: var(--text-dim); }
.gamelog-dressed-chip { margin-left: auto; }
.gameperf-dressed { color: var(--text-dim); font-style: italic; }
.gamelog-toggle { flex: 1; padding: 9px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim); font-size: 13px; font-weight: 600; text-align: center; }
.gamelog-toggle.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.gamelog-summary { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
.gamelog-summary-row { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; }
.gamelog-opponent { color: var(--text); }
.gamelog-score { color: var(--text-dim); font-weight: 700; margin-left: auto; }
.gamelog-stats-row { flex-wrap: wrap; gap: 20px; }
.gamelog-result-badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 9px; border-radius: 20px; }
.gamelog-result-badge--win { background: rgba(76,199,150,0.16); color: #4cd7a3; }
.gamelog-result-badge--loss { background: var(--accent-dim); color: var(--accent); }
.gamelog-result-badge--tie { background: var(--surface-2); color: var(--text-dim); }
.gamelog-periods { display: flex; flex-direction: column; gap: 10px; }
.gamelog-periods-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.gamelog-periods-table { display: flex; flex-direction: column; gap: 8px; }
.gamelog-periods-row { display: grid; grid-template-columns: 1fr 80px 80px; gap: 10px; align-items: center; }
.gamelog-periods-row--head { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }
.gamelog-periods-label { font-size: 13px; color: var(--text-dim); }
.gamelog-periods-row input { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 13px; width: 100%; }
.gamelog-periods-total { font-size: 13px; color: var(--text-dim); margin: 0; }
.gamelog-periods-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.gamelog-periods-summary-chip { font-size: 12px; color: var(--text-dim); background: var(--surface-2); border-radius: 20px; padding: 4px 10px; }

.progress-client-switcher { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
.progress-client-label { font-size: 12px; color: var(--text-faint); }
.progress-client-loading { font-size: 13px; color: var(--text-dim); }
.progress-client-switcher select { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; color: var(--text); font-size: 14px; font-weight: 600; }
.gameperf-block { margin-top: 44px; }
.gameperf-charts-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 28px; }
.gameperf-chart { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; }
.gameperf-chart-title { font-size: 13px; color: var(--text-dim); margin-bottom: 10px; }
.gameperf-record { display: flex; flex-direction: column; gap: 6px; }
.period-rings-row { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; padding: 10px 0; }
.period-ring { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.period-ring-name { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
.period-ring-shots { font-size: 11px; color: var(--text-faint); }
.save-ring-visual { position: relative; flex-shrink: 0; }
.save-ring-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.save-ring-pct { font-family: 'Archivo'; font-weight: 900; font-size: 15px; }
.gameperf-summary-row { display: flex; align-items: center; gap: 20px; }
.gameperf-summary-gaa { display: flex; flex-direction: column; }
.gameperf-summary-gaa-num { font-family: 'Archivo'; font-weight: 900; font-size: 26px; line-height: 1; }
.gameperf-summary-gaa-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
.chart-svg { width: 100%; height: auto; display: block; }
.chart-gridline { stroke: var(--border); stroke-width: 1; }
.chart-line { stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.chart-dot { fill: var(--accent); }
.chart-line--ga { stroke: var(--text-dim); }
.chart-dot--ga { fill: var(--text-dim); }
.chart-axis-label { font-size: 20px; fill: var(--text-faint); }
.chart-legend { display: flex; gap: 16px; font-size: 11px; color: var(--text-dim); margin-top: 8px; }
.chart-legend span { display: flex; align-items: center; gap: 6px; }
.chart-legend-swatch { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.chart-legend-swatch--save { background: var(--accent); }
.chart-legend-swatch--ga { background: var(--text-dim); }
.chart-empty { font-size: 13px; color: var(--text-faint); padding: 30px 0; text-align: center; }
.gameperf-table-wrap { overflow-x: auto; }
.focus-glow { height: 2px; width: 60px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 16px 2px var(--accent); margin: 20px 0 14px; position: relative; z-index: 1; }
.card--compact { grid-column: 1; grid-row: 2; display: flex; flex-direction: column; gap: 4px; }

/* ---------------- TICKET ---------------- */
.ticket { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 30px; gap: 30px; margin-bottom: 20px; }
.ticket--empty { padding: 12px 16px; }
/* Desktop: title left, training-day bar right (a long title pushes the bar underneath). */
@media (min-width: 1180px) {
  .today-top { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 28px; margin-bottom: 20px; }
  .today-top > .hero { flex: 1 1 360px; min-width: 0; margin-bottom: 0; }
  .today-top > .ticket { flex: 0 1 auto; margin-bottom: 0; padding: 16px 22px; gap: 22px; }
  .today-top > .ticket--empty { padding: 12px 16px; }
  .today-top .ticket-list { gap: 14px; }
  .today-top .ticket-left h4, .today-top .ticket-right h4 { margin-bottom: 10px; }
  .today-top .ticket-right { gap: 20px; }
  .today-top .ticket-pdf-word { display: none; }
}
@media (min-width: 1180px) and (max-width: 1379px) {
  .today-top .hero-title { font-size: 38px; }
}
.ticket-left h4, .ticket-right h4 { font-size: 13px; letter-spacing: 0.06em; color: var(--text-dim); font-weight: 600; margin-bottom: 12px; text-transform: uppercase; }
.ticket-list { list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; }
.ticket-list li { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-faint); }
.ticket-list li svg { opacity: 0.3; }
.ticket-list li.done { color: var(--text); }
.ticket-list li.done svg { color: var(--accent); opacity: 1; }
.ticket-divider { width: 1px; align-self: stretch; background: var(--border); }
.ticket-right { display: flex; align-items: flex-end; gap: 24px; flex: 1; }
.ticket-download-btn { margin-left: auto; }
.ticket-calendar-group { display: flex; flex-direction: column; align-items: center; }

/* ---------------- BUTTONS ---------------- */
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 22px; border-radius: 30px; font-size: 14px; font-weight: 600; transition: all .18s ease; white-space: nowrap; }
.btn--primary { background: var(--accent); color: #fff; }
.btn--primary:hover { filter: brightness(1.08); }
.btn--primary:disabled { opacity: 0.6; cursor: default; }
.btn--ghost { border: 1px solid var(--border); color: var(--text-dim); }
.btn--ghost:hover { color: var(--text); border-color: #3a3a40; }
.btn--small { padding: 9px 16px; font-size: 13px; }
.btn--complete { width: 100%; justify-content: center; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 16px; border-radius: 30px; margin-top: 12px; font-size: 15px; }
.btn--complete:hover { border-color: var(--accent); }
.btn--complete-done { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

/* ---------------- DETAIL PAGES ---------------- */
.detail-header { margin-bottom: 32px; }
.detail-banner { position: relative; border-radius: var(--radius); overflow: hidden; height: 220px; margin-bottom: 28px; }
.detail-banner-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,12,0.05), rgba(10,10,12,0.75)); }
.detail-title { font-size: 32px; font-weight: 900; margin-top: 8px; }
.detail-block { margin-bottom: 32px; }
.detail-block h2 { font-size: 16px; margin-bottom: 12px; }
.detail-block p { color: var(--text-dim); line-height: 1.65; font-size: 15px; white-space: pre-wrap; }
.detail-block ul, .detail-block ol { color: var(--text-dim); line-height: 1.65; font-size: 15px; margin: 0 0 12px; padding-left: 22px; }
.detail-block ul:last-child, .detail-block ol:last-child { margin-bottom: 0; }
.detail-block strong { color: var(--text); }
.exercise-instructions ul, .exercise-instructions ol { margin: 0; padding-left: 20px; }
.exercise-instructions strong { color: var(--text); }
.steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
.steps li { display: flex; gap: 14px; align-items: flex-start; font-size: 15px; color: var(--text-dim); line-height: 1.5; }
.step-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text); }
.chip-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.cue-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; font-size: 14px; color: var(--text); line-height: 1.4; }
.mistake-list { display: flex; flex-direction: column; gap: 10px; }
.mistake-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border-radius: 10px; overflow: hidden; }
.mistake-col { background: var(--surface); padding: 14px 16px; }
.mistake-label { font-size: 10px; letter-spacing: 0.08em; color: var(--text-faint); text-transform: uppercase; }
.mistake-col p { margin: 6px 0 0; font-size: 14px; color: var(--text-dim); }
.mistake-col--right p { color: var(--accent); opacity: 0.9; }
.cue-highlight { background: var(--accent-dim); border: 1px solid var(--accent); border-radius: 12px; padding: 18px 20px; font-size: 17px; font-weight: 600; color: var(--text); }
.focus-block-image { width: 100%; display: block; border-radius: var(--radius); margin-bottom: 28px; }
.focus-hero { margin-bottom: 36px; position: relative; }
.focus-hero-title { font-size: 34px; font-weight: 900; line-height: 1.15; margin-top: 14px; max-width: 520px; }
.focus-hero-glow { height: 2px; width: 70px; background: var(--accent); box-shadow: 0 0 18px 2px var(--accent); margin-top: 22px; border-radius: 2px; }
.exercise-list { display: flex; flex-direction: column; gap: 10px; }
.exercise-row { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
/* Room for the sticky header when an opened exercise / drill card is scrolled to the top. */
.exercise-row, .focus-drill-card { scroll-margin-top: 84px; }
.content-preview-panel .exercise-row, .content-preview-panel .focus-drill-card { scroll-margin-top: 64px; }
.exercise-head { width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px; text-align: left; }
/* .exercise-row clips (overflow:hidden, rounded corners) so the accordion panel below can
   collapse to nothing — the site-wide button:focus glow (button:focus, ~line 5314) spills
   outward past the button's own edges, so on this button specifically it gets clipped into a
   flat red line right where the header meets the panel. Drawing it inset keeps a real focus
   ring without anything escaping the button to get clipped. */
.exercise-head:focus { box-shadow: inset 0 0 0 2px rgba(190,32,46,0.35); }
.exercise-thumb { width: 38px; height: 38px; border-radius: 8px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; overflow: hidden; }
.exercise-info { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.exercise-name { font-size: 15px; font-weight: 600; }
.exercise-sets { font-size: 13px; color: var(--text-dim); }
.exercise-chevron { color: var(--text-faint); flex-shrink: 0; }
.exercise-expanded { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }

/* Transitions.dev — Accordion expand. Toggle data-open on .t-acc; the panel animates via
   grid-template-rows 0fr <-> 1fr (no JS height measuring) and the chevron flips vertically
   (scaleY) from a "v" to a "^". */
:root {
  --acc-expand: 250ms;
  --acc-collapse: 250ms;
  --acc-chevron: 250ms;
  --acc-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
.t-acc-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--acc-collapse) var(--acc-ease);
}
.t-acc[data-open="true"] .t-acc-panel {
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--acc-expand) var(--acc-ease);
}
.t-acc-panel-inner {
  overflow: hidden;
  opacity: 0;
  filter: blur(2px);
  transition: opacity var(--acc-collapse) var(--acc-ease), filter var(--acc-collapse) var(--acc-ease);
}
.t-acc[data-open="true"] .t-acc-panel-inner {
  opacity: 1;
  filter: blur(0);
  transition: opacity var(--acc-expand) var(--acc-ease), filter var(--acc-expand) var(--acc-ease);
}
.t-acc-chevron {
  display: inline-flex;
  transform: scaleY(1);
  transform-origin: center;
  transition: transform var(--acc-chevron) var(--acc-ease);
}
.t-acc-chevron path { vector-effect: non-scaling-stroke; }
.t-acc[data-open="true"] .t-acc-chevron { transform: scaleY(-1); }
@media (prefers-reduced-motion: reduce) {
  .t-acc-panel, .t-acc-panel-inner, .t-acc-chevron { transition: none !important; }
}
.exercise-media { border-radius: 10px; overflow: hidden; background: var(--surface-2); }
.exercise-media-img { width: 100%; height: auto; max-height: 340px; object-fit: contain; display: block; border-radius: 8px; }
.exercise-media-video { width: 100%; max-height: 260px; display: block; }
.exercise-media-youtube { position: relative; width: 100%; aspect-ratio: 16/9; }
.exercise-instructions { font-size: 14px; color: var(--text-dim); line-height: 1.5; margin: 0; white-space: pre-wrap; }

/* ---------------- PROFILE ---------------- */
.profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 36px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.profile-avatar-wrap { position: relative; margin-bottom: 14px; }
.profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--accent-dim); color: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Archivo'; font-weight: 900; font-size: 22px; overflow: hidden; }
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-avatar-remove { margin: -2px 0 4px; }
.profile-email { color: var(--text-dim); font-size: 14px; margin-bottom: 20px; }
.profile-grid { display: flex; gap: 36px; margin-bottom: 28px; }
.profile-grid > div { display: flex; flex-direction: column; gap: 4px; }
.profile-value { font-size: 15px; font-weight: 600; }
.profile-password-form { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 14px; margin: 4px 0; text-align: left; }
.profile-password-success { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7cd992; background: rgba(60,200,120,0.12); border: 1px solid rgba(60,200,120,0.3); border-radius: 8px; padding: 8px 10px; }

/* ---------------- VIDEO ---------------- */
.video { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 28px; }
.video--youtube { position: relative; aspect-ratio: 16/9; }
.video-native { width: 100%; aspect-ratio: 16/9; display: block; background: #000; }

/* ---------------- PROGRESS ---------------- */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 44px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 6px; }
.stat-num { font-family: 'Archivo'; font-weight: 900; font-size: 26px; }
.stat-label { font-size: 12px; color: var(--text-dim); }
.calendar-block h2 { font-size: 15px; margin-bottom: 16px; }
.progress-overview-row { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
.progress-heat-col { flex: 0 1 340px; min-width: 0; }
/* Height matches .heat-grid's own rendered height at its 340px max-width (5 rows of
   square cells: (340px - 6*6px gaps) / 7 columns = ~43.4px cells, ×5 + 4×6px gaps). */
/* margin-top pushes this down to start level with .heat-grid instead of the "Last 5
   weeks" heading above it (that heading is 16px tall with a 16px margin-bottom). */
.progress-stats-col { flex: 0 1 340px; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 32px; margin-bottom: 0; height: 241px; }
.heat-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; max-width: 340px; margin-bottom: 16px; }
.heat-cell { width: 100%; aspect-ratio: 1; border-radius: 5px; }
.heat-cell--none { background: var(--surface-2); }
.heat-cell--partial { background: var(--accent-dim); }
.heat-cell--full { background: var(--accent); }
.heat-cell--game { background: var(--text-dim); }
.heat-cell--rest { background: #4cd7a3; }
.heat-legend { display: flex; gap: 18px; font-size: 12px; color: var(--text-dim); align-items: center; flex-wrap: wrap; }
.heat-legend span { display: flex; align-items: center; gap: 6px; }
.heat-legend i.heat-cell { width: 11px; height: 11px; display: inline-block; }

/* ---------------- ADMIN ---------------- */
.admin-shell { display: flex; max-width: 1280px; margin: 0 auto; min-height: calc(100vh - 66px); }
.admin-sidebar { width: 210px; flex-shrink: 0; padding: 24px 12px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--border); }
.admin-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; font-size: 13px; color: var(--text-dim); text-align: left; }
.admin-nav-item:hover { color: var(--text); background: var(--surface); }
.admin-nav-item.active { color: var(--accent); background: var(--accent-dim); }
.save-failed-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 16px 0; padding: 10px 14px; border-radius: 10px; background: rgba(239,68,68,0.14); color: #ef4444; font-size: 13px; }
.save-failed-banner button { margin-left: auto; color: inherit; text-decoration: underline; }
.training-block-search { display: flex; align-items: center; gap: 10px; padding: 0 14px; margin-bottom: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; color: var(--text-dim); }
.training-block-search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; padding: 13px 0; color: var(--text); font-size: 14px; }
.training-block-search-count { font-size: 12px; white-space: nowrap; }
.drill-diagram { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); }
.month-plan { display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.month-plan-inline { display: flex; flex-direction: column; gap: 10px; margin: 0 0 16px; padding: 14px; border-radius: 12px; border: 1px solid var(--accent); background: var(--surface-2); }
.month-plan-q { font-size: 16px; margin: 8px 0 0; }
.month-plan-option { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.month-plan-option span { font-size: 13px; color: var(--text-dim); }
.month-plan-option--active { border-color: var(--accent); }
.month-plan-row { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
.month-plan-toggle { display: inline-flex; padding: 4px; gap: 4px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); align-self: flex-start; }
.month-plan-toggle button { padding: 8px 14px; border-radius: 999px; font-size: 13px; color: var(--text-dim); }
.month-plan-toggle button.active { background: var(--accent); color: #fff; }
.training-block-head { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.training-block-title { color: var(--text-dim); font-weight: 500; }
.training-block-date { font-size: 12px; color: var(--text-dim); }
.training-day-card .planner-header { align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.training-block-save { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.admin-nav-item--red { font-weight: 700; color: #F0454B; }
.admin-nav-item--red:hover { color: #FF6B70; }
.admin-nav-item--red.active { color: #F0454B; background: rgba(240,69,75,0.14); }
.admin-nav-item--bold { font-weight: 700; color: #F5B841; }
.admin-nav-item--bold:hover { color: #FFD27A; }
.admin-nav-item--bold.active { color: #F5B841; background: rgba(245,184,65,0.14); }
.admin-content { flex: 1; padding: 32px; min-width: 0; max-width: 100%; }
.admin-h1 { font-size: 26px; font-weight: 900; margin-bottom: 24px; }
.admin-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.admin-header-row .admin-h1 { margin-bottom: 0; }
.stats-grid--admin { margin-bottom: 28px; }
.admin-panel, .admin-form { min-width: 0; max-width: 100%; }
.admin-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; margin-bottom: 24px; }
.admin-panel h3 { font-size: 14px; margin-bottom: 14px; }
.assign-row { display: flex; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.assign-row:last-child { border-bottom: none; }
.assign-label { width: 90px; color: var(--text-dim); }
.admin-form { background: var(--surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; }
.admin-form h3 { font-size: 14px; margin-bottom: 14px; }
.admin-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.admin-form-grid > * { min-width: 0; }
.admin-form-grid input, .admin-form-grid select, .admin-form-grid textarea { width: 100%; min-width: 0; max-width: 100%; }
.admin-form-span2 { grid-column: 1 / -1; }
.admin-form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.admin-form-grid input, .admin-form-grid select, .admin-form-grid textarea { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
.admin-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
/* A plain div, not a <label> — a <label> wrapping the toolbar's buttons as well as the editable
   text would make the browser forward any click inside it (including on the text itself) to the
   first labelable descendant, i.e. the Bold button, stealing focus right back off the field. */
.rich-field-wrap { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.rich-field-label { font-size: 12px; color: var(--text-dim); }
.rich-text-field { width: 100%; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-2); }
.exercise-editor-instructions .rich-text-field { background: var(--surface); }
.rich-text-toolbar { display: flex; gap: 2px; padding: 4px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); }
.rich-text-btn { width: 26px; height: 24px; border-radius: 5px; color: var(--text-dim); font-size: 13px; display: flex; align-items: center; justify-content: center; }
.rich-text-btn:hover { background: var(--surface); color: var(--text); }
.rich-text-btn--i em { font-style: italic; }
.rich-text-input { padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; line-height: 1.5; min-height: 64px; max-height: 260px; overflow-y: auto; outline: none; }
.rich-text-input:empty::before { content: attr(data-placeholder); color: var(--text-dim); opacity: 0.7; }
.rich-text-input ul { margin: 0; padding-left: 20px; }
.rich-text-input p { margin: 0 0 6px; }
.rich-text-input p:last-child { margin-bottom: 0; }
.training-day-copy { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 10px; }
.training-day-copy label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.training-day-copy select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; }
.training-day-copy .planner-hint { margin: 0; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th { text-align: left; padding: 10px 12px; color: var(--text-faint); font-weight: 500; border-bottom: 1px solid var(--border); font-size: 11px; letter-spacing: 0.04em; }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--border); color: var(--text-dim); }
.admin-table tr:last-child td { border-bottom: none; }
.admin-row-actions { display: flex; gap: 6px; }
.admin-filter-row { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.admin-search { flex: 1; min-width: 200px; }
.admin-filter-select { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 0 12px; color: var(--text); font-size: 14px; }
.category-add-row { display: flex; flex-wrap: wrap; gap: 10px; }
.category-add-input { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; }
.category-group { margin-bottom: 28px; }
.category-group-title { font-size: 14px; color: var(--text-dim); margin-bottom: 12px; }
.icon-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--text-dim); border-radius: 6px; }
.icon-btn:hover { color: var(--text); background: var(--surface-2); }
.icon-btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.status-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--surface-2); color: var(--text-faint); }
.status-pill--live { background: var(--accent-dim); color: var(--accent); }
.calendar-admin { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; }
.calendar-admin-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px; font-size: 13px; font-weight: 600; }
.calendar-admin-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.calendar-admin-dow { text-align: center; font-size: 10px; color: var(--text-faint); padding-bottom: 6px; }
.calendar-admin-cell { aspect-ratio: 1; border-radius: 8px; font-size: 12px; color: var(--text-dim); display: flex; align-items: center; justify-content: center; }
.calendar-admin-cell:hover { background: var(--surface-2); }
.calendar-admin-cell.assigned { background: var(--accent-dim); color: var(--accent); }
.calendar-admin-cell.selected { outline: 2px solid var(--accent); }
.profile-calendar { max-width: 760px; margin: 24px auto 0; text-align: left; }
.profile-calendar-title { font-size: 16px; margin-bottom: 6px; }
.daytype-cell--game { background: var(--accent-dim); color: var(--accent); }
.daytype-cell--rest { background: rgba(76,199,150,0.16); color: #4cd7a3; }
.calendar-admin-grid--rich .calendar-admin-cell { aspect-ratio: auto; height: 46px; flex-direction: column; justify-content: center; gap: 1px; padding: 2px; overflow: hidden; }
.calendar-cell-day { line-height: 1; }
.calendar-cell-caption { font-size: 8px; font-weight: 700; line-height: 1; opacity: 0.85; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.calendar-cell-caption--rest { text-transform: none; font-weight: 500; }
.profile-calendar-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.profile-calendar-footer { margin-top: 20px; }
.profile-calendar-footer .btn { width: 100%; justify-content: center; }
.profile-calendar-selected { font-size: 13px; color: var(--text-dim); }
.profile-calendar-buttons { display: flex; gap: 8px; }
.profile-calendar-log-btn { margin-top: 12px; }
.profile-calendar-restnote { margin-top: 12px; }
.profile-calendar-restnote .restnote-text { margin: 0; }
.profile-calendar-restnote .profile-calendar-log-btn { margin-top: 8px; }
.profile-calendar-gamelog { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.planner-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 6px; }
.planner-header h3 { margin: 0; }
.planner-hint { font-size: 12px; color: var(--text-faint); margin: 0 0 18px; }
.plan-level-bar { display: flex; flex-direction: column; gap: 10px; margin: 4px 0 14px; }
.plan-level-bar .level-tabs { align-self: flex-start; }
.plan-level-status { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); font-size: 13px; color: var(--text-dim); }
.plan-level-status strong { color: var(--text); font-weight: 600; }
.plan-level-status--own { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface-2)); }
.planner-level-note { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); margin: 8px 0 0; }
.level-tabs { display: flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 3px; }
.level-tab { position: relative; padding: 7px 14px; border-radius: 16px; font-size: 12px; font-weight: 600; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
.level-tab.active { background: var(--accent); color: #fff; }
.level-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.level-tab.active .level-tab-dot { background: #fff; }
.planner-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.planner-grid select { width: 100%; min-width: 0; }
.planner-section { display: flex; flex-direction: column; gap: 8px; }
.planner-section-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
.category-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
.category-pill { font-size: 11px; padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border); color: var(--text-dim); background: var(--surface-2); }
.category-pill.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.planner-empty-hint { font-size: 11px; color: var(--text-faint); margin: 0; }
.planner-section select, .planner-section textarea, .planner-section input { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
.dashboard-level-block { margin-bottom: 18px; }
.dashboard-level-block:last-child { margin-bottom: 0; }
.dashboard-level-title { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
.usage-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.usage-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; font-size: 13px; }
.usage-label { font-weight: 600; }
.usage-figures { color: var(--text-dim); }
.usage-figures strong { color: var(--text); }
.usage-track { height: 10px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.usage-fill { height: 100%; border-radius: 999px; transition: width .4s ease; }
.usage-fill--ok { background: #22C55E; }
.usage-fill--warn { background: #F5B841; }
.usage-fill--danger { background: #EF4444; }
.usage-note { font-size: 12px; color: var(--text-dim); }
.dashboard-health-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.dashboard-health-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.dashboard-health-head { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.dashboard-health-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dashboard-health-dot--ok { background: #4cd7a3; box-shadow: 0 0 8px 1px rgba(76,199,150,0.5); }
.dashboard-health-dot--warn { background: var(--accent); box-shadow: 0 0 8px 1px rgba(190,32,46,0.5); }
.dashboard-health-sub { display: block; margin-top: 4px; font-size: 12px; color: var(--text-dim); }
.dashboard-health-days { font-size: 12px; color: var(--text-dim); }
.upload-dropzone { width: 100%; border: 1px dashed var(--border); border-radius: var(--radius); padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-dim); margin-bottom: 24px; }
.upload-dropzone:disabled { opacity: 0.6; pointer-events: none; }
.upload-dropzone:hover { border-color: var(--accent); color: var(--text); }
.upload-dropzone-hint { font-size: 11px; color: var(--text-faint); }
.upload-dropzone > * { pointer-events: none; }
.upload-dropzone--dragging, .upload-dropzone--dragging:hover { border-style: solid; border-color: var(--accent); background: var(--accent-dim); color: var(--text); }
.file-drop-area { position: relative; }
.file-drop-overlay { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 2px solid var(--accent); border-radius: var(--radius); background: rgba(10,10,12,0.82); color: var(--text); font-size: 14px; font-weight: 600; pointer-events: none; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
.media-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-bottom: 16px; }
.media-toolbar .level-tabs { display: inline-flex; }
.media-search { flex: 1; min-width: 180px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 13px; font-family: inherit; }
.media-total { font-size: 12px; color: var(--text-dim); }
.media-thumb-link { display: block; width: 100%; }
.upload-or-library { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; }
.upload-or-library .upload-dropzone { width: 100%; }
.library-pick-link { display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 12px; color: var(--text-dim); text-decoration: underline; text-underline-offset: 2px; }
.library-pick-link:hover:not(:disabled) { color: var(--text); }
.library-pick-link:disabled { opacity: 0.5; cursor: default; }
.media-picker { display: flex; flex-direction: column; gap: 14px; }
.media-picker .media-search { flex: none; width: 100%; }
.media-picker-tile { cursor: pointer; text-align: center; color: var(--text); transition: border-color .15s ease; }
.media-picker-tile:hover, .media-picker-tile:focus-visible { border-color: var(--accent); }
.media-uses-line { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; color: var(--text-dim); }
.media-uses { list-style: none; margin: 0; padding: 0; width: 100%; font-size: 10.5px; line-height: 1.4; color: var(--text-dim); text-align: center; }
.media-uses li { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-tile { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--text-dim); font-size: 11px; word-break: break-all; position: relative; }
.media-tile--file { padding: 10px; }
.media-thumb { width: 100%; height: 80px; object-fit: cover; border-radius: 8px; background: var(--surface-2); }
.media-name { font-size: 10.5px; padding: 0 4px; }
.media-type { display: flex; align-items: center; gap: 4px; color: var(--text-faint); font-size: 10px; }
.media-remove { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; color: #fff; }

.media-field { display: flex; flex-direction: column; gap: 8px; }
.media-field-label { font-size: 12px; color: var(--text-dim); }
.media-field-preview { display: flex; align-items: center; gap: 12px; }
.media-thumb--lg { width: 160px; height: 100px; flex: none; }
.upload-dropzone--small { padding: 16px; margin-bottom: 0; flex-direction: row; justify-content: center; }
.upload-dropzone--small:disabled { opacity: 0.6; }
.youtube-embed-sm { position: relative; width: 160px; aspect-ratio: 16/9; flex: none; border-radius: 8px; overflow: hidden; background: var(--surface-2); }
.youtube-stage { position: absolute; inset: 0; background: #000; overflow: hidden; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.youtube-frame { position: absolute; inset: 0; }
.youtube-frame--hidden { visibility: hidden; }
/* The player is 120px taller than the box: YouTube letterboxes the video into exactly the visible
   area and puts its title bar and logo in the 60px strips above and below, which are cropped off. */
.youtube-frame iframe { position: absolute; left: 0; top: -60px; width: 100%; height: calc(100% + 120px); border: none; pointer-events: none; }
.youtube-shield { position: absolute; inset: 0; z-index: 2; padding: 0; border: none; background: transparent; cursor: pointer; }
.youtube-paused { position: absolute; inset: 0; z-index: 2; padding: 0; border: none; background: rgba(0,0,0,0.45); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.youtube-paused:hover .youtube-play-btn { transform: scale(1.06); }
.youtube-thumb { position: absolute; inset: 0; padding: 0; border: none; background: var(--surface-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.youtube-thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.youtube-play-btn { position: relative; z-index: 1; width: 60px; height: 60px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; transition: transform .18s ease; }
.youtube-thumb:hover .youtube-play-btn { transform: scale(1.06); }
.youtube-play-btn--sm { width: 32px; height: 32px; }
.youtube-thumb:disabled { cursor: default; }
.youtube-spinner { position: relative; z-index: 1; width: 44px; height: 44px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.35); border-top-color: #fff; animation: youtube-spin 0.9s linear infinite; }
.youtube-spinner--sm { width: 26px; height: 26px; border-width: 2px; }
@keyframes youtube-spin { to { transform: rotate(360deg); } }
.youtube-input-row { display: flex; gap: 8px; }
.youtube-input-row input { flex: 1; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; }
.media-section-label { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 4px; }

.plan-table-editor { display: flex; flex-direction: column; gap: 10px; }
.plan-table-rows { display: flex; flex-direction: column; gap: 6px; }
.plan-table-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; align-items: center; }
.plan-item-actions { display: flex; gap: 2px; }
.plan-note-item { padding: 10px 12px; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 8px; background: var(--surface); }
.plan-note-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.plan-add-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.admin-form-grid .plan-note-intensity-field { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 10px; margin-bottom: 8px; font-size: 12px; color: var(--text-dim); }
.admin-form-grid .plan-note-intensity-field input { flex: 1; width: auto; max-width: 260px; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; color: var(--text); font-size: 13px; font-family: inherit; }
.plan-note-intensity { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 4px 10px; border-radius: 999px; background: var(--accent-dim); color: var(--text); font-size: 13px; font-weight: 600; }
.plan-note-intensity span { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.plan-note .plan-note-intensity:last-child { margin-bottom: 0; }
.plan-note + .plan-table-wrap, .plan-table-wrap + .plan-note, .plan-table-wrap + .plan-table-wrap { margin-top: 14px; }
.plan-table-row input { min-width: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 13px; font-family: inherit; }
.plan-table-row--head { color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; padding: 0 10px; }
.plan-table-row--head span:last-child { width: 88px; }
.plan-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.plan-table { width: 100%; min-width: 420px; border-collapse: collapse; font-size: 14px; }
.plan-table th, .plan-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.plan-table th { color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
.plan-table td { color: var(--text); }
.plan-table tr:last-child td { border-bottom: none; }

.exercise-editor { display: flex; flex-direction: column; gap: 10px; }
.exercise-editor-empty { font-size: 12.5px; color: var(--text-faint); margin: 0; }
.exercise-editor-list { display: flex; flex-direction: column; gap: 12px; }
.exercise-editor-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.exercise-editor-card-head { display: flex; align-items: center; gap: 10px; }
.exercise-editor-num { width: 22px; height: 22px; border-radius: 50%; background: var(--surface); color: var(--text-dim); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.exercise-editor-title { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; font-weight: 600; }
.exercise-editor-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.exercise-editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.exercise-editor-grid > * { min-width: 0; }
.exercise-editor-grid input, .exercise-editor-instructions textarea { width: 100%; min-width: 0; max-width: 100%; }
.exercise-editor-grid label, .exercise-editor-instructions { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); }
.exercise-editor-grid input, .exercise-editor-instructions textarea { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
.exercise-editor-media { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.exercise-editor-media > * { min-width: 0; }
.exercise-editor-instructions select { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px; color: var(--text); font-size: 13px; font-family: inherit; width: 100%; min-width: 0; }
.focus-drill-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 28px; overflow: hidden; }
.focus-drill-head { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px; text-align: left; }
.focus-drill-thumb { width: 84px; height: 56px; object-fit: cover; border-radius: 8px; flex: none; }
.focus-drill-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.focus-drill-title { font-family: 'Archivo', sans-serif; font-size: 17px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }
.focus-drill-chevron { flex: none; color: var(--text-dim); transition: transform .2s ease; }
.focus-drill-chevron--open { transform: rotate(180deg); }
.focus-drill-body { padding: 4px 14px 14px; border-top: 1px solid var(--border); }
.focus-drill-body .video { margin-top: 16px; }
.block-type-label { flex: 1; font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
.block-add-row { display: flex; flex-wrap: wrap; gap: 8px; }

.content-preview-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding: 0 16px; overflow-y: auto; }
.content-preview-panel { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); width: 100%; max-width: 760px; margin: 40px 0; }
.content-preview-header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--border); border-radius: var(--radius) var(--radius) 0 0; z-index: 1; }
.content-preview-label { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); }
.content-preview-panel .main { padding-top: 24px; }

/* Transitions.dev — Card resize. Grows a panel from a small box to its
   natural size on mount; put .t-resize on the element and change its
   width/height (see PreviewModal's resizeIn prop for how the size is
   measured and applied). */
:root {
  --resize-dur: 300ms;
  --resize-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
.t-resize {
  transition:
    width  var(--resize-dur) var(--resize-ease),
    height var(--resize-dur) var(--resize-ease);
  will-change: width, height;
}
@media (prefers-reduced-motion: reduce) {
  .t-resize { transition: none !important; }
}
.welcome-panel { max-width: 560px; }
.welcome-modal-body { padding: 8px 28px 28px; }
.welcome-title { font-size: 24px; font-weight: 900; margin-bottom: 16px; }
.welcome-text { color: var(--text-dim); font-size: 14px; line-height: 1.6; margin-bottom: 12px; }

.legal-lang-tabs { display: inline-flex; margin-bottom: 18px; }
.legal-body h3 { color: var(--text); font-size: 15px; margin: 24px 0 8px; }
.legal-body ol { margin: 0 0 12px; padding-left: 20px; }
.legal-admin-intro { max-width: 640px; margin-bottom: 16px; }
.legal-admin-status { display: flex; flex-wrap: wrap; gap: 6px 20px; padding: 12px 14px; margin-bottom: 18px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); font-size: 13px; color: var(--text-dim); }
.legal-admin-status strong { color: var(--text); }
.legal-admin-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.legal-admin-tabs .level-tabs { display: inline-flex; }
.legal-admin-actions { margin-top: 14px; flex-wrap: wrap; }
.legal-admin-help { margin: 14px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: var(--text-dim); max-width: 640px; }
.legal-admin-help li { margin-bottom: 4px; }
.legal-admin-help strong { color: var(--text); }
.rich-text-input h3 { font-size: 15px; margin: 14px 0 6px; }
.rich-text-input a { color: var(--accent); text-decoration: underline; }
.rich-text-input ol { padding-left: 20px; }
.access-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.access-row:last-of-type { border-bottom: none; }
.access-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.access-row-label { font-size: 14px; font-weight: 600; color: var(--text); }
.access-row-hint { font-size: 12px; line-height: 1.5; color: var(--text-dim); }
.access-switch { position: relative; flex: none; width: 44px; height: 26px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--border); transition: background .18s ease, border-color .18s ease; }
.access-switch.on { background: var(--accent); border-color: var(--accent); }
.access-switch:disabled { opacity: 0.6; cursor: default; }
.access-switch-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .18s ease; }
.access-switch.on .access-switch-knob { transform: translateX(18px); }
.coming-soon { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px 16px; text-align: center; }
.coming-soon .auth-sub { max-width: 420px; margin-bottom: 8px; }
.auth-closed { text-align: center; }
.turnstile-box { min-height: 65px; }
.dialog-host { font-family: 'Inter', sans-serif; color: var(--text); }
.app-dialog-overlay { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.6); }
.app-dialog { width: 100%; max-width: 420px; padding: 22px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 16px 48px rgba(0,0,0,0.55); }
.app-dialog:focus { outline: none; }
.app-dialog-title { font-size: 17px; line-height: 1.35; margin: 0 0 8px; color: var(--text); }
.app-dialog-message { margin: 0 0 4px; font-size: 14px; line-height: 1.55; color: var(--text-dim); }
.app-dialog-field { margin-top: 12px; }
.app-dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.btn--danger { background: #D63B3B; color: #fff; }
.btn--danger:hover { filter: brightness(1.08); }
.content-preview-panel:focus, .welcome-panel:focus { outline: none; }
.plan-note { margin-bottom: 14px; padding: 12px 14px; border-left: 3px solid var(--accent); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 14px; line-height: 1.55; }
.plan-note p { margin: 0 0 6px; }
.plan-note p:last-child { margin-bottom: 0; }
.plan-note ul, .plan-note ol { margin: 0; padding-left: 18px; }
.drill-volume { display: flex; flex-wrap: wrap; gap: 10px; }
.drill-volume-tile { display: flex; flex-direction: column; gap: 4px; min-width: 110px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.drill-volume-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); }
.drill-volume-value { font-family: 'Archivo'; font-size: 20px; font-weight: 700; color: var(--text); }
.legal-checks { display: flex; flex-direction: column; gap: 10px; margin: 4px 0 2px; }
.legal-check { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.5; color: var(--text-dim); text-align: left; cursor: pointer; }
.legal-check input { width: 16px; height: 16px; margin: 2px 0 0; flex: none; accent-color: var(--accent); cursor: pointer; }
.legal-check .cookie-link { color: var(--text); }
.legal-doc ul { margin: 0 0 12px; padding-left: 20px; }
.legal-doc li { margin-bottom: 8px; }
.profile-delete-link { margin-top: 6px; font-size: 13px; color: var(--text-dim); text-decoration: underline; text-underline-offset: 2px; }
.profile-delete-link:hover { color: var(--accent); }
.profile-delete-confirm { width: 100%; max-width: 380px; margin-top: 6px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); text-align: left; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
.profile-delete-confirm p { margin: 0 0 12px; }
.profile-delete-confirm strong { color: var(--text); }
.cookie-root { font-family: 'Inter', sans-serif; color: var(--text); }
.cookie-banner { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 200; max-width: 760px; margin: 0 auto; display: flex; align-items: center; gap: 20px; padding: 18px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 16px 48px rgba(0,0,0,0.55); color: var(--text); font-family: 'Inter', sans-serif; }
.cookie-banner-text { flex: 1; min-width: 0; }
.cookie-banner-title { display: flex; align-items: center; gap: 8px; font-family: 'Archivo'; font-weight: 700; font-size: 15px; margin-bottom: 6px; color: var(--text); }
.cookie-banner-text p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--text-dim); }
.cookie-banner-text .cookie-banner-current { margin-top: 6px; color: var(--text); }
.cookie-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }
.cookie-btn { padding: 11px 18px; border-radius: 30px; font-size: 13px; font-weight: 600; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); white-space: nowrap; }
.cookie-btn:hover { border-color: #3a3a40; }
.cookie-banner-close { position: absolute; top: 8px; right: 8px; }
.cookie-link { padding: 0; font-size: inherit; color: var(--text); text-decoration: underline; text-underline-offset: 2px; }
.cookie-link:hover { color: var(--accent); }
.legal-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin-top: 18px; font-size: 12px; color: var(--text-dim); }
.legal-links .cookie-link { color: var(--text-dim); }
.legal-links .cookie-link:hover { color: var(--text); }
.youtube-blocked { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; text-align: center; background: var(--surface-2); color: var(--text-dim); user-select: auto; -webkit-user-select: auto; }
.youtube-blocked p { margin: 0; max-width: 360px; font-size: 13px; line-height: 1.5; }
.youtube-blocked .cookie-link { font-size: 12px; color: var(--text-dim); }
.youtube-blocked--sm { gap: 6px; padding: 8px; }
.youtube-blocked--sm .btn { padding: 6px 12px; font-size: 12px; }
.legal-doc { max-width: 640px; color: var(--text-dim); font-size: 14px; line-height: 1.6; }
.legal-doc h2 { color: var(--text); font-size: 22px; margin-bottom: 4px; }
.legal-doc h3 { color: var(--text); font-size: 15px; margin: 24px 0 8px; }
.legal-doc p { margin: 0 0 12px; }
.legal-doc a { color: var(--text); text-decoration: underline; }
.legal-doc strong { color: var(--text); }
.legal-updated { font-size: 12px; }
@media (max-width: 640px) {
  .cookie-banner { flex-direction: column; align-items: stretch; gap: 14px; padding: 16px; left: 12px; right: 12px; }
  .cookie-banner-actions > .cookie-btn { flex: 1; }
  .cookie-banner-text { padding-right: 20px; }
}
.welcome-cta { width: 100%; justify-content: center; margin-top: 8px; }
.settings-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-dim); gap: 20px; }
.settings-row:last-child { border-bottom: none; }
.settings-row input, .settings-row select { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 13px; width: 180px; }
.settings-accent-row { display: flex; align-items: center; gap: 12px; }
.settings-color-swatch { width: 40px !important; height: 40px; padding: 2px !important; border-radius: 8px; cursor: pointer; }
.settings-accent-hex { font-family: monospace; font-size: 13px; color: var(--text); }

.email-status { display: flex; align-items: center; gap: 6px; margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 12px; }
.email-status--ok { background: rgba(34,197,94,0.12); color: #22c55e; }
.email-status--error { background: rgba(239,68,68,0.12); color: #ef4444; }
.email-preview-panel { max-width: 560px; }
.email-preview-panel .main { padding: 0; max-width: none; }
.email-preview-panel .email-preview-frame { display: block; }
.email-preview-frame { width: 100%; height: 520px; border: 0; background: #fff; border-radius: 0 0 var(--radius) var(--radius); }

.admin-sub { font-size: 13px; color: var(--text-dim); margin: -12px 0 20px; max-width: 620px; line-height: 1.5; }
.admin-sub p + p { margin-top: 8px; }
.training-blocks-about p { margin: 0; }
.training-blocks-about p + p { margin-top: 8px; }
.training-blocks-about { margin: 0 0 20px; max-width: 720px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.front-page-panel-title { font-size: 14px; margin-bottom: 14px; }
.front-page-panel-body { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
.brand-image-controls { display: flex; flex-direction: column; gap: 10px; min-width: 200px; }
.brand-image-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.brand-image-actions label { cursor: pointer; }
.brand-image-hint { font-size: 12px; color: var(--text-dim); margin-top: 4px; max-width: 220px; }
.focal-picker { position: relative; width: 260px; height: 165px; border-radius: 10px; background-size: cover; background-repeat: no-repeat; background-position: center; border: 1px solid var(--border); flex-shrink: 0; cursor: crosshair; touch-action: none; user-select: none; }
.focal-marker { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; border: 2px solid #fff; background: var(--accent); box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.5); cursor: grab; }
.focal-marker:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.focal-inputs { display: flex; gap: 14px; }
.focal-inputs label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
.focal-inputs input { width: 54px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 5px 6px; color: var(--text); font-size: 13px; }

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-dim); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius); }
.empty-state p { margin-bottom: 16px; font-size: 14px; }
.empty-state--hero { margin-top: 8px; }
.crash-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 40px; }
.crash-screen p { color: var(--text-dim); font-size: 13px; max-width: 420px; margin-bottom: 8px; }
.skeleton-hero { height: 260px; border-radius: var(--radius); background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ---------------- PRINT ---------------- */
.print-sheet { display: none; }
@media print {
  @page { size: A4; margin: 10mm 11mm; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Only the sheet prints — not the app's header, pages, menus, banners or dialogs. */
  .no-print, .cookie-root, .dialog-host { display: none !important; }
  .app { background: #fff !important; min-height: 0 !important; }
  .app > :not(.print-sheet) { display: none !important; }
  .print-sheet { display: block; color: #16161a; font-family: 'Inter', sans-serif; font-size: 10px; line-height: 1.42; background: #fff; }

  .print-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 8px; border-bottom: 2.5px solid #BE202E; }
  .print-logo { height: 22px; width: auto; display: block; }
  .print-header-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .print-kicker { font-size: 8px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #BE202E; }
  .print-date { font-size: 10.5px; font-weight: 600; color: #333; }
  .print-title { font-family: 'Archivo'; font-size: 22px; font-weight: 900; letter-spacing: -0.01em; margin: 10px 0 1px; color: #111; }
  .print-subtitle { font-size: 11px; color: #666; margin: 0 0 4px; }

  .print-card { display: flex; gap: 12px; margin-top: 9px; padding: 10px 11px; border: 1px solid #e5e5e8; border-left: 3px solid #BE202E; border-radius: 8px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .print-card--can-break { break-inside: auto; page-break-inside: auto; }
  .print-section-heading, .print-plan-note { break-after: avoid; page-break-after: avoid; }
  .print-plan-table, .print-plan-table tr, .print-steps li { break-inside: avoid; page-break-inside: avoid; }
  .print-card-img { width: 29mm; height: 29mm; flex-shrink: 0; object-fit: cover; border-radius: 6px; background: #eee; }
  .print-card-body { flex: 1; min-width: 0; }
  .print-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
  .print-card-label { font-size: 8px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #BE202E; }
  .print-check { display: inline-flex; align-items: center; gap: 5px; font-size: 8px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #999; }
  .print-check-box { width: 10px; height: 10px; border: 1.3px solid #aaa; border-radius: 2px; }
  .print-card-title { font-family: 'Archivo'; font-size: 14px; font-weight: 800; margin: 0 0 3px; color: #111; }
  .print-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
  .print-meta span { font-size: 9px; color: #555; background: #f2f2f4; border-radius: 999px; padding: 2px 8px; }
  .print-section-heading { font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin: 6px 0 2px; }
  .print-muted { color: #999; font-style: italic; margin: 4px 0 0; }

  .print-rich p { margin: 0 0 4px; }
  .print-rich p:last-child { margin-bottom: 0; }
  .print-rich ul, .print-rich ol { margin: 2px 0 4px; padding-left: 16px; }
  .print-rich li { margin-bottom: 1px; }

  .print-steps { list-style: none; margin: 0; padding: 0; }
  .print-steps li { display: flex; align-items: flex-start; gap: 7px; margin-bottom: 2px; }
  .print-step-num { flex: none; width: 14px; height: 14px; border-radius: 50%; background: #BE202E; color: #fff; font-size: 8.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-top: 0.5px; }
  .print-pills { display: flex; gap: 6px; margin-top: 7px; }
  .print-pill { display: inline-flex; align-items: baseline; gap: 5px; padding: 3px 9px; border-radius: 6px; background: #f2f2f4; font-weight: 700; font-size: 10.5px; }
  .print-pill small { font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; font-weight: 700; }

  .print-cue { margin: 3px 0 1px; padding: 5px 9px; border-radius: 6px; background: #fbecee; border: 1px solid #f1c9ce; font-size: 11.5px; font-weight: 600; color: #111; }
  .print-cue small { display: block; font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #BE202E; font-weight: 700; margin-bottom: 1px; }

  .print-plan-note { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin: 5px 0 3px; }
  .print-intensity { flex: none; font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; background: #BE202E; border-radius: 999px; padding: 2px 7px; }
  .print-plan-note .print-rich { flex: 1; min-width: 50%; font-weight: 600; }
  .print-plan-table { width: 100%; border-collapse: collapse; margin: 1px 0 3px; font-size: 9px; }
  .print-plan-table th { text-align: left; padding: 3px 7px; background: #f2f2f4; font-size: 7.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #666; }
  .print-plan-table td { padding: 2px 7px; border-bottom: 1px solid #ededf0; }
  .print-plan-table tbody tr:nth-child(even) td { background: #fafafb; }
  .print-plan-table td:first-child { font-weight: 600; }

  .print-footer { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 6px; border-top: 1px solid #e5e5e8; font-size: 8px; letter-spacing: 0.08em; color: #999; }
}

/* ---------------- RESPONSIVE ---------------- */
@media (max-width: 900px) {
  .nav-links, .nav-admin-toggle, .nav-level-select, .nav-right > .nav-avatar { display: none; }
  .main { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  .bottom-nav { display: flex; }
  .nav-mobile-toggle { display: flex; }
  .nav-mobile-panel { display: flex; }
  .admin-topbar .nav-admin-toggle { display: flex; }
  .bento { grid-template-columns: 1fr; grid-template-rows: auto; }
  .card--feature, .card--focus, .card--compact { grid-column: auto; grid-row: auto; }
  .card-visual--feature { flex: none; height: 180px; min-height: 0; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .gameperf-charts-row { grid-template-columns: 1fr; }
  .admin-shell { flex-direction: column; }
  .admin-sidebar { width: 100%; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); }
  .admin-nav-item { white-space: nowrap; flex-shrink: 0; }
  .admin-form-grid { grid-template-columns: minmax(0, 1fr); }
  .exercise-editor-grid, .exercise-editor-media { grid-template-columns: minmax(0, 1fr); }
  .plan-table-row { grid-template-columns: 1fr 1fr; grid-template-areas: "exercise exercise" "sets reps" "rest remove"; row-gap: 6px; }
  .plan-table-row input:nth-child(1) { grid-area: exercise; }
  .plan-table-row input:nth-child(2) { grid-area: sets; }
  .plan-table-row input:nth-child(3) { grid-area: reps; }
  .plan-table-row input:nth-child(4) { grid-area: rest; }
  .plan-table-row .plan-item-actions { grid-area: remove; justify-self: end; }
  .plan-table-row--head { display: none; }
  .planner-grid { grid-template-columns: minmax(0, 1fr); }
  .dashboard-health-grid { grid-template-columns: minmax(0, 1fr); }
  .admin-table { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .admin-table th, .admin-table td { min-width: 84px; }
  .admin-table th:first-child, .admin-table td:first-child { min-width: 150px; }
  .auth-screen { grid-template-columns: 1fr; align-content: start; }
  .auth-side { padding: 48px 32px 36px; min-height: 0; }
  .auth-side-content { max-width: 100%; text-align: center; margin: 0 auto; }
  .auth-side-content .nav-logo { justify-content: center; }
  .auth-badge { width: 300px; }
  .auth-arc { width: 260px; right: -30px; bottom: -20px; }
  .auth-headline { font-size: 27px; }
  .auth-form-wrap { padding: 32px 24px 48px; }
}
@media (max-width: 640px) {
  .admin-content { padding: 20px 0 32px; }
  .admin-content .admin-table { display: block; overflow: visible; }
  .admin-content .admin-table thead { display: none; }
  .admin-content .admin-table tbody { display: block; }
  .admin-content .admin-table tr { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  .admin-content .admin-table tr:last-child { border-bottom: none; }
  .admin-content .admin-table td { display: block; padding: 0; border: none; min-width: 0; overflow-wrap: anywhere; }
  .admin-content .admin-table td:first-child { flex: 1 1 100%; color: var(--text); font-weight: 600; font-size: 14px; }
  .admin-content .admin-table td.admin-row-actions { display: flex; margin-left: auto; }
  .admin-panel, .admin-form { padding: 16px; }
  .daytype-eyebrow-stack { flex-direction: column; align-items: flex-start; gap: 2px; }
  .daytype-eyebrow-sep { display: none; }
  .hero { flex-direction: column; align-items: flex-start; gap: 20px; }
  .hero-title { font-size: 32px; }
  /* Phones: the ring beside "Your training day", then Games & Rest beside the PDF button. */
  .ticket {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: "ring checklist checklist" "gamesrest gamesrest pdf";
    align-items: center; gap: 16px 12px; padding: 16px;
  }
  .ticket-ring-wrap { grid-area: ring; }
  .ticket-left { grid-area: checklist; min-width: 0; }
  .ticket-left h4 { margin-bottom: 8px; }
  .ticket-list { flex-wrap: wrap; gap: 4px 10px; }
  .ticket-list li { font-size: 13px; gap: 4px; }
  .ticket-divider { display: none; }
  .ticket-right { display: contents; }
  .ticket-download-btn { grid-area: pdf; margin-left: 0; font-size: 13px; padding: 11px 14px; white-space: nowrap; justify-content: center; }
  .ticket-calendar-group { grid-area: gamesrest; flex-direction: row; align-items: center; gap: 8px; min-width: 0; }
  .ticket-calendar-group h4 { margin-bottom: 0; white-space: nowrap; }
  .ticket-pdf-word { display: none; }
  .ticket-rest-btn { grid-column: 1 / -1; justify-self: start; }
  .ticket--empty { grid-template-areas: "gamesrest gamesrest gamesrest"; }
  .eyebrow-calendar-btn { width: 36px; height: 36px; }
  .eyebrow-calendar-btn svg { width: 20px; height: 20px; }
  .mistake-row { grid-template-columns: 1fr; }
  .main { padding: 0 16px calc(96px + env(safe-area-inset-bottom)); }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .profile-grid { flex-wrap: wrap; gap: 20px; }
  .auth-side { padding: 36px 20px 28px; }
  .auth-badge { width: 220px; }
  .auth-headline { font-size: 23px; margin: 18px 0 10px; }
  .auth-sub { font-size: 13.5px; }
  .auth-form-wrap { padding: 20px 16px 40px; }
  /* iOS Safari auto-zooms the page on focus when a field's font-size is under 16px —
     force every text field to 16px on phones so typing never triggers that zoom. */
  input, select, textarea { font-size: 16px !important; }
}
`;
