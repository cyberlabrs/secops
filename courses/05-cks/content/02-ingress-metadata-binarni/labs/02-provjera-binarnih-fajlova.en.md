# Lab 2: Verifying platform binaries

Before an installation or upgrade, verify that the downloaded binaries haven't been modified (a supply chain attack, a compromised mirror). With every release Kubernetes publishes SHA-512 hashes, e.g. `https://dl.k8s.io/release/v1.35.0/bin/linux/arm64/kubelet.sha512`.

`/opt/release/v1.35.0/` contains binaries a colleague downloaded from an internal mirror. The official hashes are in `/opt/release/v1.35.0/SHA512SUMS`, copied from dl.k8s.io.

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

## Find the modified file

Check all three files against `SHA512SUMS`. Write to `/root/izmijenjen.txt` the name of the file whose hash does **not** match the official one.

```bash
cd /opt/release/v1.35.0 && sha512sum -c SHA512SUMS
```

<!-- verify
[ "$(tr -d ' \n' < /root/izmijenjen.txt 2>/dev/null | xargs basename 2>/dev/null)" = "kubeadm" ] || { echo "izmijenjen.txt does not contain the name of the modified file"; exit 1; }
-->
<!-- hint
`sha512sum -c` prints `OK` or `FAILED` for each file. Without a hash file: `sha512sum kubeadm` and compare manually with the value from dl.k8s.io (e.g. `grep` on the first ten or so characters).
-->
<!-- solution
cd /opt/release/v1.35.0 && sha512sum -c SHA512SUMS 2>/dev/null | awk -F: '/FAILED/ {print $1}' > /root/izmijenjen.txt
-->

## Remove it and check the version

1. Delete the modified file from `/opt/release/v1.35.0/`.
2. Check that the remaining `kubelet` in that directory really has the cluster's version (v1.35.0). Write the output of `kubelet --version` to `/root/kubelet-verzija.txt`.

<!-- verify
[ ! -e /opt/release/v1.35.0/kubeadm ] || { echo "the modified kubeadm still exists"; exit 1; }
[ -e /opt/release/v1.35.0/kubelet ] && [ -e /opt/release/v1.35.0/kubectl ] || { echo "a valid file was deleted too"; exit 1; }
grep -q 'v1.35.0' /root/kubelet-verzija.txt 2>/dev/null || { echo "kubelet-verzija.txt does not contain v1.35.0"; exit 1; }
-->
<!-- solution
rm -f /opt/release/v1.35.0/kubeadm
/opt/release/v1.35.0/kubelet --version > /root/kubelet-verzija.txt
-->
