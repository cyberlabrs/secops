#!/usr/bin/env python3
"""iam-eval: pojednostavljeni offline evaluator AWS politika (za labove).

Primjer (politike: --identity, --resource-policy, --scp, --rcp, --boundary, --session):
  iam-eval --identity politika.json --principal arn:aws:iam::111122223333:role/app \
           --action s3:GetObject --resource arn:aws:s3:::bucket/kljuc \
           --context aws:SecureTransport=true --context aws:SourceVpce=vpce-1a2b

Logika (unutar jednog naloga, kao u IAM dokumentaciji):
  1. eksplicitni Deny u bilo kojoj politici            -> DENY (explicit)
  2. SCP (ako je zadan) mora imati Allow                -> inače DENY (implicit, SCP)
  3. RCP (ako je zadan) mora imati Allow                -> inače DENY (implicit, RCP)
  4. permission boundary (ako je zadan) mora imati Allow -> inače DENY (implicit, boundary)
  5. session policy (ako je zadana) mora imati Allow    -> inače DENY (implicit, session)
  6. Allow u identity ILI resource politici             -> ALLOW
  7. ništa                                              -> DENY (implicit)
Napomena: u stvarnom AWS-u resource politika koja dozvolu daje direktno ARN-u IAM korisnika ili
ARN-u sesije uloge nije ograničena implicitnim denyjem boundaryja/session politike (dozvola data
ARN-u uloge jeste). Ovaj alat to pojednostavljuje i uvijek primjenjuje boundary. Cross-account nije podržan.

Uslovi: String*, Arn*, Bool, Numeric*, Date*, IpAddress/NotIpAddress, Null, sufiks IfExists,
prefiksi ForAnyValue:/ForAllValues:. Višestruke vrijednosti ključa u kontekstu: key=a,b
"""
import argparse, fnmatch, ipaddress, json, sys
from datetime import datetime


import re

CTX = {}  # kontekst zahtjeva, za zamjenu varijabli ${aws:...} u politikama


def as_list(x):
    return x if isinstance(x, list) else [x]


def subst(v):
    """Zamjenjuje policy varijable (npr. ${aws:PrincipalTag/team}) vrijednošću iz konteksta."""
    def rep(m):
        vals = CTX.get(m.group(1).lower())
        return vals[0] if vals else "\x00nema-vrijednosti\x00"
    return re.sub(r"\$\{([^}]+)\}", rep, str(v))


def wild(pattern, value, ci=False):
    if ci:
        pattern, value = pattern.lower(), value.lower()
    return fnmatch.fnmatchcase(value, pattern)


def match_action(stmt, action):
    if "Action" in stmt:
        return any(wild(a, action, ci=True) for a in as_list(stmt["Action"]))
    if "NotAction" in stmt:
        return not any(wild(a, action, ci=True) for a in as_list(stmt["NotAction"]))
    return False


def match_resource(stmt, resource):
    if "Resource" in stmt:
        return any(wild(subst(r), resource) for r in as_list(stmt["Resource"]))
    if "NotResource" in stmt:
        return not any(wild(subst(r), resource) for r in as_list(stmt["NotResource"]))
    return True  # resource politike u labu uvijek navode Resource; trust politike nemaju Resource


def match_principal(stmt, principal):
    if "Principal" not in stmt and "NotPrincipal" not in stmt:
        return True
    def hit(p):
        if p == "*":
            return True
        if isinstance(p, dict):
            vals = []
            for v in p.values():
                vals += as_list(v)
            for v in vals:
                if v == "*" or v == principal:
                    return True
                acct = principal.split(":")[4] if principal.count(":") >= 5 else ""
                if v in (acct, f"arn:aws:iam::{acct}:root"):
                    return True
                if v.endswith(".amazonaws.com") and v == principal:
                    return True
        return False
    if "Principal" in stmt:
        return hit(stmt["Principal"])
    return not hit(stmt["NotPrincipal"])


def parse_date(v):
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def cmp_one(op, want, have):
    base = op.replace("IfExists", "")
    if base in ("StringEquals", "ArnEquals"):
        return have == want
    if base == "StringEqualsIgnoreCase":
        return have.lower() == want.lower()
    if base in ("StringLike", "ArnLike"):
        return wild(want, have)
    if base == "Bool":
        return str(have).lower() == str(want).lower()
    if base.startswith("Numeric"):
        a, b = float(have), float(want)
        return {"NumericEquals": a == b, "NumericLessThan": a < b, "NumericLessThanEquals": a <= b,
                "NumericGreaterThan": a > b, "NumericGreaterThanEquals": a >= b}[base]
    if base.startswith("Date"):
        a, b = parse_date(have), parse_date(want)
        return {"DateEquals": a == b, "DateLessThan": a < b, "DateLessThanEquals": a <= b,
                "DateGreaterThan": a > b, "DateGreaterThanEquals": a >= b}[base]
    if base == "IpAddress":
        return ipaddress.ip_address(have) in ipaddress.ip_network(want, strict=False)
    raise ValueError(f"nepodržan operator {op}")


NEGATED = {"StringNotEquals": "StringEquals", "StringNotEqualsIgnoreCase": "StringEqualsIgnoreCase",
           "StringNotLike": "StringLike", "ArnNotEquals": "ArnEquals", "ArnNotLike": "ArnLike",
           "NotIpAddress": "IpAddress", "NumericNotEquals": "NumericEquals", "DateNotEquals": "DateEquals"}


def eval_condition(cond, ctx):
    for raw_op, block in cond.items():
        qual, op = (raw_op.split(":", 1) + [None])[:2] if ":" in raw_op else (None, raw_op)
        if op is None:
            op = raw_op
        if_exists = op.endswith("IfExists")
        base = op.replace("IfExists", "")
        for key, wants in block.items():
            wants = [subst(w) for w in as_list(wants)]
            have_vals = ctx.get(key.lower())
            if base == "Null":
                missing = have_vals is None
                if not any((w.lower() == "true") == missing for w in wants):
                    return False
                continue
            if have_vals is None:
                if if_exists:
                    continue
                if base in NEGATED:
                    continue  # negirani operator nad ključem koji ne postoji je tačan
                return False
            negated = base in NEGATED
            pos = NEGATED.get(base, base)
            def any_match(h):
                return any(cmp_one(pos, w, h) for w in wants)
            if qual == "ForAllValues":
                ok = all(any_match(h) for h in have_vals)
                ok = (not ok) if negated else ok
            elif qual == "ForAnyValue" or len(have_vals) > 1:
                ok = any(any_match(h) for h in have_vals)
                ok = (not ok) if negated else ok
            else:
                m = any_match(have_vals[0])
                ok = (not m) if negated else m
            if not ok:
                return False
    return True


def statements(doc):
    return as_list(doc.get("Statement", []))


def applies(stmt, principal, action, resource, ctx, check_principal):
    if check_principal and not match_principal(stmt, principal):
        return False
    return (match_action(stmt, action) and match_resource(stmt, resource)
            and eval_condition(stmt.get("Condition", {}), ctx))


def evaluate(policies, principal, action, resource, ctx):
    """policies: lista (vrsta, ime, dokument). vrste: identity, resource, scp, rcp, boundary, session"""
    CTX.clear(); CTX.update(ctx)
    matched = {}
    for kind, name, doc in policies:
        for i, st in enumerate(statements(doc)):
            if applies(st, principal, action, resource, ctx, check_principal=kind == "resource"):
                sid = st.get("Sid", f"#{i}")
                if st.get("Effect") == "Deny":
                    return "DENY", f"eksplicitni Deny: {name} ({sid})"
                matched.setdefault(kind, []).append(f"{name} ({sid})")
    kinds = {k for k, _, _ in policies}
    for gate, label in (("scp", "SCP"), ("rcp", "RCP"), ("boundary", "permission boundary"), ("session", "session policy")):
        if gate in kinds and gate not in matched:
            return "DENY", f"implicitni deny: {label} ne dozvoljava akciju"
    allows = matched.get("identity", []) + matched.get("resource", [])
    if allows:
        return "ALLOW", "dozvoljeno: " + ", ".join(allows)
    return "DENY", "implicitni deny: nijedna politika ne dozvoljava akciju"


def load(path):
    with open(path) as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description="Pojednostavljeni offline evaluator AWS politika")
    kinds = {"identity": "identity", "resource-policy": "resource", "scp": "scp", "rcp": "rcp", "boundary": "boundary", "session": "session"}
    for flag in kinds:
        ap.add_argument(f"--{flag}", action="append", default=[], metavar="FAJL")
    ap.add_argument("--principal", default="arn:aws:iam::111122223333:role/test")
    ap.add_argument("--action", required=True)
    ap.add_argument("--resource", default="*")
    ap.add_argument("--context", action="append", default=[], metavar="KLJUČ=VRIJEDNOST")
    a = ap.parse_args()
    ctx = {}
    for c in a.context:
        k, v = c.split("=", 1)
        ctx[k.lower()] = v.split(",")
    ctx.setdefault("aws:principalarn", [a.principal])
    pols = []
    for flag, kind in kinds.items():
        for p in getattr(a, flag.replace("-", "_")):
            pols.append((kind, p, load(p)))
    decision, why = evaluate(pols, a.principal, a.action, a.resource, ctx)
    print(f"{decision}  {a.action} {a.resource}\n  {why}")
    sys.exit(0 if decision == "ALLOW" else 1)


if __name__ == "__main__":
    main()
