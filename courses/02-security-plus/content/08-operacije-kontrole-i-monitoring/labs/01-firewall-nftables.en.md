# Lab 1: Firewall rules with nftables

The server `192.168.1.10` runs five services and currently has no firewall at all. You'll write a **rule-based** host firewall on the **default deny** principle: everything is forbidden, and only what is explicitly needed is allowed.

| Port | Service | Who may access it |
|---|---|---|
| 80, 443 | web | everyone |
| 22 | SSH | only the management network `10.0.0.0/24` |
| 3306 | database | only the application servers `192.168.1.0/24` |
| 8080 | old admin panel | nobody (it should be shut down, and blocked until then) |

Clients are simulated with addresses on this same server: `10.0.0.5` (admin), `172.16.0.9` (user network), and `192.168.1.20` (application server). The `testfw` script shows who can reach what.

> In this lab all test traffic goes over the loopback interface, so do **not** add the usual `iif lo accept` rule, because it would let everything through. On a real server that rule goes at the top.

<!-- setup
set -e
for a in 192.168.1.10 10.0.0.5 172.16.0.9 192.168.1.20; do ip addr add $a/32 dev lo 2>/dev/null || true; done
for p in 22 80 443 3306 8080; do nohup ncat -lk 192.168.1.10 $p >/dev/null 2>&1 & done
sleep 0.5
cat > /usr/local/bin/testfw <<'EOF'
#!/bin/bash
# matrica dostupnosti: izvor x port
printf '%-14s' "izvor"; for p in 22 80 443 3306 8080; do printf '%-7s' $p; done; echo
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do
  printf '%-14s' $s
  for p in 22 80 443 3306 8080; do
    if timeout 1 ncat -z -s $s 192.168.1.10 $p 2>/dev/null; then printf '%-7s' OK; else printf '%-7s' BLOK; fi
  done; echo
done
EOF
chmod 755 /usr/local/bin/testfw
nft flush ruleset
cat > /root/ZADATAK.txt <<'EOF'
=== Lab: Firewall sa nftables ===
Testiraj dostupnost: testfw     Pravila: nft list ruleset
EOF
-->

## Starting state

```bash
ss -tlnp
nft list ruleset
testfw
```

Without a firewall, every source reaches every port, including the database and the admin panel (`testfw` prints `OK` for reachable and `BLOK` for blocked, and labels the source column `izvor`). On the exam this is called an overly broad **attack surface**.

## Default deny

Create a table and an `input` chain with a **drop** policy. Right away, allow replies to already established connections (a **stateful** firewall), because without that the server would break its own connections.

```bash
nft add table inet filter
nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }'
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input ip saddr 127.0.0.1 accept
nft list ruleset
testfw
```

Now everything shows BLOK (blocked). That's correct: from this point on, you add every permission deliberately.

<!-- verify
nft list chain inet filter input 2>/dev/null | grep -q 'policy drop' || { echo "The inet filter input chain has no policy drop"; exit 1; }
nft list chain inet filter input | grep -q 'established' || { echo "The established,related rule is missing"; exit 1; }
timeout 1 ncat -z -s 172.16.0.9 192.168.1.10 8080 2>/dev/null && { echo "Port 8080 is still reachable"; exit 1; }
exit 0
-->
<!-- solution
nft add table inet filter
nft add chain inet filter input '{ type filter hook input priority 0; policy drop; }'
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input ip saddr 127.0.0.1 accept
-->

## Web for everyone

Allow TCP ports 80 and 443 from any address. A single rule can cover both ports using the set `{ 80, 443 }`.

```bash
nft add rule inet filter input tcp dport '{ 80, 443 }' accept
testfw
```

<!-- verify
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do for p in 80 443; do
  timeout 1 ncat -z -s $s 192.168.1.10 $p 2>/dev/null || { echo "$s cannot reach port $p"; exit 1; }
done; done
-->
<!-- solution
nft add rule inet filter input tcp dport '{ 80, 443 }' accept
-->

## SSH only from the management network, with a rate limit

Allow port 22 only from `10.0.0.0/24`. Also add **rate limiting** of new SSH connections (e.g., 10 per minute), which slows down brute force attacks.

```bash
nft add rule inet filter input ip saddr 10.0.0.0/24 tcp dport 22 ct state new limit rate 10/minute accept
testfw
```

<!-- verify
timeout 1 ncat -z -s 10.0.0.5 192.168.1.10 22 2>/dev/null || { echo "10.0.0.5 (management) cannot reach SSH"; exit 1; }
for s in 172.16.0.9 192.168.1.20; do timeout 1 ncat -z -s $s 192.168.1.10 22 2>/dev/null && { echo "$s can reach SSH, but it should not"; exit 1; }; done
nft list chain inet filter input | grep 'dport 22' | grep -q 'limit rate' || { echo "The SSH rule has no rate limit"; exit 1; }
exit 0
-->
<!-- solution
nft add rule inet filter input ip saddr 10.0.0.0/24 tcp dport 22 ct state new limit rate 10/minute accept
-->

## Database only for the application servers

Allow port 3306 only from `192.168.1.0/24`. The admin panel on 8080 gets no rule at all, so the `drop` policy blocks it for everyone.

Finally, run `testfw` and compare the result with the table at the start of the lab.

<!-- verify
timeout 1 ncat -z -s 192.168.1.20 192.168.1.10 3306 2>/dev/null || { echo "The application server cannot reach the database"; exit 1; }
for s in 10.0.0.5 172.16.0.9; do timeout 1 ncat -z -s $s 192.168.1.10 3306 2>/dev/null && { echo "$s can reach the database, but it should not"; exit 1; }; done
for s in 10.0.0.5 172.16.0.9 192.168.1.20; do timeout 1 ncat -z -s $s 192.168.1.10 8080 2>/dev/null && { echo "$s can reach port 8080"; exit 1; }; done
exit 0
-->
<!-- hint
`nft add rule inet filter input ip saddr 192.168.1.0/24 tcp dport 3306 accept`
-->
<!-- solution
nft add rule inet filter input ip saddr 192.168.1.0/24 tcp dport 3306 accept
-->

## Save the configuration

Rules added with the `nft` command disappear after a reboot. Save them to `/etc/nftables.conf`, which the `nftables` service loads at startup:

```bash
echo '#!/usr/sbin/nft -f' > /etc/nftables.conf
echo 'flush ruleset' >> /etc/nftables.conf
nft list ruleset >> /etc/nftables.conf
nft -c -f /etc/nftables.conf && echo "Syntax OK"
cat /etc/nftables.conf
```

In practice this file goes into git and is distributed with Ansible, and the change goes through **change management** (objective 1.2): approval, testing, and a backout plan. Here the backout plan is literally `nft flush ruleset`.

<!-- verify
f=/etc/nftables.conf
nft -c -f $f 2>/dev/null || { echo "$f does not exist or has a syntax error"; exit 1; }
grep -q 'policy drop' $f || { echo "$f has no policy drop"; exit 1; }
grep -q '3306' $f && grep -q 'dport 22' $f || { echo "$f does not contain all the rules"; exit 1; }
-->
<!-- solution
printf '#!/usr/sbin/nft -f\nflush ruleset\n' > /etc/nftables.conf && nft list ruleset >> /etc/nftables.conf
-->
