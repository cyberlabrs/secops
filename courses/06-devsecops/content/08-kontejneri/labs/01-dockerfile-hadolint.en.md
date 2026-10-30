# Lab 1: Secure Dockerfile

The kurs-shop `Dockerfile` has almost all the classic mistakes: `FROM python:latest`, `ADD` of the whole repo (including `.git`), a root user, a token in `ENV`, `apt-get` without cleanup and the shell form of `CMD`. You will rewrite it so that it passes the **hadolint** and **Trivy** configuration checks, and then add a job that enforces this.

```bash
cd /root/kurs-shop
cat Dockerfile
hadolint Dockerfile
trivy config Dockerfile
```

<!-- setup
set -e
kurs-repo
-->

## Rewrite the Dockerfile

The new `Dockerfile` must:

1. be **multi-stage**: the first stage (`AS build`) installs the dependencies (`pip install --no-cache-dir --prefix=/install -r requirements.txt`), and the final stage copies only the result and the code,
2. use a fixed version of the base image in all `FROM` lines (e.g. `python:3.13-slim`, never `latest` or no tag),
3. use `COPY`, not `ADD`, and not copy the whole repo (`.git`, `infra/`, `tests/` don't go into the image): copy only `app.py` and `config/`,
4. contain no secrets (`ENV`/`ARG` with a token),
5. run as a **non-root** user in the final stage (`USER 65532` or a named user that is not root),
6. use the exec form: `CMD ["python", "app.py"]` (or `ENTRYPOINT`).

You can leave out `ping` from the `/ping` endpoint (the application does not have to have it) or install it in the final stage following the hadolint rules.

<!-- verify
cd /root/kurs-shop
f=Dockerfile
[ "$(grep -ciE '^FROM ' $f)" -ge 2 ] || { echo "the Dockerfile is not multi-stage (it needs at least two FROM lines)"; exit 1; }
grep -iE '^FROM ' $f | grep -viE '^FROM +[^ ]+:[^ ]+|@sha256:' | grep -q . && { echo "every FROM needs a fixed version (tag or digest)"; exit 1; }
grep -iE '^FROM ' $f | grep -qiE ':latest' && { echo "FROM uses :latest"; exit 1; }
grep -qiE '^ADD ' $f && { echo "the Dockerfile still uses ADD"; exit 1; }
grep -qiE '^COPY +\. ' $f && { echo "don't copy the whole repo (COPY . …): only app.py and config/"; exit 1; }
grep -qE 'glpat-|API_TOKEN' $f && { echo "the token is still in the Dockerfile"; exit 1; }
u=$(awk 'toupper($1)=="FROM"{u=""} toupper($1)=="USER"{u=$2} END{print u}' $f)
[ -n "$u" ] && [ "$u" != "root" ] && [ "${u%%:*}" != "0" ] || { echo "the final stage must have a USER that is not root"; exit 1; }
grep -qE '^(CMD|ENTRYPOINT) +\[' $f || { echo "use the exec form CMD [\"python\", \"app.py\"]"; exit 1; }
grep -qE 'pip install' $f && ! grep -qE 'pip install[^&]*--no-cache-dir' $f && { echo "pip install needs --no-cache-dir"; exit 1; }
hadolint --failure-threshold warning $f >/tmp/hl.txt 2>&1 || { cat /tmp/hl.txt; echo "hadolint still reports warnings or errors"; exit 1; }
trivy config -q --severity HIGH,CRITICAL --exit-code 1 $f >/tmp/tc.txt 2>&1 || { grep -E 'DS-?0' /tmp/tc.txt | head; echo "Trivy finds a HIGH/CRITICAL problem in the Dockerfile"; exit 1; }
-->
<!-- hint
```dockerfile
FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py ./
COPY config/ ./config/
USER 65532:65532
EXPOSE 8080
CMD ["python", "app.py"]
```
If you do install a package with `apt-get`, hadolint requires a pinned version (DL3008); mark a deliberate deviation with a `# hadolint ignore=DL3008` comment above the `RUN` line.
-->
<!-- solution
cd /root/kurs-shop
cat > Dockerfile <<'EOF'
FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py ./
COPY config/ ./config/
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"]
CMD ["python", "app.py"]
EOF
-->

## .dockerignore and the job

1. Create a `.dockerignore` that excludes at least `.git`, `infra/`, `tests/` and `.gitlab-ci.yml` from the build context. The context sends all files to the builder even when `COPY` doesn't use them, so secrets in the `.git` history must not be available to the build.
2. Add a job `dockerfile-lint` (stage `test`) that runs `hadolint --failure-threshold warning Dockerfile` and `trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile`. `gitlab-ci-local dockerfile-lint` must pass.

<!-- verify
cd /root/kurs-shop
[ -f .dockerignore ] || { echo "no .dockerignore"; exit 1; }
for p in .git infra tests .gitlab-ci.yml; do grep -Eq "^/?${p//./\\.}/?(\*\*)?$" .dockerignore || { echo ".dockerignore does not exclude $p"; exit 1; }; done
s=$(yq '.["dockerfile-lint"].script | join(" ")' .gitlab-ci.yml)
echo "$s" | grep -q 'hadolint' && echo "$s" | grep -q 'trivy config' || { echo "dockerfile-lint needs hadolint and trivy config"; exit 1; }
gitlab-ci-local dockerfile-lint > /tmp/gcl.log 2>&1 || { tail -15 /tmp/gcl.log; echo "the dockerfile-lint job fails"; exit 1; }
cp Dockerfile /tmp/Dockerfile.bak && git show HEAD:Dockerfile > Dockerfile
gitlab-ci-local dockerfile-lint > /tmp/gcl2.log 2>&1; rc=$?; cp /tmp/Dockerfile.bak Dockerfile
[ $rc -ne 0 ] || { echo "the job does not fail on the old Dockerfile"; exit 1; }
-->
<!-- hint
```text
.git
infra/
tests/
.gitlab-ci.yml
```
```yaml
dockerfile-lint:
  stage: test
  script:
    - hadolint --failure-threshold warning Dockerfile
    - trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile
```
-->
<!-- solution
cd /root/kurs-shop
printf '.git\ninfra/\ntests/\n.gitlab-ci.yml\n.gitlab-ci-local/\n' > .dockerignore
yq -i '.["dockerfile-lint"] = {"stage": "test", "script": ["hadolint --failure-threshold warning Dockerfile", "trivy config --severity HIGH,CRITICAL --exit-code 1 Dockerfile"]}' .gitlab-ci.yml
-->
