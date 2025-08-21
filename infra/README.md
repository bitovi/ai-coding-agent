# AI-Coding-Agent Infrastructure
The Ai-Coding-Agent infrastructure is managed by Terraform, deployed to AWS and uses the AWS ECS service.

### Deployments to new organization / accounts

**1. Create a new tfvars file**:
```bash
cp infra/var_files/example.tfvars infra/var_files/<environment-name>.tfvars
```

**2. Create the following services**:
1. ECR
2. S3
3. ECS Cluster
    - Create a namespace, recommendation: default
    - Using AWS Fargate
4. Log Group
    - Use the ECS cluster name

**3. Update the tfvars**
**4. Update the providers.tf file with the target bucket**
**5. Upload the .env file to the S3 bucket, update the tfvars with the file arn**
