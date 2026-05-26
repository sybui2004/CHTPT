data "google_compute_instance" "btl_apps" {
  for_each = toset(var.btl_instance_names)

  name = each.value
  zone = var.zone
}

resource "google_compute_instance_group" "btl_app_group" {
  name = "btl-app-instance-group"
  zone = var.zone

  instances = [
    for instance in data.google_compute_instance.btl_apps : instance.self_link
  ]

  named_port {
    name = "http"
    port = 80
  }
}

resource "google_compute_health_check" "btl_http" {
  name = "btl-http-health-check"

  http_health_check {
    port         = 80
    request_path = "/"
  }
}

resource "google_compute_backend_service" "btl_backend" {
  name                    = "btl-http-backend"
  protocol                = "HTTP"
  port_name               = "http"
  load_balancing_scheme   = "EXTERNAL_MANAGED"
  timeout_sec             = 30
  session_affinity        = "GENERATED_COOKIE"
  affinity_cookie_ttl_sec = 3600
  health_checks           = [google_compute_health_check.btl_http.self_link]

  backend {
    group           = google_compute_instance_group.btl_app_group.self_link
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }
}

resource "google_compute_url_map" "btl_url_map" {
  name            = "btl-http-url-map"
  default_service = google_compute_backend_service.btl_backend.self_link
}

resource "google_compute_target_http_proxy" "btl_http_proxy" {
  name    = "btl-http-proxy"
  url_map = google_compute_url_map.btl_url_map.self_link
}

resource "google_compute_managed_ssl_certificate" "btl_https_cert" {
  name = "btl-managed-ssl-cert"

  managed {
    domains = var.btl_domain_names
  }
}

resource "google_compute_target_https_proxy" "btl_https_proxy" {
  name             = "btl-https-proxy"
  url_map          = google_compute_url_map.btl_url_map.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.btl_https_cert.self_link]
}

resource "google_compute_global_address" "btl_lb_ip" {
  name = "btl-http-lb-ip"
}

resource "google_compute_global_forwarding_rule" "btl_http" {
  name                  = "btl-http-forwarding-rule"
  ip_address            = google_compute_global_address.btl_lb_ip.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.btl_http_proxy.self_link
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_global_forwarding_rule" "btl_https" {
  name                  = "btl-https-forwarding-rule"
  ip_address            = google_compute_global_address.btl_lb_ip.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.btl_https_proxy.self_link
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

resource "google_compute_firewall" "allow_lb_to_btl_http" {
  name    = "allow-gcp-lb-to-btl-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22"
  ]
}

output "btl_load_balancer_ip" {
  description = "Point your domain A record to this IP"
  value       = google_compute_global_address.btl_lb_ip.address
}

output "btl_managed_certificate_name" {
  description = "Google-managed SSL certificate name for the HTTPS load balancer"
  value       = google_compute_managed_ssl_certificate.btl_https_cert.name
}
