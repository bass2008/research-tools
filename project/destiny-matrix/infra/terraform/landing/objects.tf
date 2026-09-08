locals {
  landing_files = fileset(var.content_dir, "**")

  mime_types = {
    ".css"   = "text/css; charset=utf-8"
    ".html"  = "text/html; charset=utf-8"
    ".ico"   = "image/x-icon"
    ".jpg"   = "image/jpeg"
    ".js"    = "application/javascript; charset=utf-8"
    ".png"   = "image/png"
    ".svg"   = "image/svg+xml"
    ".txt"   = "text/plain; charset=utf-8"
    ".webp"  = "image/webp"
    ".woff2" = "font/woff2"
    ".xml"   = "application/xml; charset=utf-8"
  }

  # Имена картинок и шрифтов стабильные, содержимое — нет: разметку и карту сайта надо
  # перепроверять на каждом запросе, статику держать сутки.
  revalidate = ["index.html", "404.html", "robots.txt", "sitemap.xml"]
}

resource "aws_s3_object" "landing" {
  provider = aws.storage
  for_each = local.landing_files

  bucket = module.site.bucket_name
  key    = each.value
  source = "${var.content_dir}/${each.value}"
  etag   = filemd5("${var.content_dir}/${each.value}")

  content_type = lookup(
    local.mime_types,
    lower(try(regex("\\.[^./]+$", each.value), "")),
    "application/octet-stream"
  )

  cache_control = contains(local.revalidate, each.value) ? "no-cache" : "public, max-age=86400"
}
