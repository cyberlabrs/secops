## Why hardening

A freshly installed Linux system is built to work for as many people as possible, not to be secure. Hardening means **reducing the attack surface**: turn off what you don't need, lock down what stays, and leave a trail when something changes.

Three questions drive every hardening effort:

1. **Who can get in?** SSH, passwords, keys, accounts.
2. **What can they do once inside?** sudo, permissions, SUID, services.
3. **Will we notice?** logs, auditd, file integrity.

> The industry reference is the **CIS Benchmark** for your distribution (a free PDF after registering at cisecurity.org). It has two levels: **Level 1** is sensible settings that rarely break applications, **Level 2** is stricter, for high-assurance environments.

## SSH

SSH is the server's main front door. Configuration lives in `/etc/ssh/sshd_config`, and on newer distributions also in `/etc/ssh/sshd_config.d/*.conf` (those files are loaded **before** the rest of the main file, and for most options **the first value found wins**).

| Option | Recommendation | Why |
|---|---|---|
| `PermitRootLogin` | `no` | The attacker also has to guess a username; every admin action goes through sudo and leaves a trail of who did it. |
| `PasswordAuthentication` | `no` | Keys only. Password brute-force attacks become useless. |
| `KbdInteractiveAuthentication` | `no` | Closes the other path for passwords (PAM challenge). |
| `PubkeyAuthentication` | `yes` | Key-based login. |
| `MaxAuthTries` | `3` or `4` | Fewer attempts per connection. |
| `X11Forwarding` | `no` | Servers rarely need graphics; less exposed code. |
| `AllowUsers` / `AllowGroups` | only those needed | An allowlist is stronger than a denylist. |
| `LoginGraceTime` | `60` | Holds unfinished connections for less time. |
| `ClientAliveInterval` + `ClientAliveCountMax` | e.g. `300` and `2` | Closes abandoned sessions. |

Two commands you must know:

```bash
sshd -t        # check syntax before restarting (otherwise you can lock yourself out)
sshd -T        # print the EFFECTIVE configuration, after all include files
```

> **Golden rule:** before restarting SSH on a remote server, keep one existing session open and test a new login from a second terminal.

## sudo and least privilege

The principle of *least privilege*: every user and process gets **only** what it needs for its job, and nothing more.

```text
# bad: the deploy user is practically root
deploy ALL=(ALL) NOPASSWD: ALL

# better: exactly one command, with its full path
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart myapp
```

- Edit only with `visudo` or `visudo -f /etc/sudoers.d/name`. A syntax error in a sudoers file can leave you without root access.
- Files in `/etc/sudoers.d/` must have permissions `0440`.
- `sudo -l -U user` shows what a user is allowed to do.
- Watch out for commands that spawn a shell: `vim`, `less`, `find -exec`, `tar`, `awk`… If you allow them through sudo, you've handed out root. The catalog of such binaries is **GTFOBins**, which is also useful to defenders reviewing sudoers rules.

## File permissions

`ls -l` shows `-rwxr-x---`: owner, group, others. In octal: r=4, w=2, x=1.

| File | Typical permissions |
|---|---|
| `/etc/shadow` | `640` root:shadow or `000` |
| `/etc/passwd` | `644` |
| private key, secret config | `600` |
| script run by root (cron) | `700` or `750`, owned by root |
| `/etc/sudoers.d/*` | `440` |

Dangerous situations to look for:

```bash
# files anyone can modify
find / -xdev -type f -perm -0002 2>/dev/null
# directories anyone can modify that lack the sticky bit
find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null
# files without an owner (left behind by deleted users)
find / -xdev \( -nouser -o -nogroup \) 2>/dev/null
```

The worst combination: **a script run by root that anyone can modify**. That is a direct privilege escalation.

### SUID and SGID

The SUID bit (`-rwsr-xr-x`) means the program runs with the rights of the **file's owner**, not the user who runs it. `passwd` must be SUID root because it modifies `/etc/shadow`. But SUID root on `find`, `bash` or `python` gives root to everyone.

```bash
find / -xdev -perm -4000 -type f 2>/dev/null   # SUID
find / -xdev -perm -2000 -type f 2>/dev/null   # SGID
chmod u-s /path/to/file                         # remove SUID
```

Take an inventory of SUID files on a clean system and compare against it regularly. A new SUID binary is a strong sign of compromise.

### umask

`umask` sets the default permissions of new files. `022` yields `644` files; CIS recommends `027` (files `640`, directories `750`) so other users can't read each other's files.

## Services and ports

Every listening service is a potential entry point.

```bash
ss -tulpn                         # who is listening on which port
systemctl list-unit-files --state=enabled
systemctl disable --now name.service
```

Ask for every port: is it needed at all? Does it need to listen on `0.0.0.0`, or is `127.0.0.1` enough?

## Updates

Most real-world compromises use **known** vulnerabilities for which a patch already exists. On Ubuntu, enable `unattended-upgrades` at least for security patches, and on server fleets track patch status centrally.

## auditd and logs

`auditd` is the Linux kernel audit system: it records system calls and file access according to rules.

```bash
# watch every change to /etc/passwd and /etc/shadow, with a search key
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
# watch command execution as root
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmds
```

Rules go in `/etc/audit/rules.d/*.rules`, are loaded with `augenrules --load`, and searched with `ausearch -k identity`. auditd usually doesn't work in containers because the kernel is shared with the host, so we won't run it in the lab. On real servers it is a mandatory part of CIS.

Other sources: `journalctl`, `/var/log/auth.log` (logins, sudo), plus central log shipping (rsyslog, Fluent Bit, a SIEM agent) so an attacker can't delete logs locally.

## Lynis

**Lynis** is a free tool that scans the system and produces a *hardening index* (0 to 100) and a list of recommendations.

```bash
lynis audit system            # full scan
lynis show details SSH-7408   # explanation of a specific test
```

The report is written to `/var/log/lynis-report.dat`. Workflow: scan, fix the most important items, scan again and compare.

## Summary

- First close the entry points (SSH keys, no root login), then limit privileges (sudo, permissions, SUID), then ensure visibility (auditd, logs).
- Validate every change (`sshd -t`, `visudo -c`) before applying it.
- Automate: manual hardening doesn't scale. Ansible roles and CIS profiles are the next step.
