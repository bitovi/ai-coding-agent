resource "aws_iam_role" "tdf_execution_role" {
  name = "ecsTaskExecutionRoleAiCodingAgent"

  assume_role_policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
  })

  inline_policy {
    name = "ecsTaskExecutionRoleAiCodingAgentInlinePolicy"

    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Action   = ["ecr:GetAuthorizationToken"]
          Effect   = "Allow"
          Resource = "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage"
            ],
            "Resource": "arn:aws:ecr:us-east-1:755521597925:repository/playground/ai-coding-agent"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:us-east-1:755521597925:log-group:/ecs/ai-coding-agent*"
        }
      ]
    })
  }

  tags = {
    CreatedBy = "Phil",
    CreatedFor = "AI Coding Agent",
    ManagedBy = "terraform"
  }
}