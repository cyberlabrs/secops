## What this module covers

The module covers three objectives from domain 3 (**System Hardening**, 10% of the exam):

- **3.1 Minimize host OS footprint**: fewer packages, services and open ports on the node means fewer places to attack.
- **3.2 Using least-privilege identity and access management**: users, groups, sudo and SSH on the host, the node's IAM role in the cloud.
- **3.3 Minimize external access to the network**: host firewall, security groups and only the ports Kubernetes actually uses.

Typical exam tasks:

- "Something on `node01` is listening on port 1234. Find the process and remove the package that installed it."
- "Stop and disable the `vsftpd` service on `controlplane`."
- "The user `dev` has passwordless sudo. Remove that right."
- "Disable SSH login for root and password login on `node01`."
- "Restrict access to port 10250 to the control plane network only."

These are classic Linux tasks. Speed comes from knowing the exact command for each step: find, check, remove, confirm.

## Why the node is a target

A container shares the kernel with the host. When an attacker escapes a container (a runc vulnerability, a privileged Pod, `hostPath: /`), everything on the node becomes theirs: kubelet credentials, the containerd socket, keys, other containers. Every additional service, package or user is another path to that:

- an unneeded service listening on the network is an entry point from outside;
- tools like `gcc`, `nmap`, `tcpdump`, `curl` make the attacker's work easier after the breach;
- a user with passwordless sudo, or in a group with access to the container runtime socket, is root;
- a node with an overly broad IAM role gives the attacker the whole cloud account.

Kubernetes nodes should run only: the kernel, systemd, containerd, the kubelet, SSH (if used) and agents you actually need (e.g. Falco).

## Minimizing packages and services (3.1)

### What runs on the node

```bash
systemctl list-units --type=service --state=running     # services currently running
systemctl list-unit-files --type=service --state=enabled # services that start at boot
systemctl status vsftpd                                  # details and the unit file path
```

### Stopping and disabling services

| Command | Effect |
|---|---|
| `systemctl stop X` | Stops it now; it comes back after a reboot if enabled |
| `systemctl disable X` | Doesn't start at boot; the current process keeps running |
| `systemctl disable --now X` | Both: stop and disable |
| `systemctl mask X` | Forbids starting, even manually or as a dependency |

```bash
systemctl disable --now vsftpd
systemctl is-active vsftpd ; systemctl is-enabled vsftpd   # inactive / disabled
```

> **On the exam:** if the task says "remove", `stop` isn't enough. Run `disable --now`, and if removing the package is required, also `apt purge`. Always confirm the result with `systemctl is-active` and `ss -tlpn`.

### Packages

```bash
apt list --installed 2>/dev/null | wc -l
dpkg -l | grep -E 'ftp|telnet|nmap|apache2'
apt purge -y vsftpd           # remove the package and its configuration
apt autoremove --purge -y     # remove dependencies nobody needs anymore
```

The difference: `apt remove` leaves configuration files in `/etc`, `apt purge` deletes them too. On the exam `purge` is usually the expected answer.

> **On the exam:** never delete the packages `kubelet`, `kubeadm`, `kubectl`, `containerd`, `openssh-server` (if you need SSH) or CNI packages. Before `apt purge`, read the list of packages apt plans to remove; if any of those appear there, abort.

### Open ports and who holds them

```bash
ss -tlpn                       # TCP, listening, processes, no name resolution
ss -ulpn                       # the same for UDP
netstat -tlpn                  # older equivalent (net-tools)
lsof -i :1234                  # which process holds port 1234
lsof -i -P -n | grep LISTEN    # all connections in the LISTEN state
```

Example output:

```text
State   Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN  0      4096   0.0.0.0:1234        0.0.0.0:*         users:(("app-backdoor",pid=2211,fd=3))
```

From PID to package:

```bash
ls -l /proc/2211/exe                 # path of the binary, e.g. /usr/bin/app-backdoor
dpkg -S /usr/bin/app-backdoor        # which package installed the file
systemctl status 2211                # the systemd unit that runs the process (if any)
```

If the binary doesn't belong to any package (`dpkg -S` finds nothing), stop the service, disable it, delete the unit file and the binary, and run `systemctl daemon-reload`.

| Tool | When to use it |
|---|---|
| `ss -tlpn` | Fastest port overview; always installed (iproute2) |
| `netstat -tlpn` | The same, if the task is phrased that way or ss isn't available |
| `lsof -i :PORT` | Who holds a specific port; also shows the user |
| `/proc/<pid>/exe`, `/proc/<pid>/cmdline` | The real path and arguments of the process |
| `dpkg -S`, `rpm -qf` | Which package owns the file |

### Kernel modules

Kernel modules nobody uses are also attack surface. A Pod can (via a socket call) make the kernel automatically load a module for some protocol. The Kubernetes documentation suggests blocking unneeded network protocols:

```bash
cat <<'EOF' > /etc/modprobe.d/kubernetes-blacklist.conf
blacklist dccp
blacklist sctp
EOF
lsmod | grep -E 'dccp|sctp'      # is the module currently loaded
```

### A minimal OS for nodes

The best minimization is an OS built only for containers from the start:

| OS | Characteristics |
|---|---|
| Bottlerocket (AWS) | Read-only root, no package manager and no shell by default, atomic updates |
| Flatcar Container Linux | Immutable `/usr`, automatic updates with rollback |
| Talos Linux | No SSH or shell; managed only through an API |
| Container-Optimized OS (GKE) | Minimal, read-only root, maintained by Google |

On a classic Ubuntu node (as in the lab) you reach the same goal manually: a minimal installation, no GUI or development tools, automatic security patches (`unattended-upgrades`) and regular review of services and ports.

## Least privilege for identities (3.2)

### Users and groups on the host

```bash
getent passwd | awk -F: '$7 !~ /(nologin|false)$/ {print $1, $3, $7}'   # who has a login shell
awk -F: '$3 == 0 {print $1}' /etc/passwd     # everyone with UID 0 (should be only root)
getent group sudo                             # members of the sudo group (Ubuntu)
id dev                                        # groups of the user dev
lastlog | grep -v Never                       # who has logged in
```

Dangerous groups: `sudo` (or `wheel`), `docker` (access to the Docker socket = root on the host), `adm` (reading logs), any group with write access to `/run/containerd/containerd.sock`.

| Goal | Command |
|---|---|
| Remove a user from a group | `gpasswd -d dev sudo` or `deluser dev sudo` |
| Lock the account (password) | `usermod -L dev` |
| Forbid interactive login | `usermod -s /usr/sbin/nologin dev` |
| Delete the user and home | `userdel -r dev` |
| Expire the account | `chage -E 0 dev` |

`usermod -L` locks only the password; login with an SSH key can still work. If the user should lose access completely, also set `nologin` (or delete `~dev/.ssh/authorized_keys`).

### sudo

```bash
sudo -l -U dev                      # what dev may do through sudo
grep -r . /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v '^\s*#'
```

A typical finding:

```text
/etc/sudoers.d/dev:dev ALL=(ALL) NOPASSWD: ALL
```

The fix: delete or narrow the file (e.g. `dev ALL=(root) /usr/bin/systemctl restart nginx`). Always edit with `visudo -f /etc/sudoers.d/dev`, or check the syntax after editing with `visudo -c`. An error in a sudoers file can lock you out of root access.

### SSH hardening

Important options in `/etc/ssh/sshd_config`:

```text
PermitRootLogin no              # or prohibit-password: root only with a key
PasswordAuthentication no       # keys only
PubkeyAuthentication yes
KbdInteractiveAuthentication no
PermitEmptyPasswords no
AllowUsers ops admin            # only the listed users
X11Forwarding no
```

On Ubuntu, `sshd_config` starts with `Include /etc/ssh/sshd_config.d/*.conf`, and sshd uses the **first** value it reads. A file like `50-cloud-init.conf` with `PasswordAuthentication yes` therefore beats your change further down in the main file. Check the effective configuration:

```bash
grep -ri passwordauthentication /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
sshd -t                                           # syntax check; no output = OK
sshd -T | grep -Ei 'permitrootlogin|passwordauthentication'   # effective values
systemctl reload ssh                              # on Ubuntu the service is called ssh
```

> **On the exam:** always run `sshd -t` before reloading. If the syntax is bad, sshd won't start, and you may not be able to get back onto the node. An open SSH session stays alive after a reload, so test a new login from a second terminal before you close the first.

### Kubernetes and host identities

- The kubelet and containerd run as root. Whoever can write to `/run/containerd/containerd.sock` can start a privileged container, so they have root.
- `/etc/kubernetes/*.conf` and `/etc/kubernetes/pki/*.key` should be `root:root` with permission 600 (kube-bench checks them).
- Don't hand out SSH access to nodes as a way of working with the cluster; for Kubernetes tasks people use a kubeconfig with RBAC (modules 3 and 4).

### The node's IAM role in the cloud

A node in the cloud has an identity: an IAM role (AWS instance profile), a service account (GCP) or a managed identity (Azure). Every process on the node, including every Pod that reaches the metadata service `169.254.169.254`, can get temporary credentials for that role.

The least privilege principle:

- the node role has only what the kubelet and CNI really need (e.g. on EKS, reading from ECR and describing EC2 resources), never `AdministratorAccess` or `s3:*`;
- applications get their own roles per ServiceAccount (EKS IRSA / Pod Identity, GKE Workload Identity, Azure Workload Identity), not through the node role;
- access to the metadata service from Pods is restricted: on AWS IMDSv2 with hop limit 1, and in the cluster a NetworkPolicy that blocks egress to `169.254.169.254/32` (module 2).

## Minimizing external network access (3.3)

### Ports Kubernetes really needs

| Node | Port | Component | Who accesses it |
|---|---|---|---|
| control plane | 6443/TCP | kube-apiserver | Everyone (nodes, admins, Pods) |
| control plane | 2379-2380/TCP | etcd | Only kube-apiserver and etcd members |
| control plane | 10257/TCP | kube-controller-manager | Local only |
| control plane | 10259/TCP | kube-scheduler | Local only |
| all | 10250/TCP | kubelet API | Control plane |
| worker | 10256/TCP | kube-proxy health | Local, load balancers |
| worker | 30000-32767/TCP,UDP | NodePort Services | Only if you actually use them |

Everything else you see in `ss -tlpn` needs an explanation. On a kubeadm cluster the scheduler and controller-manager listen on `127.0.0.1` (`--bind-address=127.0.0.1`), while the etcd client port is on the node IP, so a firewall must protect it. If the kubelet has a `readOnlyPort` (10255) other than 0, set `readOnlyPort: 0` in `/var/lib/kubelet/config.yaml`.

### Host firewall: ufw

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow from 10.0.0.0/24 to any port 10250 proto tcp
ufw allow from 10.0.0.0/24 to any port 6443 proto tcp
ufw enable
ufw status numbered
ufw delete 3                     # delete rule number 3
```

### iptables and nftables

```bash
iptables -L INPUT -n -v --line-numbers
iptables -I INPUT 1 -p tcp --dport 10250 -s 10.0.0.10 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 10250 -j DROP
nft list ruleset | less
```

Notes:

- `-A` appends to the end of the chain, `-I` inserts at the beginning (or at a given position). Rules are evaluated in order, so the ACCEPT for the allowed source must come before the DROP.
- kube-proxy and the CNI write their own rules (`KUBE-*` chains). **Never** run `iptables -F` or `nft flush ruleset` on a cluster node: Service rules and Pod networking disappear.
- iptables rules don't persist across a reboot without `iptables-persistent` or a similar tool. ufw saves its rules itself.

| Tool | Level | When to use it |
|---|---|---|
| ufw | Simple front end for iptables/nftables | Quick rules on Ubuntu |
| iptables | Classic per-chain rules | Precise rules, compatibility with kube-proxy |
| nftables (`nft`) | The new kernel framework | Modern systems; `iptables-nft` writes into nftables |
| Security group / cloud firewall | Outside the node | First line of defense, independent of the node's state |
| NetworkPolicy | Pod traffic | Doesn't protect host processes (kubelet, etcd, sshd) |

> **On the exam:** add a rule for SSH before `ufw enable`. Without it, `default deny incoming` cuts your connection to `node01` and the task becomes unsolvable.

### Cloud security groups

The firewall in front of the nodes (AWS security group, GCP firewall rule, Azure NSG) is the first line:

- control plane: 6443 only from the admin network/VPN and from the nodes' security group; 2379-2380 only between control plane nodes;
- worker nodes: 10250 only from the control plane's security group; the NodePort range only from load balancers;
- SSH (22) only from a bastion host, never `0.0.0.0/0`.

The same principle at the Kubernetes level: expose applications through Ingress/Gateway instead of many NodePort services, and for a Service of type LoadBalancer use `spec.loadBalancerSourceRanges` to restrict source addresses.

> **On the exam:** the question "which port needs to be open" is answered by the "Ports and Protocols" page in the documentation (kubernetes.io/docs/reference/networking/ports-and-protocols/). Don't memorize it, just know it exists.

## A worked example, step by step

Task: "On `node01` some service listens on TCP port 21. Stop it, remove the package and make sure the port is closed. Then disable SSH password login."

```bash
kubectl config use-context <context-from-the-task>
ssh node01
ss -tlpn | grep ':21 '                     # users:(("vsftpd",pid=812,...))
ls -l /proc/812/exe                        # /usr/sbin/vsftpd
dpkg -S /usr/sbin/vsftpd                   # vsftpd: /usr/sbin/vsftpd
systemctl disable --now vsftpd
apt purge -y vsftpd
ss -tlpn | grep ':21 ' || echo "port 21 closed"

grep -ri '^passwordauthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
sshd -t && systemctl reload ssh
sshd -T | grep -i '^passwordauthentication'   # passwordauthentication no
exit
```

Every step ends with a check. The exam grades the state of the system at the end, so checking is the only way to know you're done.

## Troubleshooting

| Symptom | Cause and check |
|---|---|
| A service came back after a reboot | Only `stop` without `disable`; or another unit starts it as a dependency (`systemctl mask`) |
| `apt purge` wants to remove `kubelet` too | A dependency; abort and remove only the specific package or configuration |
| The port is still open after removing the package | The process is still running (`ss -tlpn`, `kill`), or another binary holds it |
| SSH still accepts a password | The value in `/etc/ssh/sshd_config.d/*.conf` wins; `sshd -T`; forgotten reload |
| `node01` is `NotReady` after the firewall change | 10250 blocked from the control plane, or 6443 to the API; `journalctl -u kubelet` |
| Pods on different nodes can't communicate | The firewall blocks CNI traffic or the FORWARD chain; check `iptables -L FORWARD -n` |
| A user still has root | Member of the `docker`/`sudo` group or a file in `/etc/sudoers.d/`; check `id` and `sudo -l -U` |

## Summary

- A node should run only the kernel, systemd, containerd, the kubelet and essential agents; everything else is attack surface.
- Services: `systemctl list-units --state=running`, removal with `systemctl disable --now` (or `mask`); packages with `apt purge`.
- From port to package: `ss -tlpn` / `lsof -i :PORT` → PID → `/proc/<pid>/exe` → `dpkg -S`.
- Users: only root with UID 0, no unnecessary memberships in `sudo`/`docker`, no `NOPASSWD: ALL`; `visudo -c` after editing.
- SSH: `PermitRootLogin no`, `PasswordAuthentication no`, check with `sshd -t` and `sshd -T` (watch out for `sshd_config.d/`), then `systemctl reload ssh`.
- A minimal node IAM role; applications get roles per ServiceAccount, and the metadata service is closed to Pods.
- Open only the ports from the "Ports and Protocols" page; ufw/iptables on the host plus security groups in front of the node. Never `iptables -F` on a cluster node.
