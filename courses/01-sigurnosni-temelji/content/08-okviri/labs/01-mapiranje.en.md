# Lab 1: Mapping technical work to frameworks

The head of security is preparing for the first ISO 27001 audit and asks the DevOps team to map existing practices. This is a real task you'll get as soon as you say you work in security: the technical things you already do need to be translated into the language of frameworks.

The files are in `/root/okviri/` ("okviri" = frameworks). For CIS controls you have a list in `cis-kontrole.txt`. The lab files are in Serbian; translations are given below.

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

## NIST CSF 2.0 functions

In `/root/okviri/nist.txt`, replace the `?` for each activity with its function: `GV`, `ID`, `PR`, `DE`, `RS` or `RC`.

```bash
nano /root/okviri/nist.txt
```

The activities in the file, in English:

1. The board adopts an information security policy and appoints a CISO.
2. An automated inventory of all EC2 instances and Azure VMs with their owners.
3. MFA and Conditional Access enabled for all admin accounts.
4. A GuardDuty finding about unusual API calls sends an alert to the SOC channel.
5. Isolating a compromised instance and notifying the legal department.
6. Restoring the database from a snapshot and analyzing lessons learned.
7. Assessing the security risk of a new SaaS supplier before signing the contract.
8. Encrypting an S3 bucket with a KMS key.

<!-- verify
f=/root/okviri/nist.txt
want="GV ID PR DE RS RC GV PR"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([A-Za-z?]+)[[:space:]]*$/\1/' | tr a-z A-Z)
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Incorrect or empty for items:$bad"; exit 1; }
-->
<!-- hint
Item 7 (supplier risk) was moved under Govern in CSF 2.0: supply chain risk management (GV.SC). Item 6 has two parts, but both are part of recovery.
-->
<!-- solution
cd /root/okviri && sed -i -E '2s/\?$/GV/; 3s/\?$/ID/; 4s/\?$/PR/; 5s/\?$/DE/; 6s/\?$/RS/; 7s/\?$/RC/; 8s/\?$/GV/; 9s/\?$/PR/' nist.txt
-->

## CIS Controls v8.1

In `/root/okviri/cis.txt`, for each thing you did in this course, replace the `?` with the number of the CIS control it **most directly** belongs to.

```bash
cat /root/okviri/cis-kontrole.txt
nano /root/okviri/cis.txt
```

The items in the file, in English:

1. Lynis and CIS Benchmark server hardening (module 1).
2. Banning unapproved SUID files and least-privilege sudo rules (module 1).
3. Leaver process: locking accounts and removing keys (module 3).
4. Prioritizing CVE findings by EPSS and KEV (module 7).
5. Fixing SQL injection and fail-closed logic in code (module 5).
6. Central shipping of auditd and CloudTrail logs (modules 1 and 6).
7. SBOM: a list of installed packages and versions (module 7).
8. A runbook for responding to a compromised server (module 6).

<!-- verify
f=/root/okviri/cis.txt
want="4 6 5 7 16 8 2 17"
i=1; bad=""
for w in $want; do
  got=$(grep -E "^$i\. " $f | sed -E 's/.*:[[:space:]]*([0-9?]+)[[:space:]]*$/\1/')
  [ "$got" = "$w" ] || bad="$bad $i"
  i=$((i+1))
done
[ -z "$bad" ] || { echo "Incorrect or empty for items:$bad"; exit 1; }
-->
<!-- hint
CIS distinguishes **Account Management** (5: the account lifecycle) from **Access Control Management** (6: which rights an account has). An SBOM is an inventory of **software** (2), not hardware (1).
-->
<!-- solution
cd /root/okviri && sed -i -E '2s/\?$/4/; 3s/\?$/6/; 4s/\?$/5/; 5s/\?$/7/; 6s/\?$/16/; 7s/\?$/8/; 8s/\?$/2/; 9s/\?$/17/' cis.txt
-->
