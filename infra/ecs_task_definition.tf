data "aws_cloudwatch_log_group" "log_group" {
  name = var.log_group_name
}

resource "aws_ecs_task_definition" "ai_coding_agent_td" {
  family = "ai-coding-agent-tdf"
  requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"
  cpu       = var.cpu_request
  memory    = var.mem_request
  execution_role_arn = aws_iam_role.tdf_execution_role.arn
  task_role_arn = aws_iam_role.tdf_task_role.arn

  volume {
    name = "${var.app_name}-${var.target_environment}-efs-volume"
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.efs_file_system.id
    }
  }
  
  container_definitions = jsonencode([
    {
      name      = "${var.app_name}-${var.target_environment}"
      image     = "${var.image_url}:${var.image_tag}"
      cpu       = var.cpu_request
      memory    = var.mem_request
      essential = true

      mountPoints = [
        {
          sourceVolume  = "${var.app_name}-${var.target_environment}-efs-volume"
          containerPath = "/tokens"
        }
      ]

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]

      entryPoint = [
        "sh",
        "-c",
        "chown -R appuser:appgroup /tokens && chmod -R 755 /tokens && exec /usr/local/bin/setup-git-credentials.sh npm start"
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = data.aws_cloudwatch_log_group.log_group.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = var.target_environment
        }
      },
      environmentFiles = [
        {
          value: aws_s3_object.env_file.arn,
          type: "s3"
        }
      ],
    },
  ])
}