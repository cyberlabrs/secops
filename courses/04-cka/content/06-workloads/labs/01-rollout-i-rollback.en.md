# Lab 1: Rolling update and rollback

Deployment `api` in namespace `shop` runs `nginx:1.27`. You will do a controlled upgrade, a broken rollout and a rollback to an exact revision, as in the "Deployment Rollouts" task.

```bash
kubectl -n shop get deploy,rs,pods
kubectl -n shop rollout history deploy/api
```

<!-- setup
set -e
cluster-up
kubectl create ns shop >/dev/null
kubectl -n shop create deploy api --image=nginx:1.27 --replicas=4 >/dev/null
kubectl -n shop annotate deploy api kubernetes.io/change-cause="pocetna verzija 1.27" >/dev/null
kubectl -n shop rollout status deploy/api --timeout=120s >/dev/null
-->

## Upgrade strategy

Configure the `RollingUpdate` strategy so that during an upgrade:

- there are never any **unavailable** Pods (`maxUnavailable: 0`),
- there is at most **one extra** Pod (`maxSurge: 1`).

```bash
kubectl -n shop edit deploy api
kubectl explain deploy.spec.strategy.rollingUpdate
```

<!-- verify
s=$(kubectl -n shop get deploy api -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}/{.spec.strategy.rollingUpdate.maxSurge}')
[ "$s" = "0/1" ] || { echo "maxUnavailable/maxSurge is $s, it should be 0/1"; exit 1; }
-->
<!-- hint
`kubectl -n shop patch deploy api -p '{"spec":{"strategy":{"rollingUpdate":{"maxUnavailable":0,"maxSurge":1}}}}'`
-->
<!-- solution
kubectl -n shop patch deploy api -p '{"spec":{"strategy":{"rollingUpdate":{"maxUnavailable":0,"maxSurge":1}}}}'
-->

## Upgrade to 1.28

Upgrade the `nginx` container to `nginx:1.28`. The revision must have the `change-cause` "nadogradnja na 1.28" ("upgrade to 1.28"; annotation `kubernetes.io/change-cause`, write the Serbian text exactly as shown because the check looks for it) so it shows up in `rollout history`.

```bash
kubectl -n shop set image deploy/api nginx=nginx:1.28
kubectl -n shop annotate deploy api kubernetes.io/change-cause="nadogradnja na 1.28"
kubectl -n shop rollout status deploy/api
kubectl -n shop rollout history deploy/api
```

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.28" ] || { echo "the image is not nginx:1.28"; exit 1; }
kubectl -n shop rollout history deploy/api | grep -q 'nadogradnja na 1.28' || { echo "rollout history has no change-cause 'nadogradnja na 1.28'"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.updatedReplicas}/{.status.readyReplicas}')" = "4/4" ] || { echo "the rollout has not finished"; exit 1; }
-->
<!-- solution
kubectl -n shop set image deploy/api nginx=nginx:1.28
kubectl -n shop annotate deploy api kubernetes.io/change-cause="nadogradnja na 1.28" --overwrite
kubectl -n shop rollout status deploy/api --timeout=180s
-->

## A broken rollout

A colleague released version `nginx:1.29-kurs`, which does not exist:

```bash
kubectl -n shop set image deploy/api nginx=nginx:1.29-kurs
kubectl -n shop annotate deploy api kubernetes.io/change-cause="los release" --overwrite
kubectl -n shop get pods
```

Run these commands and watch: because of `maxUnavailable: 0` all the old replicas keep running, and only the new Pod hangs in `ErrImagePull`/`ImagePullBackOff`. That is why this strategy is safe.

Write the reason (`reason`) why the new Pod is not running to `/root/los-pod.txt`, as shown in the `STATUS` column or the `state.waiting.reason` field.

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.29-kurs" ] || { echo "run the broken rollout (nginx:1.29-kurs)"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.availableReplicas}')" = "4" ] || { echo "the 4 old replicas are expected to keep running"; exit 1; }
r=$(tr -d ' \n' < /root/los-pod.txt 2>/dev/null)
case "$r" in ErrImagePull|ImagePullBackOff) ;; *) echo "los-pod.txt must contain ErrImagePull or ImagePullBackOff"; exit 1 ;; esac
-->
<!-- solution
kubectl -n shop set image deploy/api nginx=nginx:1.29-kurs
kubectl -n shop annotate deploy api kubernetes.io/change-cause="los release" --overwrite
sleep 8
echo ImagePullBackOff > /root/los-pod.txt
-->

## Rollback to an exact revision

Roll the Deployment back to the revision with the change-cause **"pocetna verzija 1.27"** ("initial version 1.27"). First find the number of that revision in the history. The rollback must be complete, with 4 ready replicas on `nginx:1.27`.

```bash
kubectl -n shop rollout history deploy/api
kubectl -n shop rollout history deploy/api --revision=1
kubectl -n shop rollout undo deploy/api --to-revision=<N>
```

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.27" ] || { echo "the image was not restored to nginx:1.27"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.updatedReplicas}/{.status.readyReplicas}/{.status.replicas}')" = "4/4/4" ] || { echo "the rollback has not finished (all Pods must be the new version and ready)"; exit 1; }
-->
<!-- hint
`rollout undo` without `--to-revision` goes back only one revision (to 1.28). Revision 1 is `pocetna verzija 1.27`; after the rollback it gets a new number in the history.
-->
<!-- solution
kubectl -n shop rollout undo deploy/api --to-revision=1
kubectl -n shop rollout status deploy/api --timeout=180s
-->
