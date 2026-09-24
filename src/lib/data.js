import { supabase } from "./supabase.js";

/* ============================================================================
   Reconstructs the app's original single-blob shapes (users_v1 map, content_v1
   doc) from the real relational tables, so the rest of the component tree
   (written against those shapes) needs no further changes. See the migration
   plan for the schema this reads from.
   ============================================================================ */

function shapeUser(p, dayTypes, gameLogs, restNotes, loginDays) {
  return {
    id: p.id, email: p.email, name: p.name, role: p.role,
    position: p.position, experience: p.experience,
    country: p.country, league: p.league, team: p.team,
    photoAssetId: null, photoUrl: p.photo_url || "",
    hasSeenWelcome: p.has_seen_welcome, lastSeenAnnouncementId: p.last_seen_announcement_id,
    lastActive: p.last_active ? new Date(p.last_active).getTime() : null,
    removed: p.removed, createdAt: p.created_at ? new Date(p.created_at).getTime() : null,
    dayTypes: dayTypes || {}, gameLogs: gameLogs || {}, restNotes: restNotes || {},
    loginDays: loginDays || {}, monthPlans: p.month_plans || {},
    termsVersion: p.terms_version || null,
  };
}

// Fetches just the signed-in user's own profile + personal records — used right
// after signup/login, instead of pulling every account for one lookup.
export async function fetchCurrentProfile() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const [{ data: p }, { data: dt }, { data: gl }, { data: rn }, { data: ld }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).single(),
    supabase.from("day_types").select("*").eq("user_id", authUser.id),
    supabase.from("game_logs").select("*").eq("user_id", authUser.id),
    supabase.from("rest_notes").select("*").eq("user_id", authUser.id),
    supabase.from("login_days").select("date").eq("user_id", authUser.id),
  ]);
  if (!p) return null;
  const dayTypes = {}; for (const r of dt || []) dayTypes[r.date] = r.type;
  const gameLogs = {};
  for (const r of gl || []) {
    gameLogs[r.date] = {
      opponent: r.opponent, homeAway: r.home_away, result: r.result,
      shots: r.shots, goalsAgainst: r.goals_against, goalsFor: r.goals_for,
      minutesPlayed: r.minutes_played, periods: r.periods || [],
    };
  }
  const restNotes = {}; for (const r of rn || []) restNotes[r.date] = r.note;
  const loginDays = {}; for (const r of ld || []) loginDays[r.date] = true;
  return shapeUser(p, dayTypes, gameLogs, restNotes, loginDays);
}

export async function getUsersMap() {
  const [{ data: profiles }, { data: dayTypes }, { data: gameLogs }, { data: restNotes }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("day_types").select("*"),
    supabase.from("game_logs").select("*"),
    supabase.from("rest_notes").select("*"),
  ]);
  if (!profiles) return {};

  const dayTypesByUser = {};
  for (const r of dayTypes || []) (dayTypesByUser[r.user_id] ||= {})[r.date] = r.type;
  const gameLogsByUser = {};
  for (const r of gameLogs || []) {
    (gameLogsByUser[r.user_id] ||= {})[r.date] = {
      opponent: r.opponent, homeAway: r.home_away, result: r.result,
      shots: r.shots, goalsAgainst: r.goals_against, goalsFor: r.goals_for,
      minutesPlayed: r.minutes_played, periods: r.periods || [],
    };
  }
  const restNotesByUser = {};
  for (const r of restNotes || []) (restNotesByUser[r.user_id] ||= {})[r.date] = r.note;

  const out = {};
  for (const p of profiles) {
    out[p.email] = shapeUser(p, dayTypesByUser[p.id], gameLogsByUser[p.id], restNotesByUser[p.id]);
  }
  return out;
}

// Notes that the goalie opened the app on this calendar day (idempotent). The training
// list pauses across 3+ days in a row with no such record — see trainingDayForDate.
export async function recordLoginDay(userId, date) {
  const { error } = await supabase.from("login_days").upsert({ user_id: userId, date }, { onConflict: "user_id,date", ignoreDuplicates: true });
  return !error;
}

// Fans a users_v1-style patch (keyed however updateUserFields is called throughout
// the app) out to the right table(s). userId is the profile's id (== auth.users.id).
export async function updateUserFields(userId, patch) {
  if (!userId || !patch) return false;
  try {
    const profileFields = {};
    const fieldMap = {
      name: "name", position: "position", experience: "experience",
      country: "country", league: "league", team: "team",
      photoUrl: "photo_url", hasSeenWelcome: "has_seen_welcome",
      lastSeenAnnouncementId: "last_seen_announcement_id",
      role: "role", removed: "removed", monthPlans: "month_plans",
    };
    // Accepting the Terms of Use / Privacy Policy also records when it happened.
    if (patch.termsVersion !== undefined) {
      profileFields.terms_version = patch.termsVersion;
      profileFields.terms_accepted_at = new Date().toISOString();
    }
    for (const [jsKey, col] of Object.entries(fieldMap)) {
      if (jsKey in patch) profileFields[col] = patch[jsKey];
    }
    if (patch.lastActive !== undefined) profileFields.last_active = new Date(patch.lastActive).toISOString();

    const ops = [];
    if (Object.keys(profileFields).length) {
      ops.push(supabase.from("profiles").update(profileFields).eq("id", userId));
    }
    if (patch.dayTypes) {
      const rows = Object.entries(patch.dayTypes).map(([date, type]) => ({ user_id: userId, date, type }));
      ops.push(supabase.from("day_types").upsert(rows));
    }
    if (patch.gameLogs) {
      const rows = Object.entries(patch.gameLogs).map(([date, log]) => ({
        user_id: userId, date,
        opponent: log.opponent, home_away: log.homeAway, result: log.result,
        shots: log.shots, goals_against: log.goalsAgainst, goals_for: log.goalsFor,
        minutes_played: log.minutesPlayed, periods: log.periods || [],
      }));
      ops.push(supabase.from("game_logs").upsert(rows));
    }
    if (patch.restNotes) {
      const rows = Object.entries(patch.restNotes).map(([date, note]) => ({ user_id: userId, date, note }));
      ops.push(supabase.from("rest_notes").upsert(rows));
    }
    // password changes go through supabase.auth.updateUser, handled by the caller,
    // not through this table-patch path.
    const results = await Promise.all(ops);
    return results.every((r) => !r.error);
  } catch {
    return false;
  }
}

const LEVELS = ["Youth", "Junior", "Pro"];

export async function getContent() {
  const [
    { data: drills }, { data: focusPoints }, { data: offIceWorkouts },
    { data: categories }, { data: trainingDays }, { data: media }, { data: settings },
  ] = await Promise.all([
    supabase.from("drills").select("*").order("created_at"),
    supabase.from("focus_points").select("*").order("created_at"),
    supabase.from("off_ice_workouts").select("*").order("created_at"),
    supabase.from("categories").select("*"),
    supabase.from("training_days").select("*").order("position"),
    supabase.from("media").select("*").order("uploaded_at", { ascending: false }),
    supabase.from("app_settings").select("*"),
  ]);

  const toDrillShape = (d) => ({
    id: d.id, title: d.title || "", category: d.category || "", duration: d.duration || "", equipment: d.equipment || "",
    description: d.description || "", objective: d.objective || "",
    steps: d.steps || [], coachingPoints: d.coaching_points || [], mistakes: d.mistakes || [],
    published: d.published, imageAssetId: null, imageUrl: d.image_url || "", videoAssetId: null, videoUrl: d.video_url || "",
    diagramUrl: d.diagram_url || "",
  });
  const toFocusShape = (f) => ({
    id: f.id, title: f.title || "", category: f.category || "", explanation: f.explanation || "", cue: f.cue || "",
    blocks: f.blocks || [], published: f.published,
    imageAssetId: null, imageUrl: f.image_url || "", videoAssetId: null, videoUrl: f.video_url || "",
  });
  const toWorkoutShape = (o) => ({
    id: o.id, title: o.title || "", category: o.category || "", duration: o.duration || "", equipment: o.equipment || "",
    description: o.description || "", objective: o.objective || "", exercises: o.exercises || [], planRows: o.plan_rows || [],
    published: o.published, imageAssetId: null, imageUrl: o.image_url || "", videoAssetId: null, videoUrl: o.video_url || "",
  });

  const trainingDaysShape = { Youth: [], Junior: [], Pro: [] };
  for (const row of trainingDays || []) {
    trainingDaysShape[row.level]?.push({
      id: row.id, drillId: row.drill_id || "", focusId: row.focus_id || "", workoutId: row.workout_id || "",
      title: row.title || "", subtitle: row.subtitle || "", createdAt: row.created_at,
    });
  }

  // Rows are seeded as an empty {} until the coach first saves them; hand those to the app
  // as "not set" so each screen falls back to its own defaults instead of a blank object.
  const settingsByKey = {};
  for (const row of settings || []) {
    const v = row.value;
    settingsByKey[row.key] = v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0 ? undefined : v;
  }

  return {
    drills: (drills || []).map(toDrillShape),
    focusPoints: (focusPoints || []).map(toFocusShape),
    offIceWorkouts: (offIceWorkouts || []).map(toWorkoutShape),
    categories: (categories || []).map((c) => ({ name: c.name, type: c.type })),
    trainingDays: trainingDaysShape,
    gameDay: settingsByKey.game_day,
    restDay: settingsByKey.rest_day,
    branding: settingsByKey.branding || {},
    accentColor: settingsByKey.accent_color || undefined,
    welcome: settingsByKey.welcome,
    announcement: settingsByKey.announcement,
    confirmationEmail: settingsByKey.confirmation_email || undefined,
    media: (media || []).map((m) => ({
      id: m.id, url: m.url, contentType: m.content_type, sizeBytes: m.size_bytes,
      name: m.name, uploadedAt: m.uploaded_at, storagePath: m.storage_path,
    })),
  };
}

// Reconciles one content_v1-style field against its table(s). Array fields
// (drills/focusPoints/offIceWorkouts/categories) are full-replacement arrays
// from the caller (matching how the admin screens already build them) — upsert
// what's present, delete whatever existing row isn't in the new array.
async function reconcileTable(table, nextRows, toRow, prevRows) {
  // With the previous rows known, write only what changed: upsert the new/edited rows and delete
  // the removed ones. That is cheaper than rewriting the table and means one stale screen can't
  // wipe rows it never knew about. Without them, fall back to a full reconcile.
  let changed = nextRows;
  let toDelete;
  if (prevRows) {
    const prevById = new Map(prevRows.map((r) => [r.id, JSON.stringify(r)]));
    changed = nextRows.filter((r) => prevById.get(r.id) !== JSON.stringify(r));
    const nextIds = new Set(nextRows.map((r) => r.id));
    toDelete = prevRows.map((r) => r.id).filter((id) => !nextIds.has(id));
  } else {
    const { data: existing } = await supabase.from(table).select("id");
    const nextIds = new Set(nextRows.map((r) => r.id).filter(Boolean));
    toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id));
  }
  const ops = [];
  if (changed.length) ops.push(supabase.from(table).upsert(changed.map(toRow)).select());
  if (toDelete.length) ops.push(supabase.from(table).delete().in("id", toDelete));
  const results = await Promise.all(ops);
  return results.every((r) => !r.error);
}

// Each level's list is saved as delete-then-insert (so a reorder/removal can never trip
// unique(level, position) mid-write). Writes are chained one after another: two quick
// edits running concurrently could interleave their delete and insert steps and lose rows.
let trainingDaysWriteChain = Promise.resolve();
async function writeTrainingDays(byLevel) {
  let allOk = true;
  for (const level of LEVELS) {
    const list = byLevel[level];
    if (!list) continue;
    // One database call that replaces the level's list all-or-nothing, so a dropped connection
    // can never leave a level half-written or empty.
    const rows = list.map((d) => ({
      id: d.id, drill_id: d.drillId || null, focus_id: d.focusId || null, workout_id: d.workoutId || null,
      title: d.title || null, subtitle: d.subtitle || null,
      created_at: d.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.rpc("replace_training_days", { p_level: level, p_rows: rows });
    if (error) allOk = false;
  }
  return allOk;
}

export async function updateContentFields(patch, prev = {}) {
  if (!patch || Object.keys(patch).length === 0) return true;
  try {
    const ok = [];
    if (patch.drills) {
      ok.push(await reconcileTable("drills", patch.drills, (d) => ({
        id: d.id, title: d.title, category: d.category, duration: d.duration, equipment: d.equipment,
        description: d.description, objective: d.objective,
        steps: d.steps || [], coaching_points: d.coachingPoints || [], mistakes: d.mistakes || [],
        published: !!d.published, image_url: d.imageUrl || null, video_url: d.videoUrl || null,
        diagram_url: d.diagramUrl || null,
      }), prev.drills));
    }
    if (patch.focusPoints) {
      ok.push(await reconcileTable("focus_points", patch.focusPoints, (f) => ({
        id: f.id, title: f.title, category: f.category, explanation: f.explanation, cue: f.cue,
        blocks: f.blocks || [], published: !!f.published,
        image_url: f.imageUrl || null, video_url: f.videoUrl || null,
      }), prev.focusPoints));
    }
    if (patch.offIceWorkouts) {
      ok.push(await reconcileTable("off_ice_workouts", patch.offIceWorkouts, (o) => ({
        id: o.id, title: o.title, category: o.category, duration: o.duration, equipment: o.equipment,
        description: o.description, objective: o.objective, exercises: o.exercises || [], plan_rows: o.planRows || [],
        published: !!o.published, image_url: o.imageUrl || null, video_url: o.videoUrl || null,
      }), prev.offIceWorkouts));
    }
    if (patch.categories) {
      const rows = patch.categories.map((c) => ({ name: c.name, type: c.type }));
      const { error } = await supabase.rpc("replace_categories", { p_rows: rows });
      ok.push(!error);
    }
    if (patch.trainingDays) {
      const run = trainingDaysWriteChain.then(() => writeTrainingDays(patch.trainingDays));
      trainingDaysWriteChain = run.catch(() => {});
      ok.push(await run);
    }
    if (patch.media) {
      ok.push(await reconcileTable("media", patch.media, (m) => ({
        id: m.id, url: m.url, content_type: m.contentType, size_bytes: m.sizeBytes,
        name: m.name, storage_path: m.storagePath || null,
      })));
    }
    for (const [patchKey, settingsKey] of [["gameDay", "game_day"], ["restDay", "rest_day"], ["branding", "branding"], ["welcome", "welcome"], ["announcement", "announcement"], ["accentColor", "accent_color"], ["confirmationEmail", "confirmation_email"]]) {
      if (patch[patchKey] !== undefined) {
        const { error } = await supabase.from("app_settings").upsert({ key: settingsKey, value: patch[patchKey] });
        ok.push(!error);
      }
    }
    return ok.every(Boolean);
  } catch {
    return false;
  }
}

// Uploads an image to the shared "media" bucket. pathPrefix scopes where it's
// stored (e.g. "profile/<userId>" for a self-service profile photo, "content"
// for anything a coach uploads) — see the bucket's storage RLS policies.
export async function uploadImage(file, pathPrefix = "content") {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { id: path, url: data.publicUrl, path, contentType: file.type, sizeBytes: file.size };
}

const PUBLIC_MEDIA_MARKER = "/storage/v1/object/public/media/";

// The bucket path inside a public file URL, or null if it isn't one of ours.
export function storagePathFromUrl(url) {
  if (typeof url !== "string") return null;
  const i = url.indexOf(PUBLIC_MEDIA_MARKER);
  if (i < 0) return null;
  try { return decodeURIComponent(url.slice(i + PUBLIC_MEDIA_MARKER.length).split("?")[0]); } catch { return null; }
}

// Every file path inside a value (a drill, a list of items, settings...) — found by scanning its JSON.
export function storagePathsIn(value) {
  const out = new Set();
  const text = JSON.stringify(value ?? null) || "";
  for (const m of text.matchAll(/https?:[^"\\]*\/storage\/v1\/object\/public\/media\/[^"\\]+/g)) {
    const path = storagePathFromUrl(m[0]);
    if (path) out.add(path);
  }
  return out;
}

// Permanently deletes an account (their own, or a goalie's when called by a coach): first
// any profile photo files, then the login and all of its data through delete_account.
export async function deleteAccount(userId) {
  try {
    const folder = `profile/${userId}`;
    const { data: files } = await supabase.storage.from("media").list(folder);
    if (files?.length) await supabase.storage.from("media").remove(files.map((f) => `${folder}/${f.name}`));
    const { error } = await supabase.rpc("delete_account", { target: userId });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// Legal texts (Admin -> Legal) and the Terms/Privacy version goalies must have accepted.
// Readable while logged out too, since the signup screen links to them.
export async function getLegal() {
  const [{ data: docs, error: docsError }, { data: state, error: stateError }] = await Promise.all([
    supabase.from("legal_documents").select("doc, lang, body, updated_at"),
    supabase.from("legal_state").select("version, published_at").eq("id", 1).maybeSingle(),
  ]);
  if (docsError || stateError) return null;
  const out = { version: state?.version || null, publishedAt: state?.published_at || null, docs: {} };
  for (const d of docs || []) (out.docs[d.doc] ||= {})[d.lang] = { body: d.body, updatedAt: d.updated_at };
  return out;
}

export async function saveLegalDoc(doc, lang, body) {
  const { data, error } = await supabase.from("legal_documents")
    .upsert({ doc, lang, body, updated_at: new Date().toISOString() })
    .select("updated_at").single();
  return error ? null : data.updated_at;
}

export async function publishLegalVersion(version) {
  const { error } = await supabase.from("legal_state")
    .update({ version, published_at: new Date().toISOString() }).eq("id", 1);
  return !error;
}

// How many goalies have accepted the given version (for the admin page).
export async function legalAcceptanceCount(version) {
  const { data, error } = await supabase.from("profiles").select("terms_version").eq("role", "goalie").eq("removed", false);
  if (error) return null;
  return { accepted: data.filter((p) => p.terms_version === version).length, total: data.length };
}

export async function deleteStorageObject(path) {
  if (!path) return true;
  const { error } = await supabase.storage.from("media").remove([path]);
  return !error;
}

// Deletes the given files, but only those the database confirms nothing refers to any more.
export async function deleteUnusedFiles(paths) {
  if (!paths?.length) return 0;
  const { data, error } = await supabase.rpc("unreferenced_files", { p_paths: paths });
  if (error || !data?.length) return 0;
  const { error: removeError } = await supabase.storage.from("media").remove(data);
  return removeError ? 0 : data.length;
}

// Files in storage that nothing refers to (older than a few minutes, so an upload in progress is never caught).
export async function getUnusedFiles() {
  const { data, error } = await supabase.rpc("unused_media_files");
  if (error) return null;
  return (data || []).map((f) => ({ name: f.name, size: Number(f.size), createdAt: f.created_at }));
}

// Pushes the confirmation-email template live via the update-confirmation-email
// Edge Function, which calls Supabase's Management API on our behalf (that API
// needs an account-level token the client must never hold — see the function's
// own source for details). Returns { ok } or { ok: false, error }.
export async function publishConfirmationEmail(fields) {
  const { data, error } = await supabase.functions.invoke("update-confirmation-email", { body: fields });
  if (error) {
    const message = (await error.context?.json?.().catch(() => null))?.error || error.message || "Failed to publish";
    if (error.context?.status === 401) {
      return { ok: false, error: "Your login is no longer valid — log out, log back in, and publish again." };
    }
    return { ok: false, error: message };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function getUsage() {
  const { data, error } = await supabase.rpc("admin_usage");
  if (error || !data) return null;
  return { dbBytes: Number(data.db_bytes), storageBytes: Number(data.storage_bytes), storageFiles: Number(data.storage_files) };
}
