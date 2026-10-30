# Lab 1: STRIDE model za aplikaciju za narudžbe

Dobio si opis sistema i dijagram toka podataka. Prvo ćeš klasifikovati gotove prijetnje, a zatim napisati vlastiti mini model sa kontrolama. Rezultat je CSV fajl koji bi u stvarnom timu postao lista tiketa.

Sve je u `/root/model/`.

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

## Upoznaj sistem

```bash
cat /root/model/sistem.txt
```

Odgovori sebi prije nastavka:

- Gdje su granice povjerenja i koji tokovi ih prelaze?
- Koji element čuva najosjetljivije podatke?
- Šta bi napadač prvo napao spolja?

## Klasifikuj prijetnje

Otvori `/root/model/klasifikacija.txt` i umjesto `?` upiši slovo STRIDE kategorije za svaku od 8 prijetnji.

```bash
nano /root/model/klasifikacija.txt
```

<!-- verify
f=/root/model/klasifikacija.txt
want="S I R D T E S I"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([A-Za-z?])[[:space:]]*$/\1/' | tr a-z A-Z)
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Netačno ili prazno kod prijetnji:$bad"; exit 1; }
-->
<!-- hint
Za svaku prijetnju pitaj se koje svojstvo je narušeno: autentičnost (S), integritet (T), neporecivost (R), povjerljivost (I), dostupnost (D) ili autorizacija (E). Prijetnja 2 izgleda kao problem autorizacije, ali posljedica koju opisuje je **curenje** tuđih podataka. U OWASP-u se zove IDOR.
-->
<!-- solution
cd /root/model
sed -i -E '2s/\?$/S/; 3s/\?$/I/; 4s/\?$/R/; 5s/\?$/D/; 6s/\?$/T/; 7s/\?$/E/; 8s/\?$/S/; 9s/\?$/I/' klasifikacija.txt
-->

## Napravi vlastiti model

U `/root/model/model.csv` dodaj **barem šest redova**, po jedan za svako slovo STRIDE-a. Format: `element,kategorija,prijetnja,kontrola`.

- `element` mora biti jedan od naziva iz `sistem.txt`.
- `kategorija` je jedno slovo: S, T, R, I, D ili E.
- `prijetnja` i `kontrola` su kratke rečenice **bez zareza**.
- Prijetnje moraju biti tvoje, a ne one iz koraka 2.

Primjer reda:

```text
Red,T,bilo koji servis u VPC-u može upisati poruku u red,IAM politika dozvoljava SendMessage samo ulozi Web API-ja
```

```bash
nano /root/model/model.csv
column -s, -t /root/model/model.csv
```

<!-- verify
f=/root/model/model.csv
els="Kupac|Admin|Email servis|Web API|Admin panel|Worker|Baza narudzbi|Red|Audit log|Kupac->Web API|Web API->Baza narudzbi|Web API->Red|Worker->Email servis"
rows=$(tail -n +2 $f | grep -v '^[[:space:]]*$')
[ -n "$rows" ] || { echo "model.csv nema redova"; exit 1; }
bad=$(echo "$rows" | awk -F, -v els="$els" 'BEGIN{n=split(els,a,"|");for(i=1;i<=n;i++)ok[a[i]]=1}
  { if (NF!=4) {print NR": treba tačno 4 polja (bez zareza u tekstu)"; next}
    if (!($1 in ok)) print NR": nepoznat element \""$1"\""
    if ($2 !~ /^[STRIDE]$/) print NR": kategorija mora biti S,T,R,I,D ili E"
    if (length($3)<10 || length($4)<10) print NR": prijetnja i kontrola trebaju biti opisne (10+ znakova)" }')
[ -z "$bad" ] || { echo "$bad"; exit 1; }
for c in S T R I D E; do echo "$rows" | awk -F, -v c=$c '$2==c{f=1} END{exit !f}' || { echo "Nedostaje kategorija $c"; exit 1; }; done
exit 0
-->
<!-- hint
Prođi elemente po tabeli „STRIDE po elementu“ iz lekcije. Na primjer: Kupac (S: preuzimanje naloga), Kupac->Web API (I: saobraćaj bez TLS-a), Worker (R: nema loga o poslanim emailovima), Web API (D: nema rate limita), Admin panel (E: nema provjere uloge), Baza narudzbi (T: aplikacija ima DROP prava).
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

## Prioritizuj

Dodaj na kraj svakog reda u `model.csv` peto polje: procjenu rizika `nizak`, `srednji` ili `visok`. Ne zaboravi zaglavlje: postaje `element,kategorija,prijetnja,kontrola,rizik`.

Zatim izdvoji šta ide prvo:

```bash
grep ',visok$' /root/model/model.csv
```

<!-- verify
f=/root/model/model.csv
head -1 $f | grep -qx 'element,kategorija,prijetnja,kontrola,rizik' || { echo "Zaglavlje treba biti: element,kategorija,prijetnja,kontrola,rizik"; exit 1; }
bad=$(tail -n +2 $f | grep -v '^[[:space:]]*$' | awk -F, 'NF!=5 || $5 !~ /^(nizak|srednji|visok)$/ {print NR+1": "$0}')
[ -z "$bad" ] || { echo "Redovi bez ispravnog rizika:"; echo "$bad"; exit 1; }
tail -n +2 $f | grep -q ',visok$' || { echo "Nijedna prijetnja nije visok rizik? Preuzimanje naloga ili EoP obično jesu."; exit 1; }
-->
<!-- solution
cd /root/model && sed -i '1s/$/,rizik/' model.csv && sed -i '2,$s/$/,srednji/' model.csv && sed -i '2s/,srednji$/,visok/' model.csv
-->
