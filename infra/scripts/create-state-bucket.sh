#!/usr/bin/env bash
# Creates the S3 bucket used for Terraform remote state.
# Run once before the first `terraform init`.
#
# Usage: bash create-state-bucket.sh [env]
#   env: dev (default) | prd
#
# Prerequisites: AWS CLI configured with sufficient permissions.
set -euo pipefail

ENV="${1:-dev}"
BUCKET_NAME="gakkyu-alert-${ENV}-tfstate"
REGION="ap-northeast-1"

echo "Creating S3 state bucket: ${BUCKET_NAME} in ${REGION} ..."

aws s3api create-bucket \
  --bucket "${BUCKET_NAME}" \
  --region "${REGION}" \
  --create-bucket-configuration LocationConstraint="${REGION}"

# Versioning is required for S3-native state locking (use_lockfile = true).
aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" },
      "BucketKeyEnabled": true
    }]
  }'

aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "✅  Bucket ${BUCKET_NAME} ready."
echo "    Next: cd infra/environments/${ENV} && terraform init"
