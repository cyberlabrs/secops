# Lab okruženje za SC-200: KQL offline (lokql / Kusto-Loco) nad Microsoftovim javnim primjerima podataka.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS lokql
ARG TARGETARCH
ARG KUSTOLOCO_VERSION=v1.4.9
RUN git clone --depth 1 --branch ${KUSTOLOCO_VERSION} https://github.com/NeilMacMullen/kusto-loco /src
WORKDIR /src/applications/lokql
RUN R=$( [ "$TARGETARCH" = arm64 ] && echo linux-arm64 || echo linux-x64 ); \
    dotnet publish -c Release -r $R --self-contained true -p:PublishSingleFile=true -o /out >/tmp/publish.log 2>&1 \
 || { tail -30 /tmp/publish.log; exit 1; }; rm -f /out/*.pdb; ls -la /out

FROM debian:bookworm-slim AS data
ARG TARGETARCH
ARG YQ_VERSION=4.53.6
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /data
# StormEvents: Microsoftov KQL tutorial skup; ostalo: Azure-Sentinel/Sample Data/ASIM (MIT licenca)
RUN set -e; B="https://raw.githubusercontent.com/Azure/Azure-Sentinel/master/Sample%20Data/ASIM"; \
    curl -fsSL -o StormEvents.csv https://kustosamples.blob.core.windows.net/samplefiles/StormEvents.csv; \
    curl -fsSL -o SecurityEvent.raw.csv "$B/Microsoft_Security%20Events_Authentication_IngestedLogs.csv"; \
    curl -fsSL -o DeviceProcessEvents.raw.csv "$B/Microsoft_M365%20Defender%20for%20Endpoint_ProcessEvent_IngestedLogs.csv"; \
    curl -fsSL -o AzureFirewall.raw.csv "$B/Microsoft_Azure%20Firewall_NetworkSession_IngestedLogs.csv"; \
    ls -la
RUN mkdir -p /bin-out && curl -fsSL -o /bin-out/yq https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_${TARGETARCH} && chmod +x /bin-out/yq
COPY prep.py /prep.py
RUN python3 /prep.py && rm -f *.raw.csv && ls -la

FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion ca-certificates less nano vim-tiny jq python3 libicu72 \
    && rm -rf /var/lib/apt/lists/* && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim
COPY --from=lokql /out /opt/lokql
COPY --from=data /data /opt/kurs/data
COPY --from=data /bin-out/ /usr/local/bin/
COPY files/ /
RUN ln -s /opt/lokql/lokql /usr/local/bin/lokql && chmod +x /usr/local/bin/kql
WORKDIR /root
CMD ["sleep", "infinity"]
