FROM nginx:alpine

# Install essential debugging and SSL tools
RUN apk add --no-cache \
    logrotate \
    curl \
    openssl \
    net-tools

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy logrotate configuration
COPY nginx-logrotate.conf /etc/logrotate.d/nginx

# Create log directory with proper permissions
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod 755 /var/log/nginx

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set up logrotate cron job
RUN echo "0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/nginx" >> /var/spool/cron/crontabs/root

# Start nginx and cron
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"] 