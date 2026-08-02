#!/usr/bin/env bash
cd /home/sergey/Personal/research-tools
exec /home/sergey/miniconda3/envs/research3.12/bin/uvicorn server:app --host 127.0.0.1 --port 8000
