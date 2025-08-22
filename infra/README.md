# AI-Coding-Agent Infrastructure
The Ai-Coding-Agent infrastructure is managed by Terraform, deployed to AWS and uses the AWS ECS service.

## Deployments to new organization / accounts

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



## SSHing into containers

All the values can be found in the ECS console for the specific deployment. At the moment, only staging deployments are open to SSH access.

```bash
aws ecs execute-command \
        --cluster <cluster name> \
        --task <task id> \
        --container <container name> \
        --command "/bin/bash" \
        --interactive
```

## Local management and testing

```bash
terraform init -backend-config="key=terraform/staging.tfstate"

terraform apply \
  -var-file=var_files/ai.tfvars.safe \
  -var "image_tag=staging" \
  -var "domain_name=bit-staging" \
  -var "target_environment=staging" \
  -var "enable_execute_command=true"

echo "SMOKE TESTING 1"
echo "-----------------"
cluster=$(terraform output -raw ecs_cluster_name)
service=$(terraform output -raw ecs_service_name)
aws ecs wait services-stable --cluster "$cluster" --services "$service"

echo "SMOKE TESTING 2"
echo "-----------------"
cluster=$(terraform output -raw ecs_cluster_name)
service=$(terraform output -raw ecs_service_name)
read -r rollout td <<< "$(aws ecs describe-services \
--cluster "$cluster" --services "$service" \
--query "services[0].deployments[?status=='PRIMARY']|[0].[rolloutState,taskDefinition]" \
--output text)"
echo "PRIMARY rolloutState: $rollout"
test "$rollout" = "COMPLETED"

echo "SMOKE TESTING 3"
echo "-----------------"
tg=$(terraform output -raw target_group_arn)
deadline=$((SECONDS+600))
while :; do
states=$(aws elbv2 describe-target-health --target-group-arn "$tg"  \
--query "TargetHealthDescriptions[].TargetHealth.State" --output text || true)
echo "Target states: $states"
if [ -n "$states" ] && ! grep -qv healthy <<< "$states"; then
echo "All targets healthy"; break
fi
[ $SECONDS -gt $deadline ] && echo "Timed out waiting for healthy targets" && exit 1
sleep 5
done

echo "SMOKE TESTING 4"
echo "-----------------"
url=$(terraform output -raw alb_dns_name)
curl -fsS --retry 30 --retry-connrefused --retry-delay 2 "http://$url/healthz" -o /dev/null
```