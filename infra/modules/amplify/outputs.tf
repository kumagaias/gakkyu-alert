output "app_id" {
  description = "Amplify app ID"
  value       = aws_amplify_app.this.id
}

output "default_domain" {
  description = "Amplify default domain"
  value       = aws_amplify_app.this.default_domain
}

output "app_url" {
  description = "URL of the deployed branch"
  value       = "https://${var.branch_name}.${aws_amplify_app.this.default_domain}"
}

# --- Custom domain outputs (null when custom_domain is not set) ---

locals {
  domain_assoc = var.custom_domain != null ? one(aws_amplify_domain_association.this) : null

  # DNS record strings have the format: "name CNAME value" (may include trailing dots)
  cert_parts = local.domain_assoc != null ? split(" CNAME ", local.domain_assoc.certificate_verification_dns_record) : null
  sub_parts  = local.domain_assoc != null ? split(" CNAME ", tolist(local.domain_assoc.sub_domain)[0].dns_record) : null
}

output "cert_validation_dns_name" {
  description = "Route53 record name for ACM certificate validation"
  value       = local.cert_parts != null ? trimsuffix(local.cert_parts[0], ".") : null
}

output "cert_validation_dns_value" {
  description = "Route53 record value for ACM certificate validation"
  value       = local.cert_parts != null ? trimsuffix(local.cert_parts[1], ".") : null
}

output "subdomain_cname_name" {
  description = "Route53 CNAME record name for the custom subdomain"
  # When prefix = "" the dns_record has an empty name part (e.g. " CNAME value").
  # In that case fall back to the domain itself.
  value = local.sub_parts != null ? (
    trimsuffix(local.sub_parts[0], ".") == "" ? var.custom_domain : trimsuffix(local.sub_parts[0], ".")
  ) : null
}

output "subdomain_cname_value" {
  description = "Route53 CNAME record value for the custom subdomain"
  value       = local.sub_parts != null ? trimsuffix(local.sub_parts[1], ".") : null
}
