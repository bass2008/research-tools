output "bucket_name" {
  description = "Bucket that holds the assets."
  value       = module.site.bucket_name
}

output "website_endpoint" {
  description = "Object Storage website endpoint. Plain HTTP unless the bucket owns the domain."
  value       = module.site.website_endpoint
}

output "asset_base_url" {
  description = "HTTPS prefix of the bucket. This is what next.config assetPrefix would point at."
  value       = module.site.asset_base_url
}

output "site_url" {
  description = "Where the bucket content is reachable. The site itself lives on the VM — see ../server output site_url."
  value       = module.site.site_url
}

output "dns_record" {
  description = "Record this root added to the shared zone. Empty in the node layout."
  value       = module.site.dns_record
}

output "certificate_status_command" {
  description = "Poll the certificate; apply with enable_https=true once it is ISSUED. Empty when the certificate is off."
  value       = module.site.certificate_status_command
}

output "cdn_resource_id" {
  description = "CDN resource ID, empty when the CDN is off."
  value       = module.site.cdn_resource_id
}

output "deploy_access_key" {
  description = "Static access key used by ./deploy.sh."
  value       = module.site.deploy_access_key
  sensitive   = true
}

output "deploy_secret_key" {
  description = "Static secret key used by ./deploy.sh."
  value       = module.site.deploy_secret_key
  sensitive   = true
}
