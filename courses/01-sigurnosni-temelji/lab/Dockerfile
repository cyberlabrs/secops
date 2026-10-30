# Okruženje za labove modula "Sigurnosni temelji".
# Kontejner se pokreće bez mreže (--network none); sve vježbe rade lokalno.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion bsdextrautils ca-certificates cron curl file iproute2 jq less lynis \
      nano ncat nmap openssh-server openssl passwd procps psmisc python3 \
      sqlite3 sudo tree vim-tiny xxd \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim \
    && mkdir -p /run/sshd && ssh-keygen -A

COPY bashrc /root/.bashrc
WORKDIR /root
CMD ["sleep", "infinity"]
