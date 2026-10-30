## What the CKA exam looks like

The CKA is a **hands-on** exam. There are no multiple-choice questions: you get a remote Linux desktop with a terminal and a browser, and you solve tasks on real clusters.

| | |
|---|---|
| Duration | 2 hours |
| Number of tasks | usually 15–20, with different weights (percentage next to each task) |
| Passing score | 66% |
| Version | Kubernetes v1.35 (October 2026) |
| Environment | PSI remote desktop: terminal, Firefox, a simple editor |
| Documentation | kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs and gateway-api.sigs.k8s.io are allowed; other sites are not |
| Retake | one free retake |
| Simulator | the exam purchase includes two killer.sh sessions; they are intentionally harder than the exam |

Rules and technical details change. Before scheduling, read the current "Candidate Handbook" and "Important Instructions: CKA" on the Linux Foundation website.

## Before every task

Every task starts with an instruction telling you where to work: a **context** (`kubectl config use-context …`) or a **host** (`ssh …`). The exam has several clusters, and a task solved on the wrong cluster scores zero points.

> **On the exam:** first copy and run the context or host command from the task, and only then read the rest. After three tasks it becomes a reflex.

Read the **names** carefully: namespace, resource name, answer file path, port. Grading is automated: `web-app` is not the same as `webapp`.

## Terminal setup

On the exam, `kubectl`, the `k` alias and shell completion are usually already configured. If they are not, this takes 30 seconds:

```bash
alias k=kubectl
source <(kubectl completion bash)
complete -o default -F __start_kubectl k
export do="--dry-run=client -o yaml"
export now="--force --grace-period 0"
```

`k run web --image=nginx $do > web.yaml` generates YAML to edit, and `k delete pod web $now` deletes a Pod immediately.

For vim (`~/.vimrc`):

```text
set tabstop=2 shiftwidth=2 expandtab
```

> **On the exam:** copy and paste in the PSI environment work with `Ctrl+Shift+C` / `Ctrl+Shift+V` in the terminal. When you paste YAML into vim, the indentation can get mangled; `:set paste` before pasting prevents that.

## Time management

Two hours for 15–20 tasks is 6–8 minutes per task. Tasks are neither equally hard nor equally valuable.

1. **First pass:** solve everything you know right away. Flag any task that takes longer than ~8 minutes and move on.
2. **Second pass:** return to the flagged tasks, starting with those with the higher percentage.
3. **Last 10 minutes:** check that answer files are in the right place and that Pods are actually running (`k get pods`, not just `k apply`).

> **On the exam:** a partially solved task often earns partial points. An etcd backup without a restore is still worth something, while an empty task is worth nothing.

## Imperative before declarative

Whatever can be a single `kubectl` command, do it that way. Write YAML only for what a command cannot do (probes, affinity, volumes, NetworkPolicy).

```bash
k create deploy web --image=nginx:1.28 --replicas=3
k expose deploy web --port=80 --type=NodePort
k create role pod-reader --verb=get,list --resource=pods -n dev
k create rolebinding rb --role=pod-reader --serviceaccount=dev:app -n dev
k create cronjob c --image=busybox:1.37 --schedule="*/5 * * * *" -- date
k create ingress web --class=traefik --rule="web.local/*=web:80"
k set image deploy/web nginx=nginx:1.29
k scale deploy web --replicas=5
k label node node01 disk=ssd
k taint node node01 key=val:NoSchedule
```

For everything else: `k … $do > file.yaml`, edit it, `k apply -f file.yaml`. For fields you do not remember, use `kubectl explain`, because it is faster than the documentation:

```bash
k explain pod.spec.affinity.nodeAffinity --recursive | less
```

## Common pitfalls

| Pitfall | How to avoid it |
|---|---|
| Wrong context or host | run the `use-context`/`ssh` from the task before anything else |
| Resource in the wrong namespace | `-n` in every command; verify with `k get … -n …` |
| Static Pod manifest copied inside `/etc/kubernetes/manifests/` | keep backups outside that directory |
| etcd backup without certificates | read the paths from `/etc/kubernetes/manifests/etcd.yaml` |
| Change made on the node, but kubelet not restarted | `systemctl daemon-reload && systemctl restart kubelet` |
| `systemctl start` instead of `enable --now` | the task often requires the fix to survive a reboot |
| NetworkPolicy with an extra dash (OR instead of AND) | `namespaceSelector` and `podSelector` in the same element |
| Upgrade skips a minor version | always one minor version per step |
| Answer in the wrong file or format | `cat` the file at the end and compare it with the task |

## The mock exam in this course

The "Mock exam" lab has 17 tasks from all domains and a 120-minute countdown. The real exam has more tasks and several clusters; here everything runs on a single cluster (`controlplane` + `node01`). The percentage next to a task is its weight.

- Run the check only when you think the task is done, as if the exam were grading it.
- If you get stuck, skip the task. The hint is there, but you will not have it on the exam.
- You can restart the lab, but the environment is then rebuilt from scratch.

When you pass the mock exam in under 60 minutes without hints, you are ready for killer.sh. When you score over 70% on killer.sh, you are ready for the exam.

## Summary

- The CKA is hands-on: 2 hours, 15–20 tasks, 66% to pass, official documentation allowed.
- First the context or host from the task, and only then the solution.
- Imperative commands and `$do` save the most time.
- Skip hard tasks and come back to them; a partial solution earns points.
- At the end, verify the result (`get`, `describe`, `cat`), not just that the command succeeded.
- Typical pitfalls: namespace, static Pod backup in the manifests directory, kubelet without `enable`, NetworkPolicy AND/OR.
