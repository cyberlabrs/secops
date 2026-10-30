# Okruženje za labove AWS Security Specialty.
# Labovi rade offline (--network none) nad realističnim AWS podacima: CloudTrail i VPC Flow
# logovi, IAM/SCP/bucket politike, CloudFormation/Terraform šabloni i git repo sa tajnama.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion bsdextrautils ca-certificates curl file git jq less nano \
      python3 python3-venv python3-pip tree vim-tiny xxd gzip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim

# IaC i IAM alati (verzije zaključane radi ponovljivosti)
RUN python3 -m venv /opt/tools \
    && /opt/tools/bin/pip install --no-cache-dir checkov==3.2.334 cfn-lint==1.20.1 parliament==1.6.3 setuptools==75.8.0 \
    && for b in cfn-lint parliament; do ln -s /opt/tools/bin/$b /usr/local/bin/$b; done \
    && printf '#!/bin/sh\n# lab radi bez mreže: ne preuzimaj pravila ni mapiranja sa interneta\nexec /opt/tools/bin/checkov --skip-download "$@"\n' > /usr/local/bin/checkov \
    && chmod 755 /usr/local/bin/checkov
ENV BC_SKIP_MAPPING=TRUE

# gitleaks (skeniranje tajni)
RUN arch=$(uname -m); case $arch in x86_64) a=x64;; aarch64|arm64) a=arm64;; *) echo "nepodržana arhitektura $arch"; exit 1;; esac; \
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_${a}.tar.gz" \
      | tar xz -C /usr/local/bin gitleaks && gitleaks version

RUN git config --global user.email "dev@primjer-firma.ba" && git config --global user.name "Dev" \
    && git config --global init.defaultBranch main && git config --global advice.detachedHead false

COPY iam_eval.py /usr/local/bin/iam-eval
RUN sed -i "1s|.*|#!/opt/tools/bin/python|" /usr/local/bin/iam-eval && chmod 755 /usr/local/bin/iam-eval
COPY bashrc /root/.bashrc
WORKDIR /root
CMD ["sleep", "infinity"]
