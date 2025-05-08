#!/bin/sh
set -e

# Create directory for SSL certificates
mkdir -p /etc/nginx/ssl

# Write certificates from environment variables
echo "$SSL_CERTIFICATE" >/etc/nginx/ssl/cert.pem
echo "$SSL_CERTIFICATE_KEY" >/etc/nginx/ssl/key.pem

# Set proper permissions
chmod 600 /etc/nginx/ssl/cert.pem
chmod 600 /etc/nginx/ssl/key.pem

# Execute the main command
exec "$@"
