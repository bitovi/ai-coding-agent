terraform {

  backend "s3" {      # Bitovi Playground Registry 
    bucket         = "bitovi-terraform-state-files-pg"
    key            = "ai-coding-agent/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
  }

  # backend "s3" {    # Bitovi AI Registry
  #   bucket         = "ai-coding-agent"
  #   key            = "terraform/terraform.tfstate"
  #   region         = "us-east-2"
  #   encrypt        = true
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
  }

  required_version = ">= 1.2"
}
