FROM python:latest
ADD . /app
WORKDIR /app
RUN apt-get update && apt-get install -y curl iputils-ping
RUN pip install -r requirements.txt
ENV API_TOKEN=glpat-Xk9vQ2mR7tLw4ZpN8sYc
EXPOSE 8080
CMD python app.py
