#!/bin/sh
# One-shot bootstrap for the single-node dev Garage cluster. Runs in a
# throwaway alpine sidecar that shares the `garage` container's network +
# PID namespace, because the official dxflrs/garage image ships a single
# static binary with no shell -- `chroot /proc/1/root /garage ...` is how
# we invoke the `garage` CLI against the running server from outside it.
set -eu

: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

G="chroot /proc/1/root /garage -c /etc/garage.toml"

for i in $(seq 1 30); do
  if $G node id -q >/dev/null 2>&1; then break; fi
  echo "Waiting for Garage RPC... ($i/30)"
  sleep 2
done
$G node id -q >/dev/null 2>&1 || { echo "Garage RPC never became ready"; exit 1; }

if $G status 2>&1 | grep -q 'NO ROLE ASSIGNED'; then
  NODE_ID=$($G node id -q | cut -c1-16)
  $G layout assign "$NODE_ID" -z dev -c 1G
  $G layout apply --version 1
fi

$G key import --yes -n changdee-app "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" || true
$G bucket create "$S3_BUCKET" || true
$G bucket allow "$S3_BUCKET" --key changdee-app --read --write --owner

# Uploads are presigned PUT URLs the *browser* sends straight to Garage
# (SPEC.md section 7.9) -- without a CORS policy on the bucket, every one
# of those cross-origin PUTs fails preflight and the upload silently never
# completes. The garage CLI has no `bucket cors` subcommand, so this uses
# the AWS CLI against Garage's S3-compatible API instead (same network
# namespace as the `garage` service, hence 127.0.0.1).
apk add --no-cache aws-cli >/dev/null
aws --endpoint-url http://127.0.0.1:3900 s3api put-bucket-cors \
  --bucket "$S3_BUCKET" \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]}'

echo "Garage initialized: bucket '${S3_BUCKET}' ready (CORS configured)."
