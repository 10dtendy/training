// Lets a coach publish edits to Supabase Auth's "Confirm signup" email
// (subject + layout) from the app's own admin panel. The Management API this
// calls needs an account-level Personal Access Token — far broader than this
// one setting — so that token is never sent by the client. It must be set as
// this function's own secret (SUPABASE_MANAGEMENT_TOKEN) directly in the
// Supabase dashboard: Project Settings -> Edge Functions -> Secrets.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROJECT_REF = "cylzjvrzikgakethelst";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildHtml({ heading, body, buttonText, footer, accentColor }: {
  heading: string; body: string; buttonText: string; footer: string; accentColor: string;
}) {
  const paragraphs = String(body || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3f3f46;">${escapeHtml(p)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:${escapeHtml(accentColor)};padding:22px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.06em;">10DTENDY</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:21px;color:#18181b;">${escapeHtml(heading)}</h1>
          ${paragraphs}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 28px;">
            <tr><td style="border-radius:8px;background-color:${escapeHtml(accentColor)};">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(buttonText)}</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">${escapeHtml(footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "coach") return json({ error: "Coaches only" }, 403);

    const managementToken = Deno.env.get("SUPABASE_MANAGEMENT_TOKEN");
    if (!managementToken) {
      return json({ error: "Not set up yet: this project's edge function is missing the SUPABASE_MANAGEMENT_TOKEN secret. Add it in the Supabase dashboard under Project Settings -> Edge Functions -> Secrets." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { subject, heading, body: bodyText, buttonText, footer, accentColor } = body;
    if (!subject?.trim() || !heading?.trim() || !buttonText?.trim()) {
      return json({ error: "Subject, heading, and button text are required" }, 400);
    }

    const html = buildHtml({
      heading, body: bodyText || "", buttonText, footer: footer || "",
      accentColor: accentColor || "#BE202E",
    });

    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mailer_subjects_confirmation: subject,
        mailer_templates_confirmation_content: html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return json({ error: `Supabase rejected the update (${res.status}): ${errText.slice(0, 300)}` }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
