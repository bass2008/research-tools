"""Ключ самой свежей копии базы в R2."""
import os

import boto3

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"], region_name="auto",
                  aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                  aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
bucket = os.environ.get("R2_BACKUPS_BUCKET", "arcana-backups")
objects = s3.list_objects_v2(Bucket=bucket, Prefix="destiny-matrix/").get("Contents") or []
if not objects:
    raise SystemExit("в R2 нет ни одной копии")
print(max(objects, key=lambda o: o["LastModified"])["Key"])
