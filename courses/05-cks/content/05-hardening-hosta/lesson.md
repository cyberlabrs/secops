## Šta ovaj modul pokriva

Modul pokriva tri cilja iz domena 3 (**System Hardening**, 10% ispita):

- **3.1 Minimize host OS footprint**: manje paketa, servisa i otvorenih portova na čvoru znači manje mjesta za napad.
- **3.2 Using least-privilege identity and access management**: korisnici, grupe, sudo i SSH na hostu, IAM rola čvora u cloudu.
- **3.3 Minimize external access to the network**: host firewall, security grupe i samo portovi koje Kubernetes stvarno koristi.

Tipični zadaci na ispitu:

- „Na `node01` nešto sluša na portu 1234. Pronađi proces i ukloni paket koji ga je instalirao.“
- „Zaustavi i onemogući servis `vsftpd` na `controlplane`.“
- „Korisnik `dev` ima sudo bez lozinke. Ukloni to pravo.“
- „Onemogući SSH prijavu za root i prijavu lozinkom na `node01`.“
- „Ograniči pristup portu 10250 samo na mrežu control planea.“

Ovo su klasični Linux zadaci. Brzina dolazi od toga da znaš tačnu komandu za svaki korak: pronađi, provjeri, ukloni, potvrdi.

## Zašto je čvor meta

Kontejner dijeli kernel sa hostom. Kad napadač pobjegne iz kontejnera (ranjivost u runc-u, privilegovan Pod, `hostPath: /`), sve što je na čvoru postaje njegovo: kubelet kredencijali, containerd socket, ključevi, drugi kontejneri. Svaki dodatni servis, paket ili korisnik je dodatni put do toga:

- nepotreban servis koji sluša na mreži je ulazna tačka spolja;
- alati kao `gcc`, `nmap`, `tcpdump`, `curl` olakšavaju napadaču rad poslije upada;
- korisnik sa sudo bez lozinke ili u grupi koja ima pristup container runtime socketu je root;
- čvor sa preširokom IAM rolom daje napadaču cijeli cloud nalog.

Na čvorovima Kubernetesa treba da radi samo: kernel, systemd, containerd, kubelet, SSH (ako se koristi) i agenti koje stvarno trebaš (npr. Falco).

## Minimizacija paketa i servisa (3.1)

### Šta radi na čvoru

```bash
systemctl list-units --type=service --state=running     # servisi koji trenutno rade
systemctl list-unit-files --type=service --state=enabled # servisi koji startuju pri bootu
systemctl status vsftpd                                  # detalji i putanja unit fajla
```

### Zaustavljanje i onemogućavanje servisa

| Komanda | Efekat |
|---|---|
| `systemctl stop X` | Zaustavlja sada; poslije reboota se vraća ako je enabled |
| `systemctl disable X` | Ne startuje pri bootu; trenutni proces radi dalje |
| `systemctl disable --now X` | Oboje: zaustavi i onemogući |
| `systemctl mask X` | Zabranjuje pokretanje, čak i ručno ili kao zavisnost |

```bash
systemctl disable --now vsftpd
systemctl is-active vsftpd ; systemctl is-enabled vsftpd   # inactive / disabled
```

> **Na ispitu:** ako zadatak kaže „ukloni“, nije dovoljno `stop`. Uradi `disable --now`, a ako se traži uklanjanje paketa, i `apt purge`. Uvijek potvrdi rezultat sa `systemctl is-active` i `ss -tlpn`.

### Paketi

```bash
apt list --installed 2>/dev/null | wc -l
dpkg -l | grep -E 'ftp|telnet|nmap|apache2'
apt purge -y vsftpd           # ukloni paket i njegovu konfiguraciju
apt autoremove --purge -y     # ukloni zavisnosti koje više niko ne treba
```

Razlika: `apt remove` ostavlja konfiguracione fajlove u `/etc`, `apt purge` briše i njih. Na ispitu je `purge` obično traženi odgovor.

> **Na ispitu:** nikad ne briši pakete `kubelet`, `kubeadm`, `kubectl`, `containerd`, `openssh-server` (ako ti treba SSH) ni CNI pakete. Prije `apt purge` pročitaj listu paketa koje apt planira da ukloni; ako se tu pojavi nešto od toga, prekini.

### Otvoreni portovi i ko ih drži

```bash
ss -tlpn                       # TCP, listening, procesi, bez razrješavanja imena
ss -ulpn                       # isto za UDP
netstat -tlpn                  # stariji ekvivalent (net-tools)
lsof -i :1234                  # koji proces drži port 1234
lsof -i -P -n | grep LISTEN    # sve konekcije u stanju LISTEN
```

Primjer izlaza:

```text
State   Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN  0      4096   0.0.0.0:1234        0.0.0.0:*         users:(("app-backdoor",pid=2211,fd=3))
```

Od PID-a do paketa:

```bash
ls -l /proc/2211/exe                 # putanja binarnog fajla, npr. /usr/bin/app-backdoor
dpkg -S /usr/bin/app-backdoor        # koji paket je instalirao fajl
systemctl status 2211                # systemd unit koji pokreće proces (ako postoji)
```

Ako binarni fajl ne pripada nijednom paketu (`dpkg -S` ne nađe ništa), zaustavi servis, onemogući ga, obriši unit fajl i binarni fajl i uradi `systemctl daemon-reload`.

| Alat | Kada ga koristiti |
|---|---|
| `ss -tlpn` | Najbrži pregled portova; uvijek instaliran (iproute2) |
| `netstat -tlpn` | Isto, ako je zadatak tako formulisan ili ss nije dostupan |
| `lsof -i :PORT` | Ko drži tačno određeni port; pokazuje i korisnika |
| `/proc/<pid>/exe`, `/proc/<pid>/cmdline` | Prava putanja i argumenti procesa |
| `dpkg -S`, `rpm -qf` | Koji paket je vlasnik fajla |

### Kernel moduli

Kernel moduli koje niko ne koristi su takođe površina napada. Pod može (preko socket poziva) natjerati kernel da automatski učita modul za neki protokol. Kubernetes dokumentacija predlaže da se nepotrebni mrežni protokoli zabrane:

```bash
cat <<'EOF' > /etc/modprobe.d/kubernetes-blacklist.conf
blacklist dccp
blacklist sctp
EOF
lsmod | grep -E 'dccp|sctp'      # da li je modul trenutno učitan
```

### Minimalni OS za čvorove

Najbolja minimizacija je OS koji je od početka napravljen samo za kontejnere:

| OS | Osobine |
|---|---|
| Bottlerocket (AWS) | Read-only root, bez package managera i shella po defaultu, atomic update |
| Flatcar Container Linux | Immutable `/usr`, automatski update sa rollbackom |
| Talos Linux | Nema SSH ni shell; upravlja se samo preko API-ja |
| Container-Optimized OS (GKE) | Minimalan, read-only root, održava Google |

Na klasičnom Ubuntu čvoru (kao u labu) isti cilj postižeš ručno: minimalna instalacija, bez GUI-ja i razvojnih alata, automatske sigurnosne zakrpe (`unattended-upgrades`) i redovna provjera servisa i portova.

## Least privilege za identitete (3.2)

### Korisnici i grupe na hostu

```bash
getent passwd | awk -F: '$7 !~ /(nologin|false)$/ {print $1, $3, $7}'   # ko ima login shell
awk -F: '$3 == 0 {print $1}' /etc/passwd     # svi sa UID 0 (smije biti samo root)
getent group sudo                             # članovi grupe sudo (Ubuntu)
id dev                                        # grupe korisnika dev
lastlog | grep -v Never                       # ko se prijavljivao
```

Opasne grupe: `sudo` (ili `wheel`), `docker` (pristup Docker socketu = root na hostu), `adm` (čitanje logova), svaka grupa sa pravom pisanja na `/run/containerd/containerd.sock`.

| Cilj | Komanda |
|---|---|
| Ukloni korisnika iz grupe | `gpasswd -d dev sudo` ili `deluser dev sudo` |
| Zaključaj nalog (lozinka) | `usermod -L dev` |
| Zabrani interaktivni login | `usermod -s /usr/sbin/nologin dev` |
| Obriši korisnika i home | `userdel -r dev` |
| Nalog ističe | `chage -E 0 dev` |

`usermod -L` zaključava samo lozinku; prijava SSH ključem i dalje može raditi. Ako korisnik treba potpuno da izgubi pristup, uradi i `nologin` (ili obriši `~dev/.ssh/authorized_keys`).

### sudo

```bash
sudo -l -U dev                      # šta dev smije kroz sudo
grep -r . /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v '^\s*#'
```

Tipičan nalaz:

```text
/etc/sudoers.d/dev:dev ALL=(ALL) NOPASSWD: ALL
```

Popravka: obriši ili suzi fajl (npr. `dev ALL=(root) /usr/bin/systemctl restart nginx`). Uvijek uređuj sa `visudo -f /etc/sudoers.d/dev` ili poslije izmjene provjeri sintaksu sa `visudo -c`. Greška u sudoers fajlu može te zaključati van root pristupa.

### SSH hardening

Bitne opcije u `/etc/ssh/sshd_config`:

```text
PermitRootLogin no              # ili prohibit-password: root samo ključem
PasswordAuthentication no       # samo ključevi
PubkeyAuthentication yes
KbdInteractiveAuthentication no
PermitEmptyPasswords no
AllowUsers ops admin            # samo navedeni korisnici
X11Forwarding no
```

Na Ubuntuu `sshd_config` na početku ima `Include /etc/ssh/sshd_config.d/*.conf`, a sshd koristi **prvu** vrijednost koju pročita. Fajl kao `50-cloud-init.conf` sa `PasswordAuthentication yes` zato pobjeđuje tvoju izmjenu niže u glavnom fajlu. Provjeri efektivnu konfiguraciju:

```bash
grep -ri passwordauthentication /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
sshd -t                                           # provjera sintakse; bez izlaza = OK
sshd -T | grep -Ei 'permitrootlogin|passwordauthentication'   # efektivne vrijednosti
systemctl reload ssh                              # na Ubuntuu servis se zove ssh
```

> **Na ispitu:** prije reloada uvijek pokreni `sshd -t`. Ako je sintaksa loša, sshd neće startovati, a ti se možda više nećeš moći vratiti na čvor. Otvorena SSH sesija ostaje živa poslije reloada, pa testiraj novu prijavu iz drugog terminala prije nego što zatvoriš prvu.

### Kubernetes i host identiteti

- kubelet i containerd rade kao root. Ko može pisati u `/run/containerd/containerd.sock`, može pokrenuti privilegovan kontejner, dakle ima root.
- `/etc/kubernetes/*.conf` i `/etc/kubernetes/pki/*.key` treba da budu `root:root` sa dozvolom 600 (kube-bench ih provjerava).
- Nikome ne dijeli SSH pristup čvorovima kao način rada sa klasterom; za Kubernetes zadatke ljudi koriste kubeconfig sa RBAC-om (modul 3 i 4).

### IAM rola čvora u cloudu

Čvor u cloudu ima identitet: IAM rolu (AWS instance profile), service account (GCP) ili managed identity (Azure). Svaki proces na čvoru, pa i svaki Pod koji dođe do metadata servisa `169.254.169.254`, može dobiti privremene kredencijale te role.

Princip najmanjih privilegija:

- rola čvora ima samo ono što kubelet i CNI stvarno trebaju (npr. na EKS-u čitanje iz ECR-a i opis EC2 resursa), nikad `AdministratorAccess` ni `s3:*`;
- aplikacije dobijaju sopstvene role po ServiceAccountu (EKS IRSA / Pod Identity, GKE Workload Identity, Azure Workload Identity), a ne preko role čvora;
- pristup metadata servisu iz Podova se ograničava: na AWS-u IMDSv2 sa hop limitom 1, a u klasteru NetworkPolicy koja blokira egress na `169.254.169.254/32` (modul 2).

## Smanjenje spoljnog pristupa mreži (3.3)

### Portovi koje Kubernetes stvarno treba

| Čvor | Port | Komponenta | Ko pristupa |
|---|---|---|---|
| control plane | 6443/TCP | kube-apiserver | Svi (čvorovi, admini, Podovi) |
| control plane | 2379-2380/TCP | etcd | Samo kube-apiserver i etcd članovi |
| control plane | 10257/TCP | kube-controller-manager | Samo lokalno |
| control plane | 10259/TCP | kube-scheduler | Samo lokalno |
| svi | 10250/TCP | kubelet API | Control plane |
| radni | 10256/TCP | kube-proxy health | Lokalno, load balanceri |
| radni | 30000-32767/TCP,UDP | NodePort Services | Samo ako ih stvarno koristiš |

Sve ostalo što vidiš u `ss -tlpn` treba objasniti. Na kubeadm klasteru scheduler i controller-manager slušaju na `127.0.0.1` (`--bind-address=127.0.0.1`), a etcd klijentski port je na IP-u čvora, pa ga mora štititi firewall. Ako kubelet ima `readOnlyPort` (10255) različit od 0, postavi `readOnlyPort: 0` u `/var/lib/kubelet/config.yaml`.

### Host firewall: ufw

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow from 10.0.0.0/24 to any port 10250 proto tcp
ufw allow from 10.0.0.0/24 to any port 6443 proto tcp
ufw enable
ufw status numbered
ufw delete 3                     # obriši pravilo broj 3
```

### iptables i nftables

```bash
iptables -L INPUT -n -v --line-numbers
iptables -I INPUT 1 -p tcp --dport 10250 -s 10.0.0.10 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 10250 -j DROP
nft list ruleset | less
```

Napomene:

- `-A` dodaje na kraj lanca, `-I` na početak (ili na zadato mjesto). Pravila se porede redom, pa ACCEPT za dozvoljeni izvor mora biti prije DROP-a.
- kube-proxy i CNI pišu sopstvena pravila (lanci `KUBE-*`). **Nikad** ne radi `iptables -F` ni `nft flush ruleset` na čvoru klastera: nestaju Service pravila i mreža Podova.
- Pravila iptables nisu trajna poslije reboota bez `iptables-persistent` ili sličnog alata. ufw čuva svoja pravila sam.

| Alat | Nivo | Kad ga koristiti |
|---|---|---|
| ufw | Jednostavan front-end za iptables/nftables | Brza pravila na Ubuntuu |
| iptables | Klasična pravila po lancima | Precizna pravila, kompatibilnost sa kube-proxy |
| nftables (`nft`) | Novi kernel okvir | Moderni sistemi; `iptables-nft` piše u nftables |
| Security group / cloud firewall | Van čvora | Prva linija odbrane, ne zavisi od stanja čvora |
| NetworkPolicy | Saobraćaj Podova | Ne štiti procese na hostu (kubelet, etcd, sshd) |

> **Na ispitu:** prije `ufw enable` dodaj pravilo za SSH. Bez njega `default deny incoming` prekida tvoju vezu sa `node01` i zadatak postaje nerješiv.

### Security grupe u cloudu

Firewall ispred čvorova (AWS security group, GCP firewall rule, Azure NSG) je prva linija:

- control plane: 6443 samo sa admin mreže/VPN-a i iz security grupe čvorova; 2379-2380 samo između control plane čvorova;
- radni čvorovi: 10250 samo iz security grupe control planea; NodePort opseg samo sa load balancera;
- SSH (22) samo sa bastion hosta, nikad `0.0.0.0/0`.

Na nivou Kubernetesa isti princip: aplikacije izlaži preko Ingressa/Gateway-a umjesto mnogo NodePort servisa, a za Service tipa LoadBalancer koristi `spec.loadBalancerSourceRanges` da ograničiš izvorne adrese.

> **Na ispitu:** pitanje „koji port treba otvoriti“ rješava stranica „Ports and Protocols“ u dokumentaciji (kubernetes.io/docs/reference/networking/ports-and-protocols/). Ne pamti napamet, nego znaj da postoji.

## Primjer zadatka korak po korak

Zadatak: „Na `node01` neki servis sluša na TCP portu 21. Zaustavi ga, ukloni paket i osiguraj da port bude zatvoren. Zatim onemogući SSH prijavu lozinkom.“

```bash
kubectl config use-context <kontekst-iz-zadatka>
ssh node01
ss -tlpn | grep ':21 '                     # users:(("vsftpd",pid=812,...))
ls -l /proc/812/exe                        # /usr/sbin/vsftpd
dpkg -S /usr/sbin/vsftpd                   # vsftpd: /usr/sbin/vsftpd
systemctl disable --now vsftpd
apt purge -y vsftpd
ss -tlpn | grep ':21 ' || echo "port 21 zatvoren"

grep -ri '^passwordauthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
sshd -t && systemctl reload ssh
sshd -T | grep -i '^passwordauthentication'   # passwordauthentication no
exit
```

Svaki korak završava provjerom. Na ispitu se ocjenjuje stanje sistema na kraju, pa je provjera jedini način da znaš da si završio.

## Troubleshooting

| Simptom | Uzrok i provjera |
|---|---|
| Servis se vratio poslije reboota | Samo `stop` bez `disable`; ili ga drugi unit pokreće kao zavisnost (`systemctl mask`) |
| `apt purge` hoće da ukloni i `kubelet` | Zavisnost; prekini i ukloni samo konkretni paket ili konfiguraciju |
| Port i dalje otvoren poslije uklanjanja paketa | Proces još radi (`ss -tlpn`, `kill`), ili ga drži drugi binarni fajl |
| SSH i dalje prima lozinku | Vrijednost u `/etc/ssh/sshd_config.d/*.conf` pobjeđuje; `sshd -T`; zaboravljen reload |
| `node01` je `NotReady` poslije firewalla | Blokiran 10250 sa control planea ili 6443 prema API-ju; `journalctl -u kubelet` |
| Podovi na različitim čvorovima ne komuniciraju | Firewall blokira saobraćaj CNI-ja ili FORWARD lanac; provjeri `iptables -L FORWARD -n` |
| Korisnik i dalje ima root | Član grupe `docker`/`sudo` ili fajl u `/etc/sudoers.d/`; provjeri `id` i `sudo -l -U` |

## Rezime

- Čvor treba da pokreće samo kernel, systemd, containerd, kubelet i neophodne agente; sve ostalo je površina napada.
- Servisi: `systemctl list-units --state=running`, uklanjanje sa `systemctl disable --now` (ili `mask`); paketi sa `apt purge`.
- Od porta do paketa: `ss -tlpn` / `lsof -i :PORT` → PID → `/proc/<pid>/exe` → `dpkg -S`.
- Korisnici: samo root sa UID 0, bez nepotrebnih članstava u `sudo`/`docker`, bez `NOPASSWD: ALL`; `visudo -c` poslije izmjene.
- SSH: `PermitRootLogin no`, `PasswordAuthentication no`, provjera sa `sshd -t` i `sshd -T` (pazi na `sshd_config.d/`), pa `systemctl reload ssh`.
- IAM rola čvora minimalna; aplikacije dobijaju role po ServiceAccountu, a metadata servis je zatvoren za Podove.
- Otvori samo portove sa stranice „Ports and Protocols“; ufw/iptables na hostu plus security grupe ispred čvora. Nikad `iptables -F` na čvoru klastera.
