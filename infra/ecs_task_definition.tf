data "aws_cloudwatch_log_group" "log_group" {
  name = var.log_group_name
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
      name      = "${var.app_name}-${var.target_environment}"
      image     = "${var.image_url}:${var.image_tag}"
      cpu       = var.cpu_request
      memory    = var.mem_request
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
          "awslogs-group"         = data.aws_cloudwatch_log_group.log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = var.target_environment
        }
      },
      "environmentFiles": [
        {
          "value": var.env_file_arn,
          "type": "s3"
        }
      ],
    },
  ])
}