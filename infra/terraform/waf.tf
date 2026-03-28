# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  count   = var.enable_waf ? 1 : 0
  name    = "${local.namespace}-waf"
  scope   = "REGIONAL"
  default_action {
    allow {}
  }

  # Rate limiting rule (2000 requests per 5 minutes per IP)
  rule {
    name     = "RateLimitRule"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "NONE"
            }
            positional_constraint = "STARTS_WITH"
            search_string         = "/mcp"
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-rate-limit-rule"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        excluded_rule {
          name = "SizeRestrictions_BODY"
        }

        rule_action_override {
          name = "GenericRFI_BODY"
          action_to_use {
            block {}
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-common-rule-set"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - SQL Injection Protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 4
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-sql-injection"
      sampled_requests_enabled   = true
    }
  }

  # Custom rule - Block requests to non-/mcp paths
  rule {
    name     = "AllowMCPPathsOnly"
    priority = 5
    action {
      block {}
    }
    statement {
      not_statement {
        statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
            search_string         = "/mcp"
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-allow-mcp-paths"
      sampled_requests_enabled   = true
    }
  }

  # Custom rule - Require Content-Type for POST/PUT
  rule {
    name     = "RequireContentTypeForMutations"
    priority = 6
    action {
      block {}
    }
    statement {
      and_statement {
        statement {
          byte_match_statement {
            field_to_match {
              method {}
            }
            text_transformation {
              priority = 0
              type     = "UPPERCASE"
            }
            positional_constraint = "EXACTLY"
            search_string         = "POST"
          }
        }
        statement {
          not_statement {
            statement {
              byte_match_statement {
                field_to_match {
                  single_header {
                    name = "content-type"
                  }
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
                positional_constraint = "STARTS_WITH"
                search_string         = "application/json"
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.namespace}-require-content-type"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.namespace}-waf-metrics"
    sampled_requests_enabled   = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-waf"
    }
  )
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  count    = var.enable_waf ? 1 : 0
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}

# CloudWatch Log Group for WAF
resource "aws_cloudwatch_log_group" "waf_logs" {
  count             = var.enable_waf ? 1 : 0
  name              = "/aws/waf/${local.namespace}"
  retention_in_days = var.log_retention_days

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-waf-logs"
    }
  )
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count                   = var.enable_waf ? 1 : 0
  resource_arn            = aws_wafv2_web_acl.main[0].arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs[0].arn]

  logging_filter {
    default_behavior = "KEEP"

    filter {
      behavior = "KEEP"

      condition {
        action_condition {
          action = "BLOCK"
        }
      }

      requirement = "MEETS_ANY"
    }
  }
}

# CloudWatch Alarm - WAF Blocked Requests
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  count               = var.enable_waf && var.cloudwatch_alarms_enabled ? 1 : 0
  alarm_name          = "${local.namespace}-waf-blocked-requests"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "Alert when WAF blocks more than 50 requests in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Rule   = "ALL"
    WebACL = aws_wafv2_web_acl.main[0].name
  }

  alarm_actions = local.alarm_topic_arn != "" ? [local.alarm_topic_arn] : []

  tags = merge(
    local.common_tags,
    {
      Name = "${local.namespace}-waf-blocked-alarm"
    }
  )
}
