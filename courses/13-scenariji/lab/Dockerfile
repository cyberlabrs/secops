# Lab okruženje za scenarije incidenata kroz više kurseva: jedan kontejner bez mreže.
# Osnova je detection lab (Wazuh, Sigma/Zircolite, Falco replay, jq, yq), uz KQL (lokql iz SC-200 slike),
# gitleaks (iz DevSecOps slike) i git. Podaci scenarija su u /opt/scenariji/<modul>/; setup laba ih kopira u /root.
FROM kurs-sc200-lab:1 AS sc200
FROM kurs-devsecops-lab:1 AS devsecops
FROM kurs-detekcija-lab:1
RUN apt-get update && apt-get install -y --no-install-recommends libicu72 git && rm -rf /var/lib/apt/lists/*
COPY --from=sc200 /opt/lokql /opt/lokql
COPY --from=devsecops /usr/local/bin/gitleaks /usr/local/bin/gitleaks
COPY files/ /
RUN ln -s /opt/lokql/lokql /usr/local/bin/lokql && chmod +x /usr/local/bin/* \
 && git config --global user.email analiticar@soc.local && git config --global user.name "SOC analiticar" \
 && git config --global init.defaultBranch main && gitleaks version
WORKDIR /root
CMD ["sleep", "infinity"]
