# Lab okruženje za detekciju i odgovor na incidente: jedan kontejner bez mreže.
# Wazuh manager (analiza logova, FIM, active response), sshd + rsyslog (pravi auth.log),
# Falco (replay scap snimaka), Sigma (sigma-cli + backendi, SigmaHQ pravila), Zircolite.

FROM debian:bookworm-slim AS tools
ARG TARGETARCH
ARG FALCO_VERSION=0.45.0
ARG ZIRCOLITE_VERSION=4.1.0
ARG SIGMA_RULES_RELEASE=r2026-07-01
ARG YQ_VERSION=4.53.6
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /out
RUN set -e; U=$( [ "$TARGETARCH" = arm64 ] && echo aarch64 || echo x86_64 ); \
    mkdir -p bin && curl -fsSL -o bin/yq https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_${TARGETARCH} && chmod +x bin/yq; \
    mkdir -p falco && curl -fsSL https://download.falco.org/packages/bin/${U}/falco-${FALCO_VERSION}-${U}.tar.gz | tar xz -C falco --strip-components=1; \
    mkdir -p traces && curl -fsSL -o /tmp/t.zip https://download.falco.org/fixtures/trace-files/traces-positive.zip && unzip -q /tmp/t.zip -d /tmp/t && mv /tmp/t/traces-positive/*.scap traces/; \
    curl -fsSL https://github.com/wagga40/Zircolite/archive/refs/tags/v${ZIRCOLITE_VERSION}.tar.gz | tar xz && mv Zircolite-${ZIRCOLITE_VERSION} zircolite; \
    curl -fsSL -o /tmp/s.zip https://github.com/SigmaHQ/sigma/releases/download/${SIGMA_RULES_RELEASE}/sigma_all_rules.zip && mkdir -p sigma && unzip -q /tmp/s.zip -d sigma; \
    ls; du -sh *

# Python alati (Zircolite ima Cython ekstenziju, pa se gradi ovdje; ista bazna slika kao završna)
FROM debian:bookworm-slim AS py
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv python3-dev build-essential && rm -rf /var/lib/apt/lists/*
COPY --from=tools /out/zircolite /opt/zircolite
RUN python3 -m venv /opt/zircolite/venv && /opt/zircolite/venv/bin/pip install --no-cache-dir /opt/zircolite \
 && /opt/zircolite/venv/bin/python /opt/zircolite/zircolite.py --version
RUN python3 -m venv /opt/sigma && /opt/sigma/bin/pip install --no-cache-dir "sigma-cli==3.1.0" "pysigma<2" \
      "pysigma-backend-splunk==2.1.0" "pysigma-backend-elasticsearch" "pysigma-backend-kusto==1.0.1" "pysigma-pipeline-sysmon" pyyaml \
 && /opt/sigma/bin/sigma version && /opt/sigma/bin/sigma list targets \
 && find /opt -name __pycache__ -prune -exec rm -rf {} +

FROM debian:bookworm-slim
ARG WAZUH_VERSION=4.14.8-1
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion ca-certificates curl gnupg less nano vim-tiny jq file xxd unzip zstd procps psmisc iproute2 lsof \
      rsyslog logrotate openssh-server openssh-client cron sudo iptables python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim
RUN curl -fsSL https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /usr/share/keyrings/wazuh.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" > /etc/apt/sources.list.d/wazuh.list \
 && apt-get update && apt-get install -y --no-install-recommends wazuh-manager=${WAZUH_VERSION} \
 && rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/wazuh.list \
 && /var/ossec/bin/wazuh-control info
COPY --from=py /opt/sigma /opt/sigma
COPY --from=py /opt/zircolite /opt/zircolite
RUN ln -s /opt/sigma/bin/sigma /usr/local/bin/sigma && sigma version
COPY --from=tools /out/falco/ /
COPY --from=tools /out/bin/ /usr/local/bin/
COPY --from=tools /out/traces /opt/kurs/falco-traces
COPY --from=tools /out/sigma /opt/sigma-rules
# pySigma (sigma check) učitava MITRE ATT&CK i D3FEND podatke sa interneta i kešira ih u ~/.cache/pysigma; keš se puni ovdje
RUN f=$(find /opt/sigma-rules/rules/cloud/aws -name '*.yml' | head -1); (sigma check "$f" >/dev/null 2>&1 || true) \
 && ls /root/.cache/pysigma/mitre_attack/cache.db /root/.cache/pysigma/mitre_d3fend/cache.db
COPY files/ /
# kontejner nema pristup kernel logu; bez ovoga rsyslog javlja grešku pri svakom startu
RUN sed -i 's/^module(load="imklog"/#&/' /etc/rsyslog.conf
WORKDIR /root
CMD ["sleep", "infinity"]
