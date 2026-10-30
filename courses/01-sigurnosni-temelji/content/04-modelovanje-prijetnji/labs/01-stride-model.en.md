# Lab 1: STRIDE model for an ordering application

You've been given a system description and a data flow diagram. First you'll classify a set of prepared threats, then write your own mini model with controls. The result is a CSV file that in a real team would become a list of tickets.

Everything is in `/root/model/`. The lab files are in Serbian; translations are given below where you need them.

<!-- setup
set -e
mkdir -p /root/model && cd /root/model
cat > sistem.txt <<'EOF'
SISTEM: Aplikacija za narudžbe ("Narudzbe")

 [Kupac] --HTTPS==> | (Web API) --SQL/TLS==> ||Baza narudzbi||
                    |     |
   granica 1:       |     +--poruka==> ||Red (SQS)|| ==> (Worker) --HTTPS==> [Email servis]
   internet / VPC   |                                       |
                    |                                       +--zapis==> ||Audit log||
 [Admin] --HTTPS==> | (Admin panel) --SQL==> ||Baza narudzbi||
   granica 2: admin zona

Elementi (koristi TAČNO ove nazive u CSV-u):
  Kupac, Admin, Email servis            vanjski entiteti
  Web API, Admin panel, Worker          procesi
  Baza narudzbi, Red, Audit log         skladišta podataka
  Kupac->Web API, Web API->Baza narudzbi, Web API->Red, Worker->Email servis   tokovi
EOF
cat > klasifikacija.txt <<'EOF'
# Upiši jedno slovo (S, T, R, I, D ili E) umjesto znaka ? na kraju svake linije.
1. Napadač koristi ukradeni kolačić sesije drugog kupca: ?
2. Kupac mijenja ID narudžbe u URL-u i vidi tuđu adresu dostave: ?
3. Worker ne bilježi kome je poslao email, pa se ne može dokazati slanje: ?
4. Bot šalje 10.000 zahtjeva u sekundi na /api/search i API prestaje odgovarati: ?
5. Poruka u redu se mijenja između Web API-ja i Workera jer ništa ne provjerava integritet: ?
6. Admin panel prihvata parametar role=superadmin iz forme i dodjeljuje ga: ?
7. Lažni server se predstavlja kao Email servis jer Worker ne provjerava certifikat: ?
8. Backup baze narudžbi je u javno dostupnom bucketu: ?
EOF
printf 'element,kategorija,prijetnja,kontrola\n' > model.csv
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: STRIDE model ===
cat /root/model/sistem.txt
EOF
-->

## Get to know the system

```bash
cat /root/model/sistem.txt
```

The element names in the diagram (use them EXACTLY as written in the CSV):

- External entities: `Kupac` (customer), `Admin`, `Email servis` (email service)
- Processes: `Web API`, `Admin panel`, `Worker`
- Data stores: `Baza narudzbi` (orders database), `Red` (queue, SQS), `Audit log`
- Flows: `Kupac->Web API`, `Web API->Baza narudzbi`, `Web API->Red`, `Worker->Email servis`

Boundary 1 is internet / VPC, boundary 2 is the admin zone.

Answer these for yourself before continuing:

- Where are the trust boundaries and which flows cross them?
- Which element holds the most sensitive data?
- What would an attacker attack first from the outside?

## Classify the threats

Open `/root/model/klasifikacija.txt` and replace each `?` with the STRIDE category letter for each of the 8 threats.

```bash
nano /root/model/klasifikacija.txt
```

The threats in the file, in English:

1. An attacker uses another customer's stolen session cookie.
2. A customer changes the order ID in the URL and sees someone else's delivery address.
3. The Worker doesn't record whom it sent an email to, so sending can't be proven.
4. A bot sends 10,000 requests per second to /api/search and the API stops responding.
5. A message in the queue is modified between the Web API and the Worker because nothing checks integrity.
6. The Admin panel accepts a role=superadmin parameter from a form and assigns it.
7. A fake server poses as the Email service because the Worker doesn't verify the certificate.
8. The orders database backup is in a publicly accessible bucket.

<!-- verify
f=/root/model/klasifikacija.txt
want="S I R D T E S I"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([A-Za-z?])[[:space:]]*$/\1/' | tr a-z A-Z)
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Incorrect or empty for threats:$bad"; exit 1; }
-->
<!-- hint
For each threat, ask which property is violated: authenticity (S), integrity (T), non-repudiation (R), confidentiality (I), availability (D) or authorization (E). Threat 2 looks like an authorization problem, but the consequence it describes is **disclosure** of someone else's data. In OWASP it's called IDOR.
-->
<!-- solution
cd /root/model
sed -i -E '2s/\?$/S/; 3s/\?$/I/; 4s/\?$/R/; 5s/\?$/D/; 6s/\?$/T/; 7s/\?$/E/; 8s/\?$/S/; 9s/\?$/I/' klasifikacija.txt
-->

## Build your own model

In `/root/model/model.csv` add **at least six rows**, one for each STRIDE letter. Format: `element,kategorija,prijetnja,kontrola` (element, category, threat, control; keep the header as it is).

- `element` must be one of the names from `sistem.txt`.
- `kategorija` is a single letter: S, T, R, I, D or E.
- `prijetnja` and `kontrola` are short sentences **without commas** (you may write them in English).
- The threats must be your own, not the ones from step 2.

Example row:

```text
Red,T,any service in the VPC can write a message to the queue,IAM policy allows SendMessage only for the Web API role
```

```bash
nano /root/model/model.csv
column -s, -t /root/model/model.csv
```

<!-- verify
f=/root/model/model.csv
els="Kupac|Admin|Email servis|Web API|Admin panel|Worker|Baza narudzbi|Red|Audit log|Kupac->Web API|Web API->Baza narudzbi|Web API->Red|Worker->Email servis"
rows=$(tail -n +2 $f | grep -v '^[[:space:]]*$')
[ -n "$rows" ] || { echo "model.csv has no rows"; exit 1; }
bad=$(echo "$rows" | awk -F, -v els="$els" 'BEGIN{n=split(els,a,"|");for(i=1;i<=n;i++)ok[a[i]]=1}
  { if (NF!=4) {print NR": treba tačno 4 polja (bez zareza u tekstu)"; next}
    if (!($1 in ok)) print NR": nepoznat element \""$1"\""
    if ($2 !~ /^[STRIDE]$/) print NR": kategorija mora biti S,T,R,I,D ili E"
    if (length($3)<10 || length($4)<10) print NR": prijetnja i kontrola trebaju biti opisne (10+ znakova)" }')
[ -z "$bad" ] || { echo "$bad"; exit 1; }
for c in S T R I D E; do echo "$rows" | awk -F, -v c=$c '$2==c{f=1} END{exit !f}' || { echo "Category $c is missing"; exit 1; }; done
exit 0
-->
<!-- hint
Go through the elements using the "STRIDE per element" table from the lesson. For example: Kupac (S: account takeover), Kupac->Web API (I: traffic without TLS), Worker (R: no log of sent emails), Web API (D: no rate limit), Admin panel (E: no role check), Baza narudzbi (T: the application has DROP privileges).
-->
<!-- solution
cat >> /root/model/model.csv <<'EOF'
Kupac,S,napadač preuzima nalog kupca pogađanjem lozinke,MFA i ograničenje broja pokušaja prijave
Web API->Red,T,poruka u redu se mijenja prije nego što je Worker obradi,potpis poruke i IAM politika samo za Web API
Admin panel,R,admin briše narudžbu i to nigdje nije zabilježeno,nepromjenljiv audit log sa identitetom admina
Kupac->Web API,I,saobraćaj se prisluškuje na javnoj mreži,TLS 1.2+ i HSTS
Web API,D,skupi upiti za pretragu iscrpe bazu,rate limiting po korisniku i timeout upita
Admin panel,E,obični korisnik pristupa admin funkcijama,provjera uloge na serveru za svaki zahtjev
EOF
-->

## Prioritize

Add a fifth field to the end of every row in `model.csv`: a risk rating of exactly `nizak` (low), `srednji` (medium) or `visok` (high). Don't forget the header: it becomes `element,kategorija,prijetnja,kontrola,rizik` (`rizik` = risk).

Then pull out what goes first:

```bash
grep ',visok$' /root/model/model.csv
```

<!-- verify
f=/root/model/model.csv
head -1 $f | grep -qx 'element,kategorija,prijetnja,kontrola,rizik' || { echo "The header must be: element,kategorija,prijetnja,kontrola,rizik"; exit 1; }
bad=$(tail -n +2 $f | grep -v '^[[:space:]]*$' | awk -F, 'NF!=5 || $5 !~ /^(nizak|srednji|visok)$/ {print NR+1": "$0}')
[ -z "$bad" ] || { echo "Rows without a valid risk (nizak/srednji/visok):"; echo "$bad"; exit 1; }
tail -n +2 $f | grep -q ',visok$' || { echo "No threat rated visok (high)? Account takeover or EoP usually are."; exit 1; }
-->
<!-- solution
cd /root/model && sed -i '1s/$/,rizik/' model.csv && sed -i '2,$s/$/,srednji/' model.csv && sed -i '2s/,srednji$/,visok/' model.csv
-->
