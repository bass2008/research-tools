# Street prices for the Russia region, rubles with VAT, read from the Billing API SKU list
# (STREET_PRICE effective 2026-04-30, re-checked 2026-08-13). How to refresh them: ../README.md §4.
# A missing key here is deliberate: it means the platform and vCPU share do not exist together.
locals {
  price_vcpu_table = {
    "standard-v2/5"   = 0.1897
    "standard-v2/20"  = 0.58
    "standard-v2/50"  = 0.85
    "standard-v2/100" = 1.41
    "standard-v3/20"  = 0.52
    "standard-v3/50"  = 0.75
    "standard-v3/100" = 1.24
  }

  price_ram_table = {
    "standard-v2" = 0.3676
    "standard-v3" = 0.33
  }

  price_disk_table = {
    "network-hdd"               = 0.0048
    "network-ssd"               = 0.0199
    "network-ssd-nonreplicated" = 0.0147
    "network-ssd-io-m3"         = 0.0332
  }

  price_vcpu = local.price_vcpu_table["${var.platform_id}/${var.core_fraction}"]
  price_ram  = local.price_ram_table[var.platform_id]
  price_disk = local.price_disk_table[var.disk_type]
  price_ip   = 0.26352
}
