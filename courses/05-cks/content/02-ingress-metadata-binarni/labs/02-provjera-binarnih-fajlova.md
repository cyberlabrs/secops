# Lab 2: Provjera binarnih fajlova platforme

Prije instalacije ili nadogradnje provjeri da preuzeti binarni fajlovi nisu izmijenjeni (supply chain napad, kompromitovan mirror). Kubernetes uz svako izdanje objavljuje SHA-512 heševe, npr. `https://dl.k8s.io/release/v1.35.0/bin/linux/arm64/kubelet.sha512`.

U `/opt/release/v1.35.0/` su binarni fajlovi koje je kolega preuzeo sa internog mirrora. Zvanični heševi su u `/opt/release/v1.35.0/SHA512SUMS`, kopirani sa dl.k8s.io.

```bash
ls -la /opt/release/v1.35.0/
cat /opt/release/v1.35.0/SHA512SUMS
```

<!-- setup
set -e
cluster-up
d=/opt/release/v1.35.0; mkdir -p $d
cp /usr/bin/kubelet /usr/bin/kubeadm /usr/bin/kubectl $d/
cd $d && sha512sum kubelet kubeadm kubectl > SHA512SUMS
printf '\n#!backdoor\n' >> kubeadm
touch -r kubelet kubeadm
-->

## Pronađi izmijenjen fajl

Provjeri sva tri fajla protiv `SHA512SUMS`. U `/root/izmijenjen.txt` upiši ime fajla čiji heš **ne** odgovara zvaničnom.

```bash
cd /opt/release/v1.35.0 && sha512sum -c SHA512SUMS
```

<!-- verify
[ "$(tr -d ' \n' < /root/izmijenjen.txt 2>/dev/null | xargs basename 2>/dev/null)" = "kubeadm" ] || { echo "izmijenjen.txt ne sadrži ime izmijenjenog fajla"; exit 1; }
-->
<!-- hint
`sha512sum -c` za svaki fajl ispiše `OK` ili `FAILED`. Bez fajla sa heševima: `sha512sum kubeadm` i uporedi ručno sa vrijednošću sa dl.k8s.io (npr. `grep` po prvih desetak znakova).
-->
<!-- solution
cd /opt/release/v1.35.0 && sha512sum -c SHA512SUMS 2>/dev/null | awk -F: '/FAILED/ {print $1}' > /root/izmijenjen.txt
-->

## Ukloni ga i provjeri verziju

1. Obriši izmijenjeni fajl iz `/opt/release/v1.35.0/`.
2. Provjeri da preostali `kubelet` iz tog direktorija zaista ima verziju klastera (v1.35.0). Izlaz `kubelet --version` upiši u `/root/kubelet-verzija.txt`.

<!-- verify
[ ! -e /opt/release/v1.35.0/kubeadm ] || { echo "izmijenjeni kubeadm još postoji"; exit 1; }
[ -e /opt/release/v1.35.0/kubelet ] && [ -e /opt/release/v1.35.0/kubectl ] || { echo "obrisan je i ispravan fajl"; exit 1; }
grep -q 'v1.35.0' /root/kubelet-verzija.txt 2>/dev/null || { echo "kubelet-verzija.txt ne sadrži v1.35.0"; exit 1; }
-->
<!-- solution
rm -f /opt/release/v1.35.0/kubeadm
/opt/release/v1.35.0/kubelet --version > /root/kubelet-verzija.txt
-->
