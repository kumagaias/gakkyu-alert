resource "aws_cloudwatch_event_rule" "schedule" {
  name                = var.rule_name
  description         = var.description
  schedule_expression = var.schedule_expression
  state               = var.is_enabled ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "${var.rule_name}-target"
  arn       = var.target_lambda_arn

  retry_policy {
    maximum_retry_attempts       = 2
    maximum_event_age_in_seconds = 3600
  }
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridge-${var.rule_name}"
  action        = "lambda:InvokeFunction"
  function_name = var.target_lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}
