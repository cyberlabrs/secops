# Lab okruženje za sigurnost AI/ML sistema: DevSecOps slika (cosign, syft, jq, Python) + Python biblioteke
# za validaciju izlaza modela i bezbjedne formate modela. Pravi LLM nije potreban: labovi rade sa
# snimljenim izlazima modela, malim modelima (numpy težine) i dokumentima.
ARG BASE_IMAGE=kurs-devsecops-lab:1
FROM ${BASE_IMAGE}
RUN python3 -m venv /opt/ai && /opt/ai/bin/pip install --no-cache-dir jsonschema==4.26.0 safetensors==0.8.0 numpy==2.5.3 \
 && /opt/ai/bin/python -c "import jsonschema, safetensors, numpy; print('ok')"
COPY files/ /
WORKDIR /root
CMD ["sleep", "infinity"]
