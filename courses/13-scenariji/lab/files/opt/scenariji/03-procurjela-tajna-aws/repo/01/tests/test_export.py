import boto3
from moto import mock_aws

# Lažni kredencijali iz AWS dokumentacije, samo za moto.
TEST_KEY = "AKIAIOSFODNN7EXAMPLE"
TEST_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"


@mock_aws
def test_ucitaj_izvoz(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", TEST_KEY)
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", TEST_SECRET)
    s3 = boto3.client("s3", region_name="eu-central-1")
    s3.create_bucket(Bucket="kvadrat-kupci-prod", CreateBucketConfiguration={"LocationConstraint": "eu-central-1"})
    s3.put_object(Bucket="kvadrat-kupci-prod", Key="exports/dnevni/2026-09-27.csv", Body=b"id,ime\n1,Test\n")
    from app.export import ucitaj_izvoz
    assert len(ucitaj_izvoz("2026-09-27")) == 1
