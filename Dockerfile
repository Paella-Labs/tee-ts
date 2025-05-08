FROM oven/bun:1 AS BASE

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies with bun
RUN bun install --production

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
ENV PORT=3000
EXPOSE 3000

# Start the application
USER root
CMD ["bun", "start"]
