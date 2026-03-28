terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure state locking and remote state:
  # Uncomment and customize for your environment
  # backend "s3" {
  #   bucket         = "servalsheets-terraform-state"
  #   key            = "servalsheets-mcp-server/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "servalsheets-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
