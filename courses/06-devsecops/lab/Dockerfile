# Lab okruženje za DevSecOps pipeline: jedan kontejner bez mreže (--network none).
# Sve što alati inače preuzimaju sa interneta (baze ranjivosti, slike, pravila) je u slici,
# a slike za skeniranje i potpisivanje su u lokalnom registriju na 127.0.0.1:5000 (registry-up).

FROM debian:trixie-slim AS tools
ARG TARGETARCH
ARG GITLEAKS_VERSION=8.30.1
ARG TRUFFLEHOG_VERSION=3.97.9
ARG OSV_SCANNER_VERSION=2.6.0
ARG TRIVY_VERSION=0.75.0
ARG HADOLINT_VERSION=2.15.1
ARG SYFT_VERSION=1.52.0
ARG COSIGN_VERSION=3.1.3
ARG CRANE_VERSION=0.22.0
ARG CONFTEST_VERSION=0.70.1
ARG OPA_VERSION=1.21.0
ARG KYVERNO_VERSION=1.19.1
ARG VAULT_VERSION=2.1.1
ARG YQ_VERSION=4.53.6
ARG ZAP_VERSION=2.17.0
ARG NODE_VERSION=22.23.3
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip xz-utils zstd python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /out
RUN set -e; A=$TARGETARCH; X=$( [ "$A" = arm64 ] && echo arm64 || echo x86_64 ); X64=$( [ "$A" = arm64 ] && echo arm64 || echo x64 ); \
    T=$( [ "$A" = arm64 ] && echo ARM64 || echo 64bit ); mkdir -p bin; \
    curl -fsSL https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${X64}.tar.gz | tar xz -C bin gitleaks; \
    curl -fsSL https://github.com/trufflesecurity/trufflehog/releases/download/v${TRUFFLEHOG_VERSION}/trufflehog_${TRUFFLEHOG_VERSION}_linux_${A}.tar.gz | tar xz -C bin trufflehog; \
    curl -fsSL -o bin/osv-scanner https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_${A}; \
    curl -fsSL https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${T}.tar.gz | tar xz -C bin trivy; \
    curl -fsSL -o bin/hadolint https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-linux-${X}; \
    curl -fsSL https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_${A}.tar.gz | tar xz -C bin syft; \
    curl -fsSL -o bin/cosign https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-${A}; \
    curl -fsSL https://github.com/google/go-containerregistry/releases/download/v${CRANE_VERSION}/go-containerregistry_Linux_${X}.tar.gz | tar xz -C bin crane; \
    curl -fsSL https://github.com/open-policy-agent/conftest/releases/download/v${CONFTEST_VERSION}/conftest_${CONFTEST_VERSION}_Linux_${X}.tar.gz | tar xz -C bin conftest; \
    curl -fsSL -o bin/opa https://github.com/open-policy-agent/opa/releases/download/v${OPA_VERSION}/opa_linux_${A}_static; \
    curl -fsSL https://github.com/kyverno/kyverno/releases/download/v${KYVERNO_VERSION}/kyverno-cli_v${KYVERNO_VERSION}_linux_${X}.tar.gz | tar xz -C bin kyverno; \
    curl -fsSL -o /tmp/vault.zip https://releases.hashicorp.com/vault/${VAULT_VERSION}/vault_${VAULT_VERSION}_linux_${A}.zip && unzip -q /tmp/vault.zip vault -d bin; \
    curl -fsSL -o bin/yq https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_${A}; \
    chmod +x bin/*; mv bin/trivy bin/trivy.bin; ls -la bin; \
    curl -fsSL https://github.com/zaproxy/zaproxy/releases/download/v${ZAP_VERSION}/ZAP_${ZAP_VERSION}_Linux.tar.gz | tar xz -C /out && mv /out/ZAP_${ZAP_VERSION} /out/zap; \
    mkdir -p /out/node && curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${X64}.tar.xz | tar xJ -C /out/node --strip-components=1
# Trivy: baza ranjivosti (kompresovana; wrapper je raspakuje pri prvom pokretanju)
RUN /out/bin/trivy.bin image --download-db-only --cache-dir /tmp/trivy-cache --no-progress \
 && tar -C /tmp/trivy-cache -c . | zstd -19 -T0 -q -o /out/trivy-db.tar.zst && ls -la /out/trivy-db.tar.zst
# osv-scanner: offline baze za PyPI, npm i Go (npm bez MAL- zapisa o zlonamjernim paketima, da slika bude manja)
RUN set -e; for e in PyPI npm Go; do mkdir -p /out/osv/osv-scalibr/$e; \
      curl -fsSL -o /out/osv/osv-scalibr/$e/all.zip https://osv-vulnerabilities.storage.googleapis.com/$e/all.zip; done; \
    python3 -c "import zipfile,os;p='/out/osv/osv-scalibr/npm/all.zip';z=zipfile.ZipFile(p);o=zipfile.ZipFile(p+'.new','w',zipfile.ZIP_DEFLATED);[o.writestr(i,z.read(i.filename)) for i in z.infolist() if not os.path.basename(i.filename).startswith('MAL-')];o.close();os.replace(p+'.new',p)"; \
    du -sh /out/osv/osv-scalibr/*

FROM registry:2.8.3 AS registry
FROM alpine:3.20 AS mirror
RUN apk add --no-cache skopeo
COPY --from=registry /bin/registry /bin/registry
COPY images.txt /images.txt
RUN printf 'version: 0.1\nstorage:\n  filesystem:\n    rootdirectory: /mirror\nhttp:\n  addr: 127.0.0.1:5000\n' > /registry.yml \
 && (registry serve /registry.yml >/tmp/reg.log 2>&1 &) && sleep 2 \
 && grep -v '^#' /images.txt | grep . | while read -r img; do \
      full=$(echo "$img" | awk -F/ '{ if (NF==1) print "docker.io/library/"$0; else if ($1 !~ /[.:]/) print "docker.io/"$0; else print $0 }'); \
      repo=$(echo "$img" | sed 's|^gcr.io/||'); echo "== $full -> $repo"; \
      skopeo copy --retry-times 3 --dest-tls-verify=false "docker://$full" "docker://127.0.0.1:5000/$repo" >/dev/null || exit 1; \
    done

FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion ca-certificates curl file git jq less make nano procps psmisc sqlite3 tree unzip vim-tiny xxd zstd \
      python3 python3-venv openjdk-21-jre-headless rsync \
    && rm -rf /var/lib/apt/lists/* && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim
# Python alati u odvojenim venv-ovima (različite zavisnosti)
RUN python3 -m venv /opt/semgrep && /opt/semgrep/bin/pip install --no-cache-dir semgrep==1.179.0 \
 && python3 -m venv /opt/checkov && /opt/checkov/bin/pip install --no-cache-dir checkov==3.3.21 \
 && python3 -m venv /opt/tools && /opt/tools/bin/pip install --no-cache-dir pre-commit==4.6.2 "pyjwt[crypto]==2.10.1" \
 && python3 -m venv /opt/app-venv && /opt/app-venv/bin/pip install --no-cache-dir flask==3.1.2 pyyaml==6.0.3 \
 && ln -s /opt/tools/bin/pre-commit /usr/local/bin/pre-commit \
 && find /opt -name __pycache__ -prune -exec rm -rf {} +
COPY --from=tools /out/node/ /usr/local/
RUN npm install -g --no-audit --no-fund gitlab-ci-local@4.75.1 && npm cache clean --force && gitlab-ci-local --version
COPY --from=tools /out/bin/ /usr/local/bin/
COPY --from=tools /out/zap /opt/zap
COPY --from=tools /out/trivy-db.tar.zst /opt/trivy-db.tar.zst
COPY --from=tools /out/osv/ /opt/osv-db/
COPY --from=registry /bin/registry /usr/local/bin/registry
COPY --from=mirror /mirror /opt/registry
COPY files/ /
RUN git config --global user.email "dev@kurs-shop.ba" && git config --global user.name "Dev" \
 && git config --global init.defaultBranch main && git config --global advice.detachedHead false \
 && ln -s /opt/zap/zap.sh /usr/local/bin/zap.sh
ENV OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY=/opt/osv-db \
    SEMGREP_ENABLE_VERSION_CHECK=0 SEMGREP_SEND_METRICS=off \
    BC_SKIP_MAPPING=TRUE VAULT_ADDR=http://127.0.0.1:8200 \
    GCL_FORCE_SHELL_EXECUTOR=true
WORKDIR /root
CMD ["sleep", "infinity"]
