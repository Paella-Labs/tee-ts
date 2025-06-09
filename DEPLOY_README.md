# 🚀 Deployment Guide for TEE Service

This guide provides detailed instructions for deploying the TEE Service to Phala Network with Cloudflare integration.

## 📋 Prerequisites

- Docker account
- Phala CLI installed (`phala auth login` completed)
- Cloudflare account with access to your domain's DNS settings
- SSL certificates from Cloudflare (Origin certificates)

## ⚙️ Environment Variables

Configure these environment variables before deployment:

```
# Server configuration
PORT=3000

# Security
ACCESS_SECRET=your_access_secret_here

# Services
SENDGRID_API_KEY=your_sendgrid_api_key_here

# SSL Configuration (base64-encoded Cloudflare Origin certificates)
SSL_CERTIFICATE=your_base64_encoded_certificate
SSL_CERTIFICATE_KEY=your_base64_encoded_private_key
```

### 🔒 SSL Certificates
The `SSL_CERTIFICATE` and `SSL_CERTIFICATE_KEY` should be base64-encoded Cloudflare Origin certificates. These enable secure TLS connections between Cloudflare and your Phala deployment.

To generate base64-encoded certificates:
```bash
cat your_certificate.pem | base64 -w 0 > cert_base64.txt
cat your_private_key.pem | base64 -w 0 > key_base64.txt
```

Then copy the contents of these files to your environment variables.

## 🔄 Deployment Process

### Step 1: Deploy to Phala using CLI Script

The repository includes a CLI script for deploying to Phala:

```bash
# Make the script executable if needed
chmod +x cli.sh

# Deploy to Phala
./cli.sh deploy
```

#### Customizing Deployment

You can customize your deployment with these options:

```bash
./cli.sh deploy --vcpu 2 --memory 1024 --disk-size 4 --name "my-tee-project" --docker-image "your-username/tee-ts:latest"
```

⚠️ **Important**: Make sure to update the Docker image tag to match your Docker username (e.g., `your-username/tee-ts:latest`).

### Step 2: Cloudflare Configuration

After deploying to Phala, configure Cloudflare to route traffic to your Phala deployment:

#### 2.1 CNAME Record Setup (Recommended)

1. Log in to your Cloudflare account
2. Navigate to the DNS settings for your domain
3. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: Your subdomain (e.g., `app`)
   - **Target**: Your Phala TDX hostname
   - **TTL**: Auto
   - **Proxy status**: Proxied (Orange Cloud)

#### 2.2 Phala-Specific TXT Record

This record is crucial for Phala's tproxy to route TLS connections properly:

1. Add a TXT record:
   - **Type**: TXT
   - **Name**: `_dstack-app-address.<subdomain>` (e.g., `_tapp-address.staging-tee.crossmint.com`)
   - **Content**: `<Your_Phala_CVM_App_ID>:443` (e.g., `3327603e03f5bd1f830812ca4a789277fc31f577:443`)
   - **TTL**: Auto (or 5 minutes during testing)

The `<Your_Phala_CVM_App_ID>` can be found in the output of your deployment command.

#### 2.3 SSL/TLS Configuration

1. In Cloudflare, go to SSL/TLS settings
2. Set SSL/TLS encryption mode to "Full (strict)"
3. This ensures traffic is encrypted between:
   - Users and Cloudflare
   - Cloudflare and your Phala deployment (using your Origin certificates)

## 🔍 Verification

After deployment and configuration:

1. Wait for DNS propagation (can take up to 48 hours, though often much faster)
2. Visit your domain to verify the service is working
3. Test API endpoints as described in the main README

## 🛠️ Troubleshooting

- **Certificate Issues**: Ensure certificates are properly encoded and added to environment variables
- **Connection Errors**: Verify TXT record format matches `<Your_Phala_CVM_App_ID>:443`
- **Deployment Failures**: Check Phala deployment logs with `phala status`

## 🔄 Updates and Redeployment

To update your deployed application:

1. Make and commit your changes
2. Build and push a new Docker image
3. Redeploy using the CLI script:

```bash
./cli.sh deploy --skip-build  # If you've manually built and pushed the image
# OR
./cli.sh deploy  # To rebuild and redeploy
```

## ⏹️ Undeploying

To remove your deployment from Phala:

```bash
./cli.sh undeploy --name "my-tee-project"
``` 