terraform {
  required_version = ">= 1.5.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.136.0, < 1.0.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.89.0"
    }
  }
}
