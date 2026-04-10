terraform {
  backend "s3" {
    bucket       = "gakkyu-alert-prd-tfstate"
    key          = "prd/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }
}
