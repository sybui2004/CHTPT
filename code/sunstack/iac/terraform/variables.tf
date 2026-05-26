// Variables to use accross the project
// which can be accessed by var.project_id
variable "project_id" {
  description = "The project ID to host the cluster in"
  type        = string  
  default     = "shopbee-485000"
}

variable "region" {
  description = "The region the cluster in"
  type        = string
  default     = "asia-southeast1"
}

variable "zone" {
  description = "The zone where the BTL VMs run"
  type        = string
  default     = "asia-southeast1-b"
}

variable "btl_instance_names" {
  description = "Existing BTL VM names to put behind the HTTP load balancer"
  type        = list(string)
  default     = ["btl-app-vm-1", "btl-app-vm-2"]
}
