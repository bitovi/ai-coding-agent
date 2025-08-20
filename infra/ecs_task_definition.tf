resource "aws_cloudwatch_log_group" "ecs_logs" {
  name = "/ecs/ai-coding-agent"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "ai_coding_agent_td" {
  family = "ai-coding-agent-tdf"
  requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"
  cpu       = 1024
  memory    = 2048
  execution_role_arn = aws_iam_role.tdf_execution_role.arn
  
  container_definitions = jsonencode([
    {
      name      = "ai-coding-agent"
      image     = "755521597925.dkr.ecr.us-east-1.amazonaws.com/playground/ai-coding-agent:latest"
      cpu       = 1024
      memory    = 2048
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_logs.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "ai-coding-agent"
        }
      }
    },
  ])
}