# Lab 1: Mapiranje tehničkog rada na okvire

Šef sigurnosti priprema se za prvi ISO 27001 audit i traži od DevOps tima da mapira postojeće prakse. Ovo je stvaran zadatak koji ćeš dobiti čim kažeš da radiš security: tehničke stvari koje već radiš treba prevesti na jezik okvira.

Fajlovi su u `/root/okviri/`. Za CIS kontrole imaš popis u `cis-kontrole.txt`.

<!-- setup
set -e
mkdir -p /root/okviri && cd /root/okviri
cat > cis-kontrole.txt <<'EOF'
1  Inventory and Control of Enterprise Assets
2  Inventory and Control of Software Assets
3  Data Protection
4  Secure Configuration of Enterprise Assets and Software
5  Account Management
6  Access Control Management
7  Continuous Vulnerability Management
8  Audit Log Management
9  Email and Web Browser Protections
10 Malware Defenses
11 Data Recovery
12 Network Infrastructure Management
13 Network Monitoring and Defense
14 Security Awareness and Skills Training
15 Service Provider Management
16 Application Software Security
17 Incident Response Management
18 Penetration Testing
EOF
cat > nist.txt <<'EOF'
# Upiši oznaku NIST CSF 2.0 funkcije umjesto ?  (GV, ID, PR, DE, RS ili RC)
1. Odbor uprave usvaja politiku sigurnosti informacija i imenuje CISO-a: ?
2. Automatski inventar svih EC2 instanci i Azure VM-ova sa vlasnicima: ?
3. Uključen MFA i Conditional Access za sve admin naloge: ?
4. GuardDuty nalaz o neuobičajenim API pozivima šalje alarm u SOC kanal: ?
5. Izolovanje kompromitovane instance i obavještavanje pravne službe: ?
6. Vraćanje baze iz snapshota i analiza naučenih lekcija: ?
7. Procjena sigurnosnog rizika novog SaaS dobavljača prije potpisivanja ugovora: ?
8. Enkripcija S3 bucketa KMS ključem: ?
EOF
cat > cis.txt <<'EOF'
# Upiši BROJ CIS kontrole (1-18) umjesto ?  Pomoć: cat cis-kontrole.txt
1. Lynis i CIS Benchmark hardening servera (modul 1): ?
2. Zabrana neodobrenih SUID fajlova i sudo pravila po principu najmanjih prava (modul 1): ?
3. Leaver proces: zaključavanje naloga i uklanjanje ključeva (modul 3): ?
4. Prioritizacija CVE nalaza po EPSS i KEV (modul 7): ?
5. Popravka SQL injekcije i fail-closed logike u kodu (modul 5): ?
6. Centralno slanje auditd i CloudTrail logova (modul 1 i 6): ?
7. SBOM: popis instaliranih paketa i verzija (modul 7): ?
8. Runbook za odgovor na kompromitovan server (modul 6): ?
EOF
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Mapiranje na okvire ===
Fajlovi: /root/okviri/nist.txt i /root/okviri/cis.txt
EOF
-->

## NIST CSF 2.0 funkcije

U `/root/okviri/nist.txt` za svaku aktivnost upiši funkciju: `GV`, `ID`, `PR`, `DE`, `RS` ili `RC`.

```bash
nano /root/okviri/nist.txt
```

<!-- verify
f=/root/okviri/nist.txt
want="GV ID PR DE RS RC GV PR"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([A-Za-z?]+)[[:space:]]*$/\1/' | tr a-z A-Z)
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Netačno ili prazno kod stavki:$bad"; exit 1; }
-->
<!-- hint
Stavka 7 (rizik dobavljača) je u CSF 2.0 premještena pod Govern: upravljanje rizikom lanca snabdijevanja (GV.SC). Stavka 6 ima dva dijela, ali oba su dio oporavka.
-->
<!-- solution
cd /root/okviri && sed -i -E '2s/\?$/GV/; 3s/\?$/ID/; 4s/\?$/PR/; 5s/\?$/DE/; 6s/\?$/RS/; 7s/\?$/RC/; 8s/\?$/GV/; 9s/\?$/PR/' nist.txt
-->

## CIS Controls v8.1

U `/root/okviri/cis.txt` za svaku stvar koju si radio u ovom kursu upiši broj CIS kontrole kojoj **najdirektnije** pripada.

```bash
cat /root/okviri/cis-kontrole.txt
nano /root/okviri/cis.txt
```

<!-- verify
f=/root/okviri/cis.txt
want="4 6 5 7 16 8 2 17"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([0-9?]+)[[:space:]]*$/\1/')
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Netačno ili prazno kod stavki:$bad"; exit 1; }
-->
<!-- hint
CIS razlikuje **Account Management** (5: životni ciklus naloga) i **Access Control Management** (6: koja prava nalog ima). SBOM je inventar **softvera** (2), a ne hardvera (1).
-->
<!-- solution
cd /root/okviri && sed -i -E '2s/\?$/4/; 3s/\?$/6/; 4s/\?$/5/; 5s/\?$/7/; 6s/\?$/16/; 7s/\?$/8/; 8s/\?$/2/; 9s/\?$/17/' cis.txt
-->
