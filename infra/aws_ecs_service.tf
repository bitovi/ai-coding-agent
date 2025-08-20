// Get default VPC
// Get subnets in default VPC
// Get default SG

data "aws_vpc" "default_vpc" {
    default = true
}

data "aws_subnets" "default_subnets" {
    filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default_vpc.id]
    }
}

data "aws_security_group" "default_security_group" {
    vpc_id = data.aws_vpc.default_vpc.id
    name   = "default"
}

resource "aws_ecs_service" "ai_coding_agent_service" {
  name            = "ai-coding-agent-service"
  cluster         = "arn:aws:ecs:us-east-1:755521597925:cluster/Bitovi-Playground-ECS-Cluster"
  task_definition = aws_ecs_task_definition.ai_coding_agent_td.arn
  desired_count   = 1
  network_configuration {
    subnets = data.aws_subnets.default_subnets.ids
    security_groups = [data.aws_security_group.default_security_group.id]
  }
}