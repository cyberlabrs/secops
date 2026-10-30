# Lab okruženje za CKS: CKA kubeadm klaster (kurs-cka-lab) + sigurnosni alati.
# Nove slike za vježbe idu u drugi lokalni mirror (port 5001); prvi mirror (5000) dolazi iz CKA slike.
ARG BASE_IMAGE=kurs-cka-lab:1

FROM debian:bookworm-slim AS tools
ARG TARGETARCH
ARG TRIVY_VERSION=0.74.0
ARG KUBE_BENCH_VERSION=0.16.0
ARG FALCO_VERSION=0.45.0
ARG GVISOR_RELEASE=20260921
ARG KUBESEC_VERSION=v2.14.2
ARG KUBE_LINTER_VERSION=v0.8.1
ARG COSIGN_VERSION=v2.6.4
ARG SYFT_VERSION=1.51.1
ARG CALICO_VERSION=v3.32.2
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates bzip2 zstd && rm -rf /var/lib/apt/lists/*
WORKDIR /out
RUN set -e; A=$TARGETARCH; T=$( [ "$A" = arm64 ] && echo ARM64 || echo 64bit ); U=$( [ "$A" = arm64 ] && echo aarch64 || echo x86_64 ); \
    mkdir -p bin opt; \
    curl -fsSL https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${T}.tar.gz | tar xz -C bin trivy; \
    curl -fsSL https://github.com/aquasecurity/kube-bench/releases/download/v${KUBE_BENCH_VERSION}/kube-bench_${KUBE_BENCH_VERSION}_linux_${A}.tar.gz | tar xz -C opt; \
    mkdir -p opt/falco && curl -fsSL https://download.falco.org/packages/bin/${U}/falco-${FALCO_VERSION}-${U}.tar.gz | tar xz -C opt/falco --strip-components=1; \
    mkdir -p opt/gvisor && curl -fsSL https://storage.googleapis.com/gvisor/releases/release/${GVISOR_RELEASE}/${U}/gvisor.tar.bz2 | tar xj -C opt/gvisor; \
    curl -fsSL https://github.com/controlplaneio/kubesec/releases/download/${KUBESEC_VERSION}/kubesec_linux_${A}.tar.gz | tar xz -C bin kubesec; \
    curl -fsSL -o bin/kube-linter https://github.com/stackrox/kube-linter/releases/download/${KUBE_LINTER_VERSION}/kube-linter-linux$( [ "$A" = arm64 ] && echo _arm64 ); \
    curl -fsSL -o bin/cosign https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-${A}; \
    curl -fsSL https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_${A}.tar.gz | tar xz -C bin syft; \
    chmod +x bin/*; mv bin/trivy bin/trivy.bin; ls -la bin opt opt/gvisor; \
    mkdir -p manifests && curl -fsSL https://raw.githubusercontent.com/projectcalico/calico/${CALICO_VERSION}/manifests/calico.yaml \
      | sed -e 's|# - name: CALICO_IPV4POOL_CIDR|- name: CALICO_IPV4POOL_CIDR|' -e 's|#   value: "192.168.0.0/16"|  value: "10.244.0.0/16"|' > manifests/calico.yaml; \
    grep -A1 'name: CALICO_IPV4POOL_CIDR' manifests/calico.yaml; grep -o 'image: .*' manifests/calico.yaml | sort -u
# baza ranjivosti za Trivy (kompresovana; wrapper je raspakuje pri prvom pokretanju), da skeniranje radi bez interneta
RUN /out/bin/trivy.bin image --download-db-only --cache-dir /tmp/trivy-cache --no-progress \
 && tar -C /tmp/trivy-cache -c . | zstd -19 -T0 -q -o /out/trivy-db.tar.zst && ls -la /out/trivy-db.tar.zst

FROM registry:2.8.3 AS registry
FROM alpine:3.20 AS mirror
RUN apk add --no-cache skopeo
COPY --from=registry /bin/registry /bin/registry
COPY images.txt /images.txt
RUN printf 'version: 0.1\nstorage:\n  filesystem:\n    rootdirectory: /mirror\nhttp:\n  addr: 127.0.0.1:5001\n' > /registry.yml \
 && (registry serve /registry.yml >/tmp/reg.log 2>&1 &) && sleep 2 \
 && grep -v '^#' /images.txt | grep . | while read -r img; do \
      full=$(echo "$img" | awk -F/ '{ if (NF==1) print "docker.io/library/"$0; else if ($1 !~ /[.:]/) print "docker.io/"$0; else print $0 }'); \
      repo=$(echo "$full" | cut -d/ -f2-); echo "== $full"; \
      skopeo copy --retry-times 3 --dest-tls-verify=false "docker://$full" "docker://127.0.0.1:5001/$repo" >/dev/null || exit 1; \
    done

FROM ${BASE_IMAGE}
RUN mkdir -p /etc/apt/sources.list.d.off && mv /etc/apt/sources.list.d/kubernetes.list /etc/apt/sources.list.d.off/ \
 && mv /etc/apt/disabled/debian.sources /etc/apt/sources.list.d/ \
 && apt-get update && apt-get install -y --no-install-recommends apparmor apparmor-utils strace lsof net-tools zstd sudo \
 && rm -rf /var/lib/apt/lists/* \
 && mv /etc/apt/sources.list.d/debian.sources /etc/apt/disabled/ && mv /etc/apt/sources.list.d.off/kubernetes.list /etc/apt/sources.list.d/
COPY --from=tools /out/bin/ /usr/local/bin/
COPY --from=tools /out/opt/kube-bench /usr/local/bin/kube-bench
COPY --from=tools /out/opt/cfg /etc/kube-bench/cfg
COPY --from=tools /out/opt/falco/ /
COPY --from=tools /out/opt/gvisor/ /usr/local/bin/
COPY --from=tools /out/trivy-db.tar.zst /opt/trivy-db.tar.zst
COPY --from=tools /out/manifests/calico.yaml /opt/kurs/manifests/calico.yaml
COPY --from=mirror /mirror /opt/mirror-cks
COPY files/ /
RUN cat /etc/containerd/runsc.toml >> /etc/containerd/config.toml \
 && for h in /etc/containerd/certs.d/*/hosts.toml; do printf '\n[host."http://127.0.0.1:5001"]\n  capabilities = ["pull", "resolve"]\n' >> $h; done \
 && echo calico > /etc/kurs/cni \
 && sed -i 's|^policy-features=|# policy-features=|' /etc/apparmor/parser.conf \
 && systemctl enable kurs-registry-cks.service kurs-securityfs.service \
 && rm -rf /usr/src/falco-*
