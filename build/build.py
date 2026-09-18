#!/usr/bin/env python3
"""
Builds 10dtendy-app.jsx into a single runnable HTML file for either local
browser testing or real publishing to the Claude Artifact.

Usage:
  python3 build/build.py local     -> build/output/local.html
                                       (demo login + persistence bypassed,
                                       for testing in a sandboxed browser
                                       with no real db backend)
  python3 build/build.py publish   -> build/output/publish.html
                                       (untouched app code, for `Artifact`
                                       publish)

The stripping step removes the ES-module `import ...;` statements at the
top of the source (which can span multiple lines) and turns
`export default function App() {` into `function App() {`, since the
header supplies its own UMD-global equivalents (React, LucideReact) and
the footer references `<App />` directly. Handling multi-line imports
correctly matters: a naive line-by-line strip that only recognizes
single-line "import ..." leaves dangling fragments of a multi-line
import behind, which breaks Babel parsing and blanks the whole app.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "10dtendy-app.jsx"
BUILD_DIR = Path(__file__).resolve().parent
OUT_DIR = BUILD_DIR / "output"

IMPORT_RE = re.compile(r"^import\b[\s\S]*?;[ \t]*\n?", re.MULTILINE)
EXPORT_DEFAULT_RE = re.compile(r"^export default (?=function|class|const)", re.MULTILINE)


def strip_for_browser(src: str) -> str:
    src = IMPORT_RE.sub("", src)
    src = EXPORT_DEFAULT_RE.sub("", src)
    return src


def patch_for_local_testing(src: str) -> str:
    # Bypass real backend calls (no `db` capability exists outside a real
    # published artifact view) so the app is clickable in a plain sandboxed
    # browser: demo login skips straight to a fake user, and day-type/game
    # writes go only to local React state instead of `updateUserFields`.
    src = src.replace(
        "const demoLogin = async () => {",
        (
            "const demoLogin = async () => {\n"
            "    onAuthed({ name: \"Demo Coach\", email: \"coach@10dtendy.app\", "
            "password: \"demo\", role: \"coach\", "
            "createdAt: Date.now() - 90 * 86400000 }); return;"
        ),
        1,
    )
    src = src.replace(
        (
            "  const setDayType = async (dateStr, type) => {\n"
            "    // \"none\" (not deletion) so this always overrides a coach-scheduled rest day for that date.\n"
            "    const value = type || \"none\";\n"
            "    const ok = await updateUserFields(user.email, { dayTypes: { [dateStr]: value } });\n"
            "    if (ok) setUser((prev) => ({ ...prev, dayTypes: { ...(prev.dayTypes || {}), [dateStr]: value } }));\n"
            "    return ok;\n"
            "  };"
        ),
        (
            "  const setDayType = async (dateStr, type) => {\n"
            "    // \"none\" (not deletion) so this always overrides a coach-scheduled rest day for that date.\n"
            "    const value = type || \"none\";\n"
            "    setUser((prev) => ({ ...prev, dayTypes: { ...(prev.dayTypes || {}), [dateStr]: value } }));\n"
            "    return true;\n"
            "  };"
        ),
        1,
    )
    return src


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("local", "publish"):
        print(__doc__)
        sys.exit(1)
    mode = sys.argv[1]

    src = SRC.read_text()
    body = strip_for_browser(src)
    if mode == "local":
        body = patch_for_local_testing(body)
        header = (BUILD_DIR / "header.html").read_text()
    else:
        header = (BUILD_DIR / "publish_header.html").read_text()
    footer = (BUILD_DIR / "footer.html").read_text()

    OUT_DIR.mkdir(exist_ok=True)
    out_path = OUT_DIR / f"{mode}.html"
    out_path.write_text(header + body + footer)
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
