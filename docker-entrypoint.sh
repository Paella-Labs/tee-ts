#!/bin/sh
set -e

echo "Setting up SSL certificates..."

# Create directory for SSL certificates
mkdir -p /etc/nginx/ssl

# Write certificates from environment variables
echo "$SSL_CERTIFICATE" | base64 -d >/etc/nginx/ssl/cert.pem
echo "$SSL_CERTIFICATE_KEY" | base64 -d >/etc/nginx/ssl/key.pem

# Set proper permissions
chmod 600 /etc/nginx/ssl/cert.pem
chmod 600 /etc/nginx/ssl/key.pem

# Validate certificates
if ! openssl x509 -in /etc/nginx/ssl/cert.pem -noout -checkend 0 >/dev/null 2>&1; then
    echo "❌ SSL certificate is invalid or expired"
    exit 1
fi

if ! openssl rsa -in /etc/nginx/ssl/key.pem -check -noout >/dev/null 2>&1; then
    echo "❌ SSL private key is invalid"
    exit 1
fi

# Verify certificate and key match
CERT_MODULUS=$(openssl x509 -noout -modulus -in /etc/nginx/ssl/cert.pem | openssl md5)
KEY_MODULUS=$(openssl rsa -noout -modulus -in /etc/nginx/ssl/key.pem | openssl md5)
if [ "$CERT_MODULUS" != "$KEY_MODULUS" ]; then
    echo "❌ Certificate and private key do not match"
    exit 1
fi

# Substitute environment variables in nginx config
echo "Configuring server name: ${SERVER_NAME:-staging-tee.crossmint.com tee.crossmint.com}"
envsubst '${SERVER_NAME}' < /etc/nginx/nginx.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/nginx.conf

# Test nginx configuration
if ! nginx -t >/dev/null 2>&1; then
    echo "❌ Nginx configuration test failed"
    nginx -t
    exit 1
fi

echo "✅ SSL certificates configured successfully"

# Execute the main command
exec "$@"
