resource "aws_security_group" "efs_service_sg" {
  name        = "${var.app_name}-efs-sg-${var.target_environment}"
  description = "EFS Security Group"
  vpc_id      = data.aws_vpc.default_vpc.id

  ingress {
    description     = "NFS"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}


# EFS File System
resource "aws_efs_file_system" "efs_file_system" {
  creation_token = "${var.app_name}-${var.target_environment}-EFS"
  tags = {
    Name = "${var.app_name}-${var.target_environment}-EFS"
  }
}

# EFS Mount Target
resource "aws_efs_mount_target" "efs_mount_target" {
  for_each       = toset(data.aws_subnets.default_subnets.ids)
  file_system_id = aws_efs_file_system.efs_file_system.id
  subnet_id      = each.value
  security_groups = [aws_security_group.efs_service_sg.id]
}
