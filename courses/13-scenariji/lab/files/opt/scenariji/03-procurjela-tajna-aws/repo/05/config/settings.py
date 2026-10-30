import os

REGION = "eu-central-1"
IZVOR_BUCKET = "kvadrat-kupci-prod"
IZVOR_PREFIX = "exports/dnevni/"
CILJ_BUCKET = "kvadrat-izvjestaji"

# Kredencijali dolaze iz okruženja (CI varijable ili ~/.aws/credentials), nikad iz koda.
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
