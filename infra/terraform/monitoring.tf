# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  count             = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? 1 : 0
  name              = "${local.namespace}-alarms"
  kms_master_key_id = "alias/aws/sns"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-alarms-topic"
    }
  )
}

# SNS Topic Subscription (optional - replace with actual email)
resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? 0 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = "ops@example.com" # Replace with actual email
}

locals {
  alarm_topic_arn = var.alarm_sns_topic_arn != "" ? var.alarm_sns_topic_arn : (var.enable_monitoring ? aws_sns_topic.alarms[0].arn : "")
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  count          = var.enable_monitoring ? 1 : 0
  dashboard_name = "${local.namespace}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { stat = "Average" }],
            [".", "MemoryUtilization", { stat = "Average" }],
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            [".", "RequestCount", { stat = "Sum" }],
            [".", "HealthyHostCount", { stat = "Average" }],
            [".", "UnHealthyHostCount", { stat = "Average" }],
            [".", "HTTPCode_Target_5XX_Count", { stat = "Sum" }],
            [".", "HTTPCode_Target_4XX_Count", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ServalSheets MCP Server Metrics"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type = "log"
        properties = {
          query   = "fields @timestamp, @message | stats count() as log_count by @logStream"
          region  = var.aws_region
          title   = "Log Stream Activity"
          queryId = "servalsheets-logs"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "ActiveConnectionCount", { stat = "Sum" }],
            [".", "NewConnectionCount", { stat = "Sum" }],
            [".", "ProcessedBytes", { stat = "Sum" }]
          ]
          period = 60
          stat   = "Sum"
          region = var.aws_region
          title  = "Load Balancer Connections"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "ServiceCount", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Service Task Count"
        }
      }
    ]
  })
}

# Alarm - High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-ecs-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.high_cpu_threshold
  alarm_description   = "Alert when ECS CPU utilization exceeds ${var.high_cpu_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = aws_ecs_service.app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-ecs-cpu-high-alarm"
    }
  )
}

# Alarm - High Memory Utilization
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-ecs-memory-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.high_memory_threshold
  alarm_description   = "Alert when ECS memory utilization exceeds ${var.high_memory_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = aws_ecs_service.app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-ecs-memory-high-alarm"
    }
  )
}

# Alarm - Target 5xx Errors
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-alb-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when 5xx error count exceeds 10 in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-alb-5xx-alarm"
    }
  )
}

# Alarm - Unhealthy Hosts
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Alert when there are unhealthy targets"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-alb-unhealthy-hosts-alarm"
    }
  )
}

# Alarm - Target Response Time
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-alb-response-time-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 1 # 1 second
  alarm_description   = "Alert when average response time exceeds 1 second"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-alb-response-time-alarm"
    }
  )
}

# Alarm - ALB Request Count Anomaly
resource "aws_cloudwatch_metric_alarm" "alb_request_count_anomaly" {
  count               = var.cloudwatch_alarms_enabled && var.enable_monitoring ? 1 : 0
  alarm_name          = "${local.namespace}-alb-request-anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = 2
  threshold_metric_id = "e1"
  alarm_description   = "Alert on anomalous request count patterns"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "m1"
    return_data = true
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_lb.main.arn_suffix
      }
    }
  }

  metric_query {
    id          = "e1"
    expression  = "ANOMALY_DETECTOR(m1, 2)"
    return_data = true
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-alb-request-anomaly-alarm"
    }
  )
}

# CloudWatch Log Group Insights - Error Pattern
resource "aws_cloudwatch_log_group" "insights_errors" {
  count             = var.enable_monitoring ? 1 : 0
  name              = "/aws/ecs/insights/${local.namespace}/errors"
  retention_in_days = var.log_retention_days

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-insights-errors"
    }
  )
}
