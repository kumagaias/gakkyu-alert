resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.iam_role_arn
  package_type  = "Image"
  image_uri     = var.image_uri
  memory_size   = var.memory_size
  timeout       = var.timeout

  environment {
    variables = var.environment_variables
  }

  # イメージは CI/CD 経由で更新するため Terraform で追跡しない
  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7
}

resource "aws_lambda_permission" "api_gateway" {
  count = var.create_api_gateway_permission ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
