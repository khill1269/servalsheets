output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer for Route53"
  value       = aws_lb.main.zone_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.app.name
}

output "ecs_service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.app.arn
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.app.arn
}

output "ecs_task_definition_family" {
  description = "Family of the ECS task definition"
  value       = aws_ecs_task_definition.app.family
}

output "ecs_task_definition_revision" {
  description = "Revision of the ECS task definition"
  value       = aws_ecs_task_definition.app.revision
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.app.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_logs.arn
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_tasks_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.main[0].arn : null
}

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.main[0].id : null
}

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value = var.enable_monitoring ? format(
    "https://console.aws.amazon.com/cloudwatch/home?region=%s#dashboards:name=%s",
    var.aws_region,
    aws_cloudwatch_dashboard.main[0].dashboard_name
  ) : null
}

output "cloudwatch_log_group_url" {
  description = "URL to the CloudWatch logs"
  value = format(
    "https://console.aws.amazon.com/cloudwatch/home?region=%s#logStream:group=%s",
    var.aws_region,
    aws_cloudwatch_log_group.ecs_logs.name
  )
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarms (if created)"
  value       = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? aws_sns_topic.alarms[0].arn : var.alarm_sns_topic_arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}

output "http_listener_arn" {
  description = "ARN of the HTTP listener (redirect)"
  value       = aws_lb_listener.http.arn
}

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = var.certificate_arn != "" ? var.certificate_arn : aws_acm_certificate.default[0].arn
}

output "service_url" {
  description = "URL to access the ServalSheets MCP server"
  value = var.domain_name != "" ? format(
    "https://%s/mcp",
    var.domain_name
  ) : format(
    "https://%s/mcp",
    aws_lb.main.dns_name
  )
}

output "health_check_url" {
  description = "URL for health checks"
  value = format(
    "https://%s%s",
    aws_lb.main.dns_name,
    var.health_check_path
  )
}

output "ecs_autoscaling_target_arn" {
  description = "ARN of the ECS autoscaling target"
  value       = aws_appautoscaling_target.ecs_target.service_namespace
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = var.ecr_repository_url
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "container_port" {
  description = "Container port"
  value       = var.container_port
}

output "deployment_info" {
  description = "Deployment information summary"
  value = {
    cluster_name          = aws_ecs_cluster.main.name
    service_name          = aws_ecs_service.app.name
    task_definition_arn   = aws_ecs_task_definition.app.arn
    alb_dns_name          = aws_lb.main.dns_name
    desired_task_count    = var.desired_count
    cpu                   = var.cpu
    memory                = var.memory
    auto_scaling_min      = var.min_capacity
    auto_scaling_max      = var.max_capacity
    target_cpu_util       = var.target_cpu_utilization
    target_memory_util    = var.target_memory_utilization
    waf_enabled           = var.enable_waf
    container_insights    = var.enable_container_insights
  }
}
