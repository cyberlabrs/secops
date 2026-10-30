# Lab okruženje za CySA+ (CS0-004): nadogradnja DevSecOps slike (Trivy, osv-scanner, registry, jq, Python)
# sa alatima za skeniranje i analizu saobraćaja i lokalnim kopijama CISA KEV i EPSS podataka.
ARG BASE_IMAGE=kurs-devsecops-lab:1
FROM ${BASE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends nmap tcpdump tshark netcat-openbsd iproute2 lsof \
 && rm -rf /var/lib/apt/lists/* \
 && /opt/tools/bin/pip install --no-cache-dir cvss==3.6 \
 && ln -sf /opt/tools/bin/cvss_calculator /usr/local/bin/cvss_calculator
# CISA KEV katalog i FIRST EPSS skorovi (snimak u trenutku builda; lab nema mrežu)
RUN mkdir -p /opt/kurs/data \
 && curl -fsSL -o /opt/kurs/data/kev.json https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json \
 && curl -fsSL -L https://epss.empiricalsecurity.com/epss_scores-current.csv.gz | gunzip > /opt/kurs/data/epss.csv \
 && jq '.vulnerabilities | length' /opt/kurs/data/kev.json && head -3 /opt/kurs/data/epss.csv && wc -l /opt/kurs/data/epss.csv
COPY files/ /
WORKDIR /root
CMD ["sleep", "infinity"]
