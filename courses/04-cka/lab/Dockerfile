# Lab okruženje za CKA: kubeadm klaster (Kubernetes 1.35) u Docker kontejnerima, kao kind.
# Svaki čvor (controlplane, node01) je jedan privilegovani kontejner sa systemd, containerd i kubeletom.
# Labovi rade bez interneta: slike se povlače iz lokalnog registry mirrora na svakom čvoru.
ARG NODE_IMAGE=kindest/node:v1.35.0

# ---------- alati i manifesti ----------
FROM debian:bookworm-slim AS tools
ARG TARGETARCH
ARG HELM_VERSION=v4.3.0
ARG ETCD_VERSION=v3.6.6
ARG UPGRADE_VERSION=1.36.5
ARG GATEWAY_API_VERSION=v1.6.1
ARG METRICS_SERVER_VERSION=v0.8.1
ARG FLANNEL_VERSION=v0.27.4
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg dpkg-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /out
RUN mkdir -p bin manifests charts \
 && curl -fsSL https://get.helm.sh/helm-${HELM_VERSION}-linux-${TARGETARCH}.tar.gz | tar xz -C /tmp && mv /tmp/linux-${TARGETARCH}/helm bin/ \
 && curl -fsSL https://github.com/etcd-io/etcd/releases/download/${ETCD_VERSION}/etcd-${ETCD_VERSION}-linux-${TARGETARCH}.tar.gz | tar xz -C /tmp \
 && mv /tmp/etcd-${ETCD_VERSION}-linux-${TARGETARCH}/etcdctl /tmp/etcd-${ETCD_VERSION}-linux-${TARGETARCH}/etcdutl bin/ \
 && curl -fsSL -o /tmp/kubeadm https://dl.k8s.io/release/v${UPGRADE_VERSION}/bin/linux/${TARGETARCH}/kubeadm && chmod +x /tmp/kubeadm \
 && curl -fsSL -o manifests/gateway-api-standard.yaml https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml \
 && curl -fsSL -o manifests/metrics-server.yaml https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml \
 && curl -fsSL -o manifests/kube-flannel.yaml https://github.com/flannel-io/flannel/releases/download/${FLANNEL_VERSION}/kube-flannel.yml \
 && bin/helm repo add traefik https://traefik.github.io/charts && bin/helm pull traefik/traefik --version 41.7.1 -d charts
# lokalni apt repozitorij sa paketima za nadogradnju klastera (kao pkgs.k8s.io na ispitu)
RUN MINOR=$(echo ${UPGRADE_VERSION} | cut -d. -f1,2) \
 && curl -fsSL https://pkgs.k8s.io/core:/stable:/v${MINOR}/deb/Release.key | gpg --dearmor -o /usr/share/keyrings/k8s.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/k8s.gpg] https://pkgs.k8s.io/core:/stable:/v${MINOR}/deb/ /" > /etc/apt/sources.list.d/k8s.list \
 && apt-get update && mkdir -p /out/k8s-apt && cd /out/k8s-apt \
 && apt-get download kubeadm=${UPGRADE_VERSION}-1.1 kubelet=${UPGRADE_VERSION}-1.1 kubectl=${UPGRADE_VERSION}-1.1 cri-tools kubernetes-cni \
 && dpkg-scanpackages . /dev/null > Packages
# spisak slika za mirror: slike za vježbe + slike iz manifesta + kontrolna ravan verzije za nadogradnju
COPY images.txt /tmp/images.txt
RUN { cat /tmp/images.txt; \
      /tmp/kubeadm config images list --kubernetes-version v${UPGRADE_VERSION}; \
      grep -h 'image:' manifests/*.yaml | awk '{print $2}' | tr -d '"' | sed 's/@sha256.*//'; \
      tar xzf charts/traefik-*.tgz -O traefik/Chart.yaml | awk '/^appVersion:/ {print "docker.io/library/traefik:" $2}'; \
    } | grep -v '^#' | grep . | sort -u > /out/mirror-images.txt && cat /out/mirror-images.txt

# ---------- offline registry mirror ----------
FROM registry:2.8.3 AS registry
FROM alpine:3.20 AS mirror
RUN apk add --no-cache skopeo
COPY --from=registry /bin/registry /bin/registry
COPY --from=tools /out/mirror-images.txt /mirror-images.txt
RUN printf 'version: 0.1\nstorage:\n  filesystem:\n    rootdirectory: /mirror\nhttp:\n  addr: 127.0.0.1:5000\n' > /registry.yml \
 && (registry serve /registry.yml >/tmp/reg.log 2>&1 &) && sleep 2 \
 && while read -r img; do \
      full=$(echo "$img" | awk -F/ '{ if (NF==1) print "docker.io/library/"$0; else if ($1 !~ /[.:]/) print "docker.io/"$0; else print $0 }'); \
      repo=$(echo "$full" | cut -d/ -f2-); \
      echo "== $full -> $repo"; \
      skopeo copy --retry-times 3 --dest-tls-verify=false "docker://$full" "docker://127.0.0.1:5000/$repo" >/dev/null || exit 1; \
    done < /mirror-images.txt

# ---------- čvor ----------
FROM ${NODE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssh-server openssh-client vim nano less bash-completion dnsutils netcat-openbsd iputils-ping \
      procps psmisc tree socat ethtool conntrack ebtables \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /etc/apt/disabled && mv /etc/apt/sources.list.d/debian.sources /etc/apt/disabled/
COPY --from=registry /bin/registry /usr/local/bin/registry
COPY --from=mirror /mirror /opt/mirror
COPY --from=tools /out/bin/ /usr/local/bin/
COPY --from=tools /out/manifests/ /opt/kurs/manifests/
COPY --from=tools /out/charts/ /opt/kurs/charts/
COPY --from=tools /out/k8s-apt/ /opt/k8s-apt/
COPY files/ /
RUN sed 's#{{ .PodSubnet }}#10.244.0.0/16#' /kind/manifests/default-cni.yaml > /opt/kurs/manifests/kindnet.yaml \
 && echo 'deb [trusted=yes] file:/opt/k8s-apt ./' > /etc/apt/sources.list.d/kubernetes.list \
 && cat /etc/containerd/registry.toml >> /etc/containerd/config.toml \
 \
 && systemctl enable kurs-registry.service ssh.service \
 && ssh-keygen -A && mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N '' -f /root/.ssh/id_ed25519 \
 && cp /root/.ssh/id_ed25519.pub /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys \
 && mkdir -p /etc/bash_completion.d && kubectl completion bash > /etc/bash_completion.d/kubectl && helm completion bash > /etc/bash_completion.d/helm
