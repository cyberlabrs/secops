import argparse
import io

import boto3
import pandas as pd

from config import settings


def s3_klijent():
    return boto3.client("s3", region_name=settings.REGION)


def ucitaj_izvoz(datum):
    obj = s3_klijent().get_object(Bucket=settings.IZVOR_BUCKET, Key=f"{settings.IZVOR_PREFIX}{datum}.csv")
    return pd.read_csv(io.BytesIO(obj["Body"].read()))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--datum", required=True)
    a = p.parse_args()
    df = ucitaj_izvoz(a.datum)
    print(f"{len(df)} redova")


if __name__ == "__main__":
    main()
