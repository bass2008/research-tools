"""Забрать объект из R2 в файл."""
import os
import sys

import boto3

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"], region_name="auto",
                  aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                  aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
bucket = os.environ.get("R2_BACKUPS_BUCKET", "arcana-backups")
s3.download_file(bucket, sys.argv[1], sys.argv[2])
