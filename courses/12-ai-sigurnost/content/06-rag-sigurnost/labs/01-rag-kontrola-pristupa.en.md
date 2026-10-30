# Lab 1: Access control in RAG retrieval

The kurs-shop internal assistant answers questions from company documents (RAG). The problem: retrieval returns the most relevant documents **regardless of who is asking**, so the assistant can "quote" the payroll to a sales employee. The model must not be the place where rights are checked: a document the user isn't allowed to see must not even enter the context (OWASP LLM08: Vector and Embedding Weaknesses, LLM02: Sensitive Information Disclosure).

`/root/rag/dokumenti/` contains documents with a `grupe:` (groups) header saying who may read them, and `/root/rag/korisnici.json` contains the users and their groups. The documents are in Serbian, and so are the group names: `svi` = everyone, `prodaja` = sales, `uprava` = management, `hr`, `security`. Retrieval is simple (number of matching words); in reality it would be vector-based, but access control works the same way.

```bash
cd /root/rag
head -3 dokumenti/*.md
cat korisnici.json
```

<!-- setup
set -e
mkdir -p /root/rag/dokumenti
cd /root/rag/dokumenti
cat > politika-povrata.md <<'EOF'
grupe: svi
Politika povrata: kupac može vratiti robu u roku od 14 dana uz račun. Povrat novca ide na istu karticu.
EOF
cat > plate-2026.md <<'EOF'
grupe: hr, uprava
Plate 2026: prosječna plata u prodaji je 1850 KM. Kontakt za pitanja o plati: hr@kurs-shop.ba, IBAN za isplate BA391290079401028494.
EOF
cat > prodaja-cjenovnik.md <<'EOF'
grupe: prodaja, uprava
Cjenovnik za veleprodaju: popust 12 posto za narudžbe preko 500 KM. Povrat robe za veleprodaju je 7 dana.
EOF
cat > incident-2026-09.md <<'EOF'
grupe: security
Izvještaj o incidentu iz septembra: kompromitovan nalog prodaja2, lozinka promijenjena, kontakt soc@kurs-shop.ba.
EOF
cat > onboarding.md <<'EOF'
grupe: svi
Dobrodošlica: radno vrijeme je od 8 do 16. Kontakt za IT probleme: it@kurs-shop.ba.
EOF
cat > /root/rag/korisnici.json <<'EOF'
{
  "ana": ["prodaja"],
  "marko": ["hr"],
  "jelena": ["uprava"],
  "ivan": [],
  "sara": ["security", "prodaja"]
}
EOF
-->

## Retrieval with rights filtering

Write `/root/rag/pretraga.py` with a function `pretrazi(korisnik, upit, k=3)` (search(user, query, k=3)) that returns a list of document names (e.g., `"politika-povrata.md"`):

1. **First** drop the documents the user isn't allowed to read (the group `svi` is for everyone; otherwise the intersection of the user's groups and the document's groups must not be empty). An unknown user gets nothing.
2. Then rank the remaining ones by the number of query words (lowercase) that appear in the document text (without the header), descending; on a tie, by file name; documents with 0 matches are not returned.
3. Return at most `k` documents.

Running `/opt/ai/bin/python pretraga.py <user> "<query>"` prints the document names, one per line.

<!-- verify
cd /root/rag
[ -f pretraga.py ] || { echo "pretraga.py is missing"; exit 1; }
/opt/ai/bin/python - <<'EOF' || exit 1
import importlib.util, sys
spec = importlib.util.spec_from_file_location("p", "/root/rag/pretraga.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]
try: spec.loader.exec_module(m)
except SystemExit: pass
T = [(("ana", "povrat robe"), ["prodaja-cjenovnik.md", "politika-povrata.md"]),
     (("ivan", "povrat robe"), ["politika-povrata.md"]),
     (("ana", "plata kontakt"), ["onboarding.md"]),
     (("marko", "plata kontakt"), ["plate-2026.md", "onboarding.md"]),
     (("jelena", "plata povrat"), ["plate-2026.md", "politika-povrata.md", "prodaja-cjenovnik.md"]),
     (("sara", "incident lozinka"), ["incident-2026-09.md"]),
     (("ana", "incident lozinka"), []),
     (("nepoznati", "povrat"), []),
     (("jelena", "povrat robe", 1), ["prodaja-cjenovnik.md"])]
for args, want in T:
    got = m.pretrazi(*args)
    if list(got) != want: sys.exit(f"pretrazi{args} = {got}, expected {want}")
EOF
-->
<!-- hint
```python
def citaj(put):
    lines = open(put, encoding="utf-8").read().splitlines()
    grupe = {g.strip() for g in lines[0].split(":", 1)[1].split(",")}
    tekst = "\n".join(lines[1:]).lower()
    return grupe, tekst
```
Scoring: `sum(1 for r in set(upit.lower().split()) if r in tekst)`. Filtering **before** ranking and the `k` limit matters: if you filter after `top-k`, the user gets fewer results, and in a real system information about the existence of documents still "leaks" through the ranking.
-->
<!-- solution
cat > /root/rag/pretraga.py <<'EOF'
import json, os, sys
D = "/root/rag/dokumenti"
KORISNICI = json.load(open("/root/rag/korisnici.json"))

def citaj(put):
    lines = open(put, encoding="utf-8").read().splitlines()
    grupe = {g.strip() for g in lines[0].split(":", 1)[1].split(",")}
    return grupe, "\n".join(lines[1:])

def pretrazi(korisnik, upit, k=3):
    if korisnik not in KORISNICI:
        return []
    moje = set(KORISNICI[korisnik])
    rijeci = set(upit.lower().split())
    rez = []
    for f in sorted(os.listdir(D)):
        grupe, tekst = citaj(os.path.join(D, f))
        if "svi" not in grupe and not (grupe & moje):
            continue
        s = sum(1 for r in rijeci if r in tekst.lower())
        if s > 0:
            rez.append((-s, f))
    return [f for _, f in sorted(rez)[:k]]

if __name__ == "__main__" and len(sys.argv) >= 3:
    for f in pretrazi(sys.argv[1], " ".join(sys.argv[2:])):
        print(f)
EOF
-->

## Redaction before the context

Even a document the user is allowed to read may contain data the model doesn't need (and that ends up in the provider's logs). Add a function `kontekst(korisnik, upit, k=3)` (context) to `pretraga.py` that returns a list of strings: the text of each document from `pretrazi` (without the header), with email addresses replaced by `[EMAIL]` and IBANs by `[IBAN]`.

<!-- verify
/opt/ai/bin/python - <<'EOF' || exit 1
import importlib.util, sys
spec = importlib.util.spec_from_file_location("p", "/root/rag/pretraga.py"); m = importlib.util.module_from_spec(spec)
sys.argv = ["x"]
try: spec.loader.exec_module(m)
except SystemExit: pass
if not hasattr(m, "kontekst"): sys.exit("the kontekst function is missing")
c = m.kontekst("marko", "plata kontakt")
if len(c) != 2: sys.exit(f"the context for marko needs 2 documents, it has {len(c)}")
s = "\n".join(c)
if "@" in s or "BA39" in s: sys.exit("email or IBAN not redacted")
if "[EMAIL]" not in s or "[IBAN]" not in s: sys.exit("expected the [EMAIL] and [IBAN] markers")
if "grupe:" in s: sys.exit("the grupe: header must not go into the context")
if "1850 KM" not in s: sys.exit("the rest of the text must remain")
if m.kontekst("ana", "plata kontakt") != [x for x in m.kontekst("ana", "plata kontakt") if "1850" not in x]: sys.exit("ana must not get payroll data")
EOF
-->
<!-- hint
```python
import re
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")
```
-->
<!-- solution
cat >> /root/rag/pretraga.py <<'EOF'

import re
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")

def kontekst(korisnik, upit, k=3):
    out = []
    for f in pretrazi(korisnik, upit, k):
        _, tekst = citaj(os.path.join(D, f))
        out.append(IBAN.sub("[IBAN]", EMAIL.sub("[EMAIL]", tekst)))
    return out
EOF
-->
