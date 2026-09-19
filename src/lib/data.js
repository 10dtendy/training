import { supabase } from "./supabase.js";

/* ============================================================================
   Reconstructs the app's original single-blob shapes (users_v1 map, content_v1
   doc) from the real relational tables, so the rest of the component tree
   (written against those shapes) needs no further changes. See the migration
   plan for the schema this reads from.
   ============================================================================ */

function rowsToMapByDate(rows) {
  const out = {};
  for (const r of rows) out[r.date] = r;
  return out;
}

function shapeUser(p, dayTypes, gameLogs, restNotes) {
  return {
    id: p.id, email: p.email, name: p.name, role: p.role,
    position: p.position, experience: p.experience,
    country: p.country, league: p.league, team: p.team,
    photoAssetId: null, photoUrl: p.photo_url || "",
    hasSeenWelcome: p.has_seen_welcome, lastSeenAnnouncementId: p.last_seen_announcement_id,
    lastActive: p.last_active ? new Date(p.last_active).getTime() : null,
    removed: p.removed, createdAt: p.created_at ? new Date(p.created_at).getTime() : null,
    dayTypes: dayTypes || {}, gameLogs: gameLogs || {}, restNotes: restNotes || {},
  };
}

// Fetches just the signed-in user's own profile + personal records — used right
// after signup/login, instead of pulling every account for one lookup.
export async function fetchCurrentProfile() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const [{ data: p }, { data: dt }, { data: gl }, { data: rn }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).single(),
    supabase.from("day_types").select("*").eq("user_id", authUser.id),
    supabase.from("game_logs").select("*").eq("user_id", authUser.id),
    supabase.from("rest_notes").select("*").eq("user_id", authUser.id),
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
  return shapeUser(p, dayTypes, gameLogs, restNotes);
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
      role: "role", removed: "removed",
    };
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
    id: d.id, title: d.title, category: d.category, duration: d.duration, equipment: d.equipment,
    description: d.description, objective: d.objective,
    steps: d.steps || [], coachingPoints: d.coaching_points || [], mistakes: d.mistakes || [],
    published: d.published, imageAssetId: null, imageUrl: d.image_url || "", videoAssetId: null, videoUrl: d.video_url || "",
  });
  const toFocusShape = (f) => ({
    id: f.id, title: f.title, category: f.category, explanation: f.explanation, cue: f.cue,
    blocks: f.blocks || [], published: f.published,
    imageAssetId: null, imageUrl: f.image_url || "", videoAssetId: null, videoUrl: f.video_url || "",
  });
  const toWorkoutShape = (o) => ({
    id: o.id, title: o.title, category: o.category, duration: o.duration, equipment: o.equipment,
    description: o.description, objective: o.objective, exercises: o.exercises || [],
    published: o.published, imageAssetId: null, imageUrl: o.image_url || "", videoAssetId: null, videoUrl: o.video_url || "",
  });

  const trainingDaysShape = { Youth: [], Junior: [], Pro: [] };
  for (const row of trainingDays || []) {
    trainingDaysShape[row.level]?.push({
      id: row.id, drillId: row.drill_id || "", focusId: row.focus_id || "", workoutId: row.workout_id || "",
      title: row.title || "", subtitle: row.subtitle || "",
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
async function reconcileTable(table, nextRows, toRow) {
  const { data: existing } = await supabase.from(table).select("id");
  const nextIds = new Set(nextRows.map((r) => r.id).filter(Boolean));
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id));
  const ops = [];
  if (nextRows.length) ops.push(supabase.from(table).upsert(nextRows.map(toRow)).select());
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
    const { error: delErr } = await supabase.from("training_days").delete().eq("level", level);
    const rows = list.map((d, position) => ({
      id: d.id, level, position,
      drill_id: d.drillId || null, focus_id: d.focusId || null, workout_id: d.workoutId || null,
      title: d.title || null, subtitle: d.subtitle || null,
    }));
    const { error: insErr } = rows.length ? await supabase.from("training_days").insert(rows) : { error: null };
    if (delErr || insErr) allOk = false;
  }
  return allOk;
}

export async function updateContentFields(patch) {
  if (!patch || Object.keys(patch).length === 0) return true;
  try {
    const ok = [];
    if (patch.drills) {
      ok.push(await reconcileTable("drills", patch.drills, (d) => ({
        id: d.id, title: d.title, category: d.category, duration: d.duration, equipment: d.equipment,
        description: d.description, objective: d.objective,
        steps: d.steps || [], coaching_points: d.coachingPoints || [], mistakes: d.mistakes || [],
        published: !!d.published, image_url: d.imageUrl || null, video_url: d.videoUrl || null,
      })));
    }
    if (patch.focusPoints) {
      ok.push(await reconcileTable("focus_points", patch.focusPoints, (f) => ({
        id: f.id, title: f.title, category: f.category, explanation: f.explanation, cue: f.cue,
        blocks: f.blocks || [], published: !!f.published,
        image_url: f.imageUrl || null, video_url: f.videoUrl || null,
      })));
    }
    if (patch.offIceWorkouts) {
      ok.push(await reconcileTable("off_ice_workouts", patch.offIceWorkouts, (o) => ({
        id: o.id, title: o.title, category: o.category, duration: o.duration, equipment: o.equipment,
        description: o.description, objective: o.objective, exercises: o.exercises || [],
        published: !!o.published, image_url: o.imageUrl || null, video_url: o.videoUrl || null,
      })));
    }
    if (patch.categories) {
      const { error } = await supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (!error) {
        const rows = patch.categories.map((c) => ({ name: c.name, type: c.type }));
        const { error: insErr } = rows.length ? await supabase.from("categories").insert(rows) : { error: null };
        ok.push(!insErr);
      } else ok.push(false);
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

export async function deleteStorageObject(path) {
  if (!path) return;
  await supabase.storage.from("media").remove([path]);
}

// Pushes the confirmation-email template live via the update-confirmation-email
// Edge Function, which calls Supabase's Management API on our behalf (that API
// needs an account-level token the client must never hold — see the function's
// own source for details). Returns { ok } or { ok: false, error }.
export async function publishConfirmationEmail(fields) {
  const { data, error } = await supabase.functions.invoke("update-confirmation-email", { body: fields });
  if (error) {
    const message = (await error.context?.json?.().catch(() => null))?.error || error.message || "Failed to publish";
    return { ok: false, error: message };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
