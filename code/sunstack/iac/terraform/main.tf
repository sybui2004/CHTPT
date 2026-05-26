# Ref: https://github.com/terraform-google-modules/terraform-google-kubernetes-engine/blob/master/examples/simple_autopilot_public
terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "7.16.0"
    }
  }
  required_version = ">= 1.14.3"
}

provider "google" {
  project     = var.project_id
  region      = var.region
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "my_bucket" {
  name     = "${var.project_id}-tmdt-bucket-${random_id.suffix.hex}"
  location = var.region

  force_destroy = true
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30
    }
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.my_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# gcloud storage cp -r ../data/cifar-10/train gs://dataengineering-489105-image-retrieval-bucket-81f40c1e/cifar-10/train