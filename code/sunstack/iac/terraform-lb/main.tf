terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "7.33.0"
    }
  }

  required_version = ">= 1.14.3"
}

provider "google" {
  project = var.project_id
  region  = var.region
}
