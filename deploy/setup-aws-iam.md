# AWS IAM Setup for Dynamic Security Group Management

## 1. Create IAM User

1. Go to [AWS Console → IAM → Users](https://console.aws.amazon.com/iam/home#/users)
2. Click "Create user"
3. Name: `github-actions-deploy`
4. ✅ Check "Programmatic access"
5. Click "Next"

## 2. Create Inline Policy

1. Click "Attach policies directly"
2. Click "Create policy"
3. Use JSON tab and paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "UpdateIngress",
            "Effect": "Allow",
            "Action": [
                "ec2:RevokeSecurityGroupIngress",
                "ec2:AuthorizeSecurityGroupIngress"
            ],
            "Resource": "arn:aws:ec2:ap-southeast-1:*:security-group/*"
        },
        {
            "Sid": "DescribeGroups",
            "Effect": "Allow",
            "Action": "ec2:DescribeSecurityGroups",
            "Resource": "*"
        }
    ]
}
```

4. Name: `GitHubActionsSecurityGroupAccess`
5. Click "Create policy"
6. Go back to user creation and attach this policy

## 3. Get Security Group ID

1. Go to [EC2 → Security Groups](https://console.aws.amazon.com/ec2/v2/home#SecurityGroups:)
2. Find your EC2 instance's security group
3. Copy the **Security Group ID** (starts with `sg-`)

## 4. Get AWS Credentials

1. After creating the user, go to "Security credentials" tab
2. Click "Create access key"
3. Choose "Application running outside AWS"
4. Copy the **Access Key ID** and **Secret Access Key**

## 5. Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and add:

- `AWS_ACCESS_KEY_ID`: Your access key ID
- `AWS_SECRET_ACCESS_KEY`: Your secret access key  
- `AWS_SECURITY_GROUP_ID`: Your security group ID (e.g., `sg-1234567890abcdef0`)
- `EC2_HOST`: `3.25.152.237`
- `EC2_USERNAME`: `ubuntu`
- `EC2_SSH_KEY`: Your PEM file content

## 6. Update Region (if needed)

If your EC2 is not in `ap-southeast-1`, update line 19 in the workflow:
```yaml
echo "AWS_DEFAULT_REGION=your-region" >> $GITHUB_ENV
```

Common regions:
- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)  
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)
- `ap-southeast-2` (Sydney)
