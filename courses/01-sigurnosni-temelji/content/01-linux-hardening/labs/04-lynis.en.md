# Lab 4: Lynis audit before and after

This is what the real workflow looks like: scan, fix the most important items, scan again and document the difference. Lynis produces a *hardening index* from 0 to 100 and a list of recommendations.

One scan takes about a minute.

<!-- setup
set -e
sed -i 's/^UMASK.*/UMASK\t\t022/' /etc/login.defs
sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS\t99999/' /etc/login.defs
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Lynis audit ===
Izvještaj: /var/log/lynis-report.dat
EOF
-->

## First scan

Note: the file names `prije` and `poslije` mean "before" and "after"; keep them as shown, the checks look for them.

```bash
lynis audit system --quick --no-colors > /root/lynis-prije.txt 2>&1
grep hardening_index /var/log/lynis-report.dat
cp /var/log/lynis-report.dat /root/prije.dat
```

Look at the recommendations:

```bash
grep '^suggestion' /root/prije.dat | head -30
```

Each recommendation has a test ID (e.g. `AUTH-9328`). Get details with `lynis show details AUTH-9328`.

<!-- verify
[ -s /root/prije.dat ] || { echo "/root/prije.dat does not exist"; exit 1; }
grep -q '^hardening_index=' /root/prije.dat || { echo "The report has no hardening_index"; exit 1; }
-->
<!-- solution
lynis audit system --quick --no-colors > /root/lynis-prije.txt 2>&1; cp /var/log/lynis-report.dat /root/prije.dat
-->

## Fix account settings

In `/etc/login.defs` fix two settings that Lynis and CIS flag:

- `UMASK 027`: new files won't be readable by other users.
- `PASS_MAX_DAYS 365`: local account passwords don't live forever. NIST no longer recommends frequent forced changes, but an unlimited lifetime is still not good practice.

```bash
nano /etc/login.defs
grep -E '^(UMASK|PASS_MAX_DAYS)' /etc/login.defs
```

<!-- verify
grep -Eq '^UMASK[[:space:]]+027$' /etc/login.defs || { echo "UMASK: $(grep -E '^UMASK' /etc/login.defs)"; exit 1; }
d=$(awk '/^PASS_MAX_DAYS/{print $2}' /etc/login.defs)
[ -n "$d" ] && [ "$d" -le 365 ] || { echo "PASS_MAX_DAYS: $d"; exit 1; }
-->
<!-- hint
The lines already exist in the file. Change the values; don't add new lines.
-->
<!-- solution
sed -i 's/^UMASK.*/UMASK\t\t027/; s/^PASS_MAX_DAYS.*/PASS_MAX_DAYS\t365/' /etc/login.defs
-->

## Second scan and comparison

```bash
lynis audit system --quick --no-colors > /root/lynis-poslije.txt 2>&1
echo "Before: $(grep hardening_index /root/prije.dat)"
echo "After:  $(grep hardening_index /var/log/lynis-report.dat)"
diff <(grep '^suggestion' /root/prije.dat) <(grep '^suggestion' /var/log/lynis-report.dat)
```

Lines with `<` are recommendations that disappeared thanks to your fixes.

> In a container the index is lower than on a real server, because there is no kernel, bootloader, or the services Lynis expects. The trend matters, not the absolute number.

<!-- verify
[ /var/log/lynis-report.dat -nt /root/prije.dat ] || { echo "The second scan hasn't been run yet"; exit 1; }
grep -q '^hardening_index=' /var/log/lynis-report.dat || exit 1
-->
<!-- solution
sleep 1; lynis audit system --quick --no-colors > /root/lynis-poslije.txt 2>&1
-->
