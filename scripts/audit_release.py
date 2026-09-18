# -*- coding: utf-8 -*-
"""Release gate: do models/tea/, public/models/ and the docs still agree?

    python scripts/audit_release.py     # exits non-zero on any disagreement

WHY THIS EXISTS: the honest numbers in this project are spread across a
published card, a provenance file, a taxonomy, an evaluation dump and five
markdown documents. Every one of those is a place a number can be edited without
the others noticing, and a model card that disagrees with the artifact it
describes is worse than no card at all — it is a confident wrong claim.

So nothing here restates a metric. It reads the authoritative artifacts, hashes
the bytes that actually ship, and fails if any two sources disagree. In
particular it re-checks, every run, the two claims the UI is forbidden to make:
that blister blight or red rust were ever tested outside the data they were
trained on.
"""
import json, hashlib, pathlib, re, sys
sys.stdout.reconfigure(encoding="utf-8")

M = pathlib.Path("models/tea")
P = pathlib.Path("public/models")

pub_card = json.loads((P / "tea-disease-mnv3s-card.json").read_text(encoding="utf-8"))
src_card = json.loads((M / "tea-disease-mnv3s-card.json").read_text(encoding="utf-8"))
pub_onnx = (P / "tea-disease-mnv3s.onnx").read_bytes()
src_onnx = (M / "tea-disease-mnv3s-1.0.0.onnx").read_bytes()
prov = json.loads((M / "provenance.json").read_text(encoding="utf-8"))
tax = json.loads((M / "taxonomy.json").read_text(encoding="utf-8"))
ev = json.loads((M / "evaluation.json").read_text(encoding="utf-8"))

fails = []


def check(label, ok, detail=""):
    print(("  OK   " if ok else "  FAIL ") + label + (("  " + detail) if detail else ""))
    if not ok:
        fails.append(label)


print("ARTIFACT IDENTITY")
ph = hashlib.sha256(pub_onnx).hexdigest()
sh = hashlib.sha256(src_onnx).hexdigest()
check("published .onnx == models/tea .onnx", ph == sh, ph[:16])
check("card.model.sha256 == published bytes", pub_card["model"]["sha256"] == ph)
check("card.model.bytes == published length", pub_card["model"]["bytes"] == len(pub_onnx),
      f"{pub_card['model']['bytes']} vs {len(pub_onnx)}")
check("published card == source card", pub_card == src_card)

print("\nVERSIONS")
check("card schemaVersion present", "schemaVersion" in pub_card, str(pub_card.get("schemaVersion")))
check("card.model.version", bool(pub_card["model"]["version"]), pub_card["model"]["version"])
check("taxonomy_version matches taxonomy.json",
      pub_card["taxonomy"]["taxonomy_version"] == tax.get("taxonomy_version"),
      f"{pub_card['taxonomy']['taxonomy_version']} vs {tax.get('taxonomy_version')}")
check("card.model.file names the versioned artifact",
      pub_card["model"]["version"] in pub_card["model"]["file"], pub_card["model"]["file"])

print("\nTAXONOMY")
tax_active = [c for c in tax["classes"] if c.get("active")]
check("active class count == card classes",
      len(tax_active) == len(pub_card["taxonomy"]["classes"]),
      f"{len(tax_active)} vs {len(pub_card['taxonomy']['classes'])}")
for i, c in enumerate(pub_card["taxonomy"]["classes"]):
    if c["outputIndex"] != i:
        check(f"class {c['key']} outputIndex == array index", False)
        break
else:
    check("card classes are in output order", True)

print("\nEVALUATION")
km = pub_card["evaluation"]["key_metrics"]
ev_tests = ev.get("test_sets", ev)
print("   card key_metrics:", list(km))
for name, m in km.items():
    print(f"   {name}: n={m['samples']} acc={m['accuracy']} f1={m['macro_f1']} ece={m['ece']}")
cross = [n for n in km if "cross-dataset" in n.lower()]
check("at least one cross-dataset test set is reported", len(cross) >= 1, str(cross))
validated = set()
for n in cross:
    validated |= set(km[n]["classes_present"])
for forbidden in ("blister_blight", "red_rust"):
    check(f"{forbidden} NOT in any cross-dataset set", forbidden not in validated)

print("\nABSTENTION")
ab = pub_card["abstention"]
check("threshold beats chance", ab["threshold"] > 1 / len(pub_card["taxonomy"]["classes"]),
      str(ab["threshold"]))
check("selected on validation only", "valid" in ab["selected_on"].lower(), ab["selected_on"])
cov = ab.get("coverage_by_test_set", {})
for k, v in cov.items():
    print(f"   {k}: coverage={v['coverage']} acc_on_accepted={v['accuracy_on_accepted']}")
check("coverage reported per test set", len(cov) >= 1)

print("\nPROVENANCE / LICENCES")
for d in prov.get("datasets", prov.get("sources", [])):
    name = d.get("id") or d.get("name")
    lic = d.get("licence") or d.get("license")
    print(f"   {name}: {lic}")
    check(f"{name} licence recorded", bool(lic))
    check(f"{name} licence is redistributable", "NC" not in str(lic).upper().replace("INC", ""),
          str(lic))

print("\nLIMITATIONS")
lim = pub_card["known_limitations"]
print(f"   {len(lim)} recorded")
joined = " ".join(lim).lower()
for must in ("blister", "red rust", "tea"):
    check(f"limitations mention '{must}'", must in joined)

# --------------------------------------------------------------------------
# Hardware claims must match the hardware code that exists
# --------------------------------------------------------------------------

print("\nHARDWARE CLAIMS")

# Establish what is actually built rather than trusting any document. The sensor
# lane counts as implemented only if something WRITES a reading: the table, the
# calibration store, the plausibility guard and the anchoring ladder all exist
# and all READ, which is exactly why prose kept drifting into claiming it works.
_TS = [q for d in ("app", "components", "lib", "test") for q in pathlib.Path(d).rglob("*")
       if q.suffix in (".ts", ".tsx")]
_code = {q: q.read_text(encoding="utf-8") for q in _TS}

writes_readings = [
    str(q) for q, txt in _code.items()
    if "addSensorReadings(" in txt and "export async function addSensorReadings" not in txt
]
serial_api = [str(q) for q, txt in _code.items() if "navigator.serial" in txt]
sensor_implemented = bool(writes_readings or serial_api)
print("   addSensorReadings callers: %s" % (writes_readings or "none"))
print("   navigator.serial usage:    %s" % (serial_api or "none"))
print("   => sensor lane implemented: %s" % sensor_implemented)

# Substrings that only appear in prose asserting a probe is actually being read.
CLAIMS = [
    "reads a soil probe",
    "probe talks to the page",
    "reads a probe over usb",
    "soil probe over usb and the code path works",
    "sensor lane is working",
]
# DECISIONS.md is excluded on purpose: it is a dated log, and its original
# wording is kept beside a correction rather than rewritten.
PROSE = [pathlib.Path(f) for f in (
    "app/whats-real/page.tsx", "README.md", "PROJECT.md", "NEXT-STEPS.md",
    "DEPLOY.md", "ML.md", "SCHEMA.md", "PARKED.md", "BROWSER-SMOKE-TEST.md",
) if pathlib.Path(f).exists()]

offenders = []
for f in PROSE:
    low = f.read_text(encoding="utf-8").lower()
    for claim in CLAIMS:
        if claim in low:
            offenders.append("%s: '%s'" % (f, claim))

if sensor_implemented:
    check("sensor claims permitted (a writer now exists)", True)
else:
    check("no document claims the soil probe is being read",
          not offenders, "; ".join(offenders))
    # Silence is not enough on the honesty page: it must say so positively.
    wr = pathlib.Path("app/whats-real/page.tsx").read_text(encoding="utf-8").lower()
    check("/whats-real states the sensor is not implemented",
          "not implemented" in wr and "no usb or web serial" in wr)

# --------------------------------------------------------------------------
# Repository hygiene: navigation, test counts, links, committed junk
# --------------------------------------------------------------------------

print("\nREPOSITORY")

MD = sorted(pathlib.Path(".").glob("*.md")) + [
    q for q in pathlib.Path("models").rglob("*.md")
] + [q for q in pathlib.Path("ml").rglob("*.md")]

# --- every route with a page is reachable from the nav --------------------
nav = pathlib.Path("components/shell/Nav.tsx").read_text(encoding="utf-8")
def _route(q):
    rel = str(q.parent.relative_to("app")).replace("\\", "/")
    return "/" if rel == "." else "/" + rel

routes = sorted(_route(q) for q in pathlib.Path("app").rglob("page.tsx"))
# Routes reached from inside a flow rather than the bar, by design.
NAV_EXEMPT = {"/", "/login", "/signup", "/privacy", "/whats-real", "/grow/diagnose",
              "/documents/invoice", "/documents/packing-list",
              "/documents/certificate-of-origin", "/plot/[id]", "/verify/[id]"}
unlinked = [r for r in routes if r not in NAV_EXEMPT and f'"{r}"' not in nav]
check("every top-level route is in the nav", not unlinked, str(unlinked))
check("/models exists and is linked",
      pathlib.Path("app/models/page.tsx").exists() and '"/models"' in nav)

# --- no document states a stale test count --------------------------------
# Counted statically from the suites themselves: every `test(` call increments
# the counter the runner prints, so the two cannot disagree.
actual_tests = sum(
    len([ln for ln in q.read_text(encoding="utf-8").splitlines() if ln.startswith("test(")])
    for q in sorted(pathlib.Path("test").glob("*.test.ts"))
)
print(f"   test() declarations across test/: {actual_tests}")
stale_counts = []
for f in [x for x in MD if x.name != "DECISIONS.md"]:
    for m in re.finditer(r"(\d{2,4})\s+(?:unit\s+)?tests\b", f.read_text(encoding="utf-8")):
        if int(m.group(1)) != actual_tests:
            stale_counts.append(f"{f}: '{m.group(0)}' (actual {actual_tests})")
check("no document states a stale test count", not stale_counts, "; ".join(stale_counts))

# --- internal markdown links resolve --------------------------------------
broken = []
for f in MD:
    for m in re.finditer(r"\]\(([^)#:]+?)(?:#[^)]*)?\)", f.read_text(encoding="utf-8")):
        target = m.group(1).strip()
        if target.startswith(("http", "mailto:", "/")):
            continue
        if not (f.parent / target).exists():
            broken.append(f"{f} -> {target}")
check("every relative markdown link resolves", not broken, "; ".join(broken[:8]))

# --- nothing generated is committed ---------------------------------------
import subprocess
tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split()
JUNK = ("__pycache__", ".next/", "node_modules/", ".DS_Store")
junk = [t for t in tracked if any(j in t for j in JUNK)]
# Model binaries belong in public/ (the app serves them) and nowhere else.
stray_weights = [t for t in tracked
                 if t.endswith((".pt", ".onnx", ".onnx.data")) and not t.startswith("public/models/")]
check("no generated junk is committed", not junk, "; ".join(junk[:8]))
check("no model weights committed outside public/models", not stray_weights, "; ".join(stray_weights))
check("no stray __pycache__ on disk",
      not list(pathlib.Path(".").glob("*/__pycache__")) and not list(pathlib.Path("ml").glob("*/__pycache__")))

print("\nDOC AGREEMENT")
for doc in ("PROJECT.md", "NEXT-STEPS.md", "DECISIONS.md", "ML.md", "BROWSER-SMOKE-TEST.md"):
    text = pathlib.Path(doc).read_text(encoding="utf-8")
    # any 64-hex string in the doc must be the published sha
    for h in re.findall(r"\b[0-9a-f]{64}\b", text):
        check(f"{doc} sha256 matches published", h == ph, h[:16])
    # any explicit byte count
    for b in re.findall(r"6,?3\d{2},?\d{3}", text):
        n = int(b.replace(",", ""))
        check(f"{doc} byte count matches", n == len(pub_onnx), b)

print("\n%d failure(s)" % len(fails))
sys.exit(1 if fails else 0)
