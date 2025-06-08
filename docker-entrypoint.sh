#!/bin/sh
set -e

echo "=== TEE Nginx Startup Debug ==="
echo "Timestamp: $(date)"
echo "Environment variables:"
echo "- SSL_CERTIFICATE length: ${#SSL_CERTIFICATE}"
echo "- SSL_CERTIFICATE_KEY length: ${#SSL_CERTIFICATE_KEY}"

# Create directory for SSL certificates
mkdir -p /etc/nginx/ssl

# Write certificates from environment variables
echo "Decoding SSL certificate..."
echo "$SSL_CERTIFICATE" | base64 -d >/etc/nginx/ssl/cert.pem
echo "Decoding SSL private key..."
echo "$SSL_CERTIFICATE_KEY" | base64 -d >/etc/nginx/ssl/key.pem

# Set proper permissions
chmod 600 /etc/nginx/ssl/cert.pem
chmod 600 /etc/nginx/ssl/key.pem

echo "=== Certificate Analysis ==="
echo "Certificate file size: $(wc -c < /etc/nginx/ssl/cert.pem) bytes"
echo "Private key file size: $(wc -c < /etc/nginx/ssl/key.pem) bytes"

echo "Certificate details:"
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout | head -20

echo "Certificate subject:"
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -subject

echo "Certificate issuer:"
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -issuer

echo "Certificate validity:"
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -dates

echo "Certificate SANs (Subject Alternative Names):"
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -text | grep -A 1 "Subject Alternative Name" || echo "No SANs found"

echo "=== Private Key Validation ==="
if openssl rsa -in /etc/nginx/ssl/key.pem -check -noout 2>/dev/null; then
    echo "✅ Private key is valid"
else
    echo "❌ Private key validation failed"
    openssl rsa -in /etc/nginx/ssl/key.pem -check -noout || true
fi

echo "=== Certificate-Key Pair Validation ==="
CERT_MODULUS=$(openssl x509 -noout -modulus -in /etc/nginx/ssl/cert.pem | openssl md5)
KEY_MODULUS=$(openssl rsa -noout -modulus -in /etc/nginx/ssl/key.pem | openssl md5)
if [ "$CERT_MODULUS" = "$KEY_MODULUS" ]; then
    echo "✅ Certificate and private key match"
else
    echo "❌ Certificate and private key do NOT match"
    echo "Cert modulus: $CERT_MODULUS"
    echo "Key modulus: $KEY_MODULUS"
fi

echo "=== Nginx Configuration Test ==="
nginx -t || {
    echo "❌ Nginx configuration test failed"
    exit 1
}
echo "✅ Nginx configuration is valid"

echo "=== Nginx Configuration Details ==="
echo "Nginx version:"
nginx -v

echo "Current nginx.conf server blocks:"
grep -A 5 -B 1 "server {" /etc/nginx/nginx.conf

echo "=== Startup Complete ==="
echo "Starting nginx with daemon off..."

# Execute the main command
exec "$@"
