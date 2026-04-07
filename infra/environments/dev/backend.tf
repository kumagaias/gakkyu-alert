terraform {
  backend "s3" {
    bucket       = "gakkyu-alert-dev-tfstate"
    key          = "dev/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }
}
