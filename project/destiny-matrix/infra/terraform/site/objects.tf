# Optional: hold every asset file in Terraform state instead of syncing it with ./deploy.sh.
# Kept off by default. The trade-offs are in ../README.md §2 — read it before turning this on.
locals {
  # fileset on a missing directory returns an empty set, so a plan before the first build is fine.
  content_files = var.manage_objects ? fileset(var.content_dir, "**") : toset([])

  mime_types = {
    ".avif"        = "image/avif"
    ".css"         = "text/css; charset=utf-8"
    ".gif"         = "image/gif"
    ".html"        = "text/html; charset=utf-8"
    ".ico"         = "image/x-icon"
    ".jpeg"        = "image/jpeg"
    ".jpg"         = "image/jpeg"
    ".js"          = "application/javascript; charset=utf-8"
    ".json"        = "application/json; charset=utf-8"
    ".map"         = "application/json; charset=utf-8"
    ".mjs"         = "application/javascript; charset=utf-8"
    ".png"         = "image/png"
    ".svg"         = "image/svg+xml"
    ".txt"         = "text/plain; charset=utf-8"
    ".webmanifest" = "application/manifest+json"
    ".webp"        = "image/webp"
    ".woff"        = "font/woff"
    ".woff2"       = "font/woff2"
    ".xml"         = "application/xml; charset=utf-8"
  }

  # Everything under _next/static carries a content hash in its name, so it can be cached forever.
  # The rest has stable names and must be revalidated on every request.
  immutable_prefix = "_next/static/"
}

resource "aws_s3_object" "content" {
  provider = aws.storage
  for_each = local.content_files

  bucket = module.site.bucket_name

  # var.content_dir is .next/static, whose files must land under the _next/static prefix the browser
  # asks for. The prefix is part of the key, not of the source path.
  key    = "${var.object_key_prefix}${each.value}"
  source = "${var.content_dir}/${each.value}"
  etag   = filemd5("${var.content_dir}/${each.value}")

  content_type = lookup(
    local.mime_types,
    lower(try(regex("\\.[^./]+$", each.value), "")),
    "application/octet-stream"
  )

  cache_control = startswith("${var.object_key_prefix}${each.value}", local.immutable_prefix) ? "public, max-age=31536000, immutable" : "no-cache"
}
