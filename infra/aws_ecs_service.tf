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
  name            = "${var.app_name}-service"
  cluster         = var.ecs_arn
  task_definition = aws_ecs_task_definition.ai_coding_agent_td.arn
  launch_type     = "FARGATE"
  desired_count   = var.desired_replica_count

  network_configuration {
    subnets         = data.aws_subnets.default_subnets.ids
    security_groups = [aws_security_group.ecs_service_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = var.container_port
  }

  health_check_grace_period_seconds = 60

  depends_on = [aws_lb_listener.http]
}
