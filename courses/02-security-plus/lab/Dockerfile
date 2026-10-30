# Okruženje za labove Security+ SY0-801.
# Kontejner radi bez mreže (--network none). NET_ADMIN važi samo za njegov
# vlastiti mrežni prostor i treba za firewall lab (nftables).
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends \
      bash-completion bsdextrautils ca-certificates cron curl dnsutils file iproute2 jq less \
      cracklib-runtime libpam-pwquality libpwquality-tools nano ncat nftables nmap openssl passwd procps psmisc python3 \
      sqlite3 sudo tcpdump tree vim-tiny xxd \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/vim.tiny /usr/local/bin/vim

COPY bashrc /root/.bashrc
WORKDIR /root
CMD ["sleep", "infinity"]
