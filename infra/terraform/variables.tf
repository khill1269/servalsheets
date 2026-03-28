variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "ecr_repository_url" {
  description = "ECR repository URL for ServalSheets MCP server image"
  type        = string
  default     = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = "us-east-1_d6Q1t6bUi"
}

variable "cognito_client_id" {
  description = "Cognito Application Client ID"
  type        = string
  default     = "5ro2o67qejkbgd6857ee521r93"
}

variable "bedrock_guardrail_id" {
  description = "Bedrock Guardrail ID for content filtering"
  type        = string
  default     = "rur8hed14y0b"
}

variable "bedrock_guardrail_version" {
  description = "Bedrock Guardrail version"
  type        = string
  default     = "1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "container_port" {
  description = "Port exposed by the container (AgentCore requires 8000)"
  type        = number
  default     = 8000
}

variable "cpu" {
  description = "CPU units for ECS task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096, 8192, 16384], var.cpu)
    error_message = "CPU must be a valid ECS Fargate value."
  }
}

variable "memory" {
  description = "Memory in MB for ECS task"
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.desired_count >= 2
    error_message = "Desired count must be at least 2 for high availability."
  }
}

variable "min_capacity" {
  description = "Minimum number of tasks for auto-scaling"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto-scaling"
  type        = number
  default     = 10
}

variable "target_cpu_utilization" {
  description = "Target CPU utilization for auto-scaling (percentage)"
  type        = number
  default     = 70
  validation {
    condition     = var.target_cpu_utilization > 0 && var.target_cpu_utilization < 100
    error_message = "Target CPU utilization must be between 1 and 99."
  }
}

variable "target_memory_utilization" {
  description = "Target memory utilization for auto-scaling (percentage)"
  type        = number
  default     = 75
  validation {
    condition     = var.target_memory_utilization > 0 && var.target_memory_utilization < 100
    error_message = "Target memory utilization must be between 1 and 99."
  }
}

variable "health_check_path" {
  description = "Health check path for the MCP server"
  type        = string
  default     = "/health/live"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive successful health checks required"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive failed health checks required to mark unhealthy"
  type        = number
  default     = 3
}

variable "domain_name" {
  description = "Optional domain name for Route53 and ACM certificate"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS listener"
  type        = string
  default     = ""
}

variable "enable_waf" {
  description = "Enable AWS WAF for the load balancer"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch value."
  }
}

variable "alarm_sns_topic_arn" {
  description = "Optional SNS topic ARN for alarm notifications"
  type        = string
  default     = ""
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing for the ECS service"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "secrets_manager_prefix" {
  description = "Prefix for Secrets Manager secret names"
  type        = string
  default     = "servalsheets"
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = true
}

variable "cloudwatch_alarms_enabled" {
  description = "Enable CloudWatch alarms for monitoring"
  type        = bool
  default     = true
}

variable "high_cpu_threshold" {
  description = "CPU threshold percentage for high CPU alarm"
  type        = number
  default     = 85
}

variable "high_memory_threshold" {
  description = "Memory threshold percentage for high memory alarm"
  type        = number
  default     = 85
}

variable "error_rate_threshold" {
  description = "5xx error rate threshold percentage for alarm"
  type        = number
  default     = 5
}
