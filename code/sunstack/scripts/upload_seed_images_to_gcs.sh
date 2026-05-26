#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET_DIR="${SEED_ASSET_DIR:-$ROOT_DIR/databases/seed_assets}"
BUCKET_NAME="${GCS_BUCKET_NAME:-shopbee-485000-tmdt-bucket-a1b7287e}"
GCS_PREFIX="${GCS_SEED_PREFIX:-seed/demo}"
DESTINATION="gs://${BUCKET_NAME}/${GCS_PREFIX}"

if [ ! -d "$ASSET_DIR/products" ] || [ ! -d "$ASSET_DIR/shops" ]; then
  echo "Seed images are missing. Run: node databases/seed_assets/download_seed_images.js" >&2
  exit 1
fi

if command -v gcloud >/dev/null 2>&1; then
  gcloud storage cp --recursive "$ASSET_DIR/products" "$DESTINATION/"
  gcloud storage cp --recursive "$ASSET_DIR/shops" "$DESTINATION/"
elif command -v gsutil >/dev/null 2>&1; then
  gsutil -m cp -r "$ASSET_DIR/products" "$DESTINATION/"
  gsutil -m cp -r "$ASSET_DIR/shops" "$DESTINATION/"
else
  echo "Install Google Cloud CLI first. Missing both gcloud and gsutil." >&2
  exit 1
fi

echo "Uploaded seed images to ${DESTINATION}"
