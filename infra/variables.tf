variable "aws_region" {
    description = "AWS region for deployment"
    type        = string
}

variable "registry_arn" {
    description = "ARN of ECR"
    type        = string
}

variable "s3_arn" {
    description = "ARN of S3 bucket"
    type        = string
}

variable "ecs_arn" {
    description = "ARN of ECS Cluster"
    type        = string
}

variable env_file_arn {
    description = "Image tag used"
    type        = string
}

variable log_retention_period {
    description = "Number of days for task definition log retention"
    type        = number
    default = 7
}

variable cpu_request {
    description = "Amount of vCPU requested"
    type        = number
    default = 1024
}

variable mem_request {
    description = "Amount of Mem requested"
    type        = number
    default = 2048
}

variable app_name {
    description = "Name of App"
    type        = string
    default = "ai-coding-agent"
}

variable image_url {
    description = "URL to the image"
    type        = string
}

variable image_tag {
    description = "Image tag used"
    type        = string
}

variable desired_replica_count {
    description = "Image tag used"
    type        = number
    default = 1
}

variable target_environment {
    description = "Environemt of application"
    type        = string
}

variable log_group_name {
    description = "Name of log group"
    type        = string
}

variable container_port {
    description = "Port for application"
    type        = number
}

variable hosted_zone_id {
    type        = string
}

variable domain_name {
    type        = string
}