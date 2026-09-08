output "zone_nameservers" {
  description = "Set these at the registrar, otherwise the zone is never asked anything. Do it after the first apply, not before."
  value       = ["ns1.yandexcloud.net", "ns2.yandexcloud.net"]
}

output "zone_id" {
  description = "Cloud DNS zone of the landing domain."
  value       = yandex_dns_zone.parent.id
}

output "bucket_name" {
  description = "Bucket that holds the landing files."
  value       = module.site.bucket_name
}

output "website_endpoint" {
  description = "Object Storage website endpoint. Answers over plain HTTP before the domain is delegated."
  value       = module.site.website_endpoint
}

output "site_url" {
  description = "Where the landing is reachable."
  value       = module.site.site_url
}

output "dns_record" {
  description = "Record this root added to the zone."
  value       = module.site.dns_record
}

output "certificate_status_command" {
  description = "Poll the certificate; re-apply with enable_https=true once it is ISSUED."
  value       = module.site.certificate_status_command
}

output "files_uploaded" {
  description = "How many objects of the landing terraform holds."
  value       = length(aws_s3_object.landing)
}
