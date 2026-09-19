"""Положить файл в R2 по S3-протоколу. Отдельный файл, а не heredoc внутри backup.sh: так его
видно линтеру и можно запустить руками при разборе."""
import os
import sys

import boto3


def main(path: str, key: str) -> None:
    s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"], region_name="auto",
                      aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                      aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
    bucket = os.environ.get("R2_BACKUPS_BUCKET", "arcana-backups")
    with open(path, "rb") as handle:
        s3.put_object(Bucket=bucket, Key=key, Body=handle.read())
    size = s3.head_object(Bucket=bucket, Key=key)["ContentLength"]
    print(f"  r2://{bucket}/{key}  {size} Б")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
