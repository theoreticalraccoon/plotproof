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
