# Lab 1: Rolling update i rollback

Deployment `api` u namespaceu `shop` radi na `nginx:1.27`. Uradićeš kontrolisanu nadogradnju, pokvareni rollout i rollback na tačnu reviziju, kao u zadatku „Deployment Rollouts“.

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

## Strategija nadogradnje

Podesi strategiju `RollingUpdate` tako da tokom nadogradnje:

- nikad ne bude **nedostupnih** Podova (`maxUnavailable: 0`),
- bude najviše **jedan dodatni** Pod (`maxSurge: 1`).

```bash
kubectl -n shop edit deploy api
kubectl explain deploy.spec.strategy.rollingUpdate
```

<!-- verify
s=$(kubectl -n shop get deploy api -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}/{.spec.strategy.rollingUpdate.maxSurge}')
[ "$s" = "0/1" ] || { echo "maxUnavailable/maxSurge je $s, treba 0/1"; exit 1; }
-->
<!-- hint
`kubectl -n shop patch deploy api -p '{"spec":{"strategy":{"rollingUpdate":{"maxUnavailable":0,"maxSurge":1}}}}'`
-->
<!-- solution
kubectl -n shop patch deploy api -p '{"spec":{"strategy":{"rollingUpdate":{"maxUnavailable":0,"maxSurge":1}}}}'
-->

## Nadogradnja na 1.28

Nadogradi kontejner `nginx` na `nginx:1.28`. Revizija mora imati `change-cause` „nadogradnja na 1.28“ (anotacija `kubernetes.io/change-cause`), da se vidi u `rollout history`.

```bash
kubectl -n shop set image deploy/api nginx=nginx:1.28
kubectl -n shop annotate deploy api kubernetes.io/change-cause="nadogradnja na 1.28"
kubectl -n shop rollout status deploy/api
kubectl -n shop rollout history deploy/api
```

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.28" ] || { echo "image nije nginx:1.28"; exit 1; }
kubectl -n shop rollout history deploy/api | grep -q 'nadogradnja na 1.28' || { echo "rollout history nema change-cause 'nadogradnja na 1.28'"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.updatedReplicas}/{.status.readyReplicas}')" = "4/4" ] || { echo "rollout nije završen"; exit 1; }
-->
<!-- solution
kubectl -n shop set image deploy/api nginx=nginx:1.28
kubectl -n shop annotate deploy api kubernetes.io/change-cause="nadogradnja na 1.28" --overwrite
kubectl -n shop rollout status deploy/api --timeout=180s
-->

## Pokvaren rollout

Kolega je pustio verziju `nginx:1.29-kurs`, koja ne postoji:

```bash
kubectl -n shop set image deploy/api nginx=nginx:1.29-kurs
kubectl -n shop annotate deploy api kubernetes.io/change-cause="los release" --overwrite
kubectl -n shop get pods
```

Pokreni ove komande i posmatraj: zbog `maxUnavailable: 0` sve stare replike i dalje rade, a samo novi Pod visi u `ErrImagePull`/`ImagePullBackOff`. Zato je ova strategija sigurna.

U `/root/los-pod.txt` upiši razlog (`reason`) zbog kog novi Pod ne radi, onako kako ga prikazuje kolona `STATUS` ili polje `state.waiting.reason`.

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.29-kurs" ] || { echo "pokreni pokvareni rollout (nginx:1.29-kurs)"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.availableReplicas}')" = "4" ] || { echo "očekivano je da 4 stare replike i dalje rade"; exit 1; }
r=$(tr -d ' \n' < /root/los-pod.txt 2>/dev/null)
case "$r" in ErrImagePull|ImagePullBackOff) ;; *) echo "los-pod.txt treba sadržati ErrImagePull ili ImagePullBackOff"; exit 1 ;; esac
-->
<!-- solution
kubectl -n shop set image deploy/api nginx=nginx:1.29-kurs
kubectl -n shop annotate deploy api kubernetes.io/change-cause="los release" --overwrite
sleep 8
echo ImagePullBackOff > /root/los-pod.txt
-->

## Rollback na tačnu reviziju

Vrati Deployment na reviziju sa change-cause **„pocetna verzija 1.27“**. Prvo pronađi broj te revizije u istoriji. Rollback mora biti završen, sa 4 spremne replike na `nginx:1.27`.

```bash
kubectl -n shop rollout history deploy/api
kubectl -n shop rollout history deploy/api --revision=1
kubectl -n shop rollout undo deploy/api --to-revision=<N>
```

<!-- verify
[ "$(kubectl -n shop get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')" = "nginx:1.27" ] || { echo "image nije vraćen na nginx:1.27"; exit 1; }
[ "$(kubectl -n shop get deploy api -o jsonpath='{.status.updatedReplicas}/{.status.readyReplicas}/{.status.replicas}')" = "4/4/4" ] || { echo "rollback nije završen (svi Podovi moraju biti nova verzija i spremni)"; exit 1; }
-->
<!-- hint
`rollout undo` bez `--to-revision` vraća samo jednu reviziju unazad (na 1.28). Revizija 1 je `pocetna verzija 1.27`; poslije rollbacka ona dobija novi broj u istoriji.
-->
<!-- solution
kubectl -n shop rollout undo deploy/api --to-revision=1
kubectl -n shop rollout status deploy/api --timeout=180s
-->
