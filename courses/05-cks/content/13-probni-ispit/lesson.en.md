## What the CKS exam looks like

Like the CKA, the CKS is a **hands-on** exam: a remote Linux desktop, a terminal, a browser with the allowed documentation, and several clusters. A passed CKA is a prerequisite for taking it.

| | |
|---|---|
| Duration | 2 hours |
| Number of tasks | usually 15–20, of varying difficulty |
| Passing score | 67% |
| Version | Kubernetes v1.35 (October 2026) |
| Documentation | kubernetes.io and the documentation of the tools in the curriculum (e.g. Falco, Trivy, AppArmor, etcd); check the exact list in "Important Instructions: CKS" |
| Retake | one free retake |
| Simulator | two killer.sh sessions included with the purchased exam |

Everything that applies to the CKA applies here too: first the context or `ssh` from the task, imperative commands, skipping hard tasks, and checking your results at the end (see the "Mock exam" lesson in the CKA course).

## What is different compared to the CKA

CKS tasks more often require **changes on nodes and in the control plane**, where a mistake can bring down the API server:

- changes to the kube-apiserver manifest (audit, encryption, admission plugins, ImagePolicyWebhook),
- the kubelet configuration (`/var/lib/kubelet/config.yaml`),
- AppArmor profiles, seccomp profiles and Falco rules on a specific node.

> **On the exam:** before editing `kube-apiserver.yaml`, make a copy **outside** `/etc/kubernetes/manifests/` (e.g. `cp … /root/kube-apiserver.yaml.bak`). If the API server does not come up within 1–2 minutes, first look at `crictl ps -a | grep apiserver` and `crictl logs <id>`, not `kubectl`, because it does not work at that point.

## Quick API server check after a change

```bash
watch crictl ps                      # kube-apiserver must reach Running
crictl logs $(crictl ps -a --name kube-apiserver -q | head -1) 2>&1 | tail -20
journalctl -u kubelet --since "5 min ago" | grep -i apiserver
kubectl get --raw='/readyz?verbose' | tail -5
```

Typical mistakes: a flag without a volume (the file does not exist in the container), a wrong `hostPath.type`, YAML indentation, a wrong `apiVersion` in a config file (audit, encryption, admission).

## Tools you must know without thinking

| Tool | Most common command |
|---|---|
| kube-bench | `kube-bench run --targets master --check 1.2.15` |
| Trivy | `trivy image --severity HIGH,CRITICAL <image>` |
| AppArmor | `apparmor_parser -q /etc/apparmor.d/<profile>`, `aa-status` |
| seccomp | profile in `/var/lib/kubelet/seccomp/…`, `seccompProfile.type: Localhost` |
| Falco | `journalctl -u falco`, `/etc/falco/falco_rules.local.yaml`, `systemctl restart falco` |
| etcd | `etcdctl get /registry/secrets/<ns>/<name>` with certificates |
| audit | `jq 'select(.objectRef.resource=="secrets")' audit.log` |
| crictl | `crictl ps`, `crictl inspect <id>`, `crictl logs <id>` |

## The practice exam in this course

The "Practice exam" lab has 16 tasks from all six domains and a 120-minute countdown. Everything is on a single cluster (`controlplane` + `node01`); the percentage next to each task is its weight. Two tasks modify the kube-apiserver: do them carefully, because a broken API server blocks all the other tasks.

## Summary

- CKS: 2 hours, 15–20 hands-on tasks, 67% to pass, CKA required.
- More tasks modify nodes and the control plane; always back up manifests outside the `manifests/` directory.
- When the API server is down, diagnose with `crictl` and `journalctl`, not `kubectl`.
- AppArmor and seccomp profiles and Falco rules apply only on the node where they are configured.
- At the end, check the effect (the Pod is really rejected, the port is really closed, the alert is really in the log), not just that the command succeeded.
