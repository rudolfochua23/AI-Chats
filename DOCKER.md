# Docker Setup Guide for ChatStash App

## Overview

This guide provides instructions for running the ChatStash application in Docker containers for both development and production environments.

## Prerequisites

- Docker >= 20.10
- Docker Compose >= 1.29

## Quick Start

### Development Environment

1. **Clone/Setup the project:**
   ```bash
   cd /path/to/ChatStash
   ```

2. **Create environment file (optional):**
   ```bash
   cp .env.example .env
   ```

3. **Start the development environment:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Open your browser to `http://localhost:4173`

The development environment includes:
- Live volume mounting for code changes
- Full development dependencies
- Hot reload capabilities
- Debug logging enabled

### Production Environment

1. **Create environment file (optional):**
   ```bash
   cp .env.example .env
   ```

2. **Build the production image:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

3. **Start the production environment:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Access the application:**
   - Open your browser to `http://localhost:3000`

The production environment includes:
- Optimized multi-stage build
- Non-root user for security
- Read-only root filesystem
- Health checks
- Automatic restart on failure
- Resource limits and monitoring

## Docker Architecture

### Multi-Stage Build

The `Dockerfile` uses a three-stage build process:

1. **Builder Stage**
   - Node 18 Alpine base image
   - Installs dependencies
   - Runs the build script to generate `app/data/conversations.json`
   - Outputs optimized app artifacts

2. **Development Stage**
   - Node 18 Alpine base image
   - Includes all development dependencies
   - Full source code for live editing
   - Exposes port 4173
   - Runs `npm start` which starts the Node auth server on port 4173

3. **Production Stage**
   - Node 18 Alpine base image (minimal footprint)
   - Only production dependencies
   - Non-root `nodejs` user for security
   - Read-only root filesystem with tmpfs for temporary files
   - Runs `serve` on port 3000
   - Includes health checks
   - Resource limits and logging configuration

## Docker Compose Files

### Development Configuration (`docker-compose.yml`)

```yaml
Services:
- app: Development container with live volume mounts
   - Port: 4173 (configurable via DEV_PORT)
  - Volumes: Project directory (excluding node_modules and logs)
  - Environment: NODE_ENV=development, DEBUG=*
  - Health checks every 30 seconds
  - Resource limits: 2 CPUs, 1GB memory
```

### Production Configuration (`docker-compose.prod.yml`)

```yaml
Services:
- app: Production container with security hardening
  - Port: 3000 (configurable via PROD_PORT)
  - Security: no-new-privileges, read-only filesystem
  - Temporary filesystem for application cache
  - Health checks every 30 seconds
  - Automatic restart on failure
  - Resource limits: 2 CPUs, 2GB memory
  - Logging: JSON driver with rotation (10MB, 3 files)
```

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Development port (default: 4173)
DEV_PORT=4173

# Development/test default compose file (local/devcontainer)
COMPOSE_FILE=docker-compose.yml

# Production port (default: 3000)
PROD_PORT=3000

# Node environment
NODE_ENV=development

# Debug mode
DEBUG=*

# Application settings
APP_NAME=ChatStash
APP_VERSION=1.0.0
```

## Common Commands

### Development

```bash
# Start development environment
docker-compose up

# Start in background
docker-compose up -d

# Stop the environment
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild images
docker-compose up --build

# Run a command inside container
docker-compose exec app npm run build

# Remove containers and volumes
docker-compose down -v
```

### Production

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Stop the environment
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Rebuild image
docker-compose -f docker-compose.prod.yml build --no-cache

# Check health status
docker-compose -f docker-compose.prod.yml ps
```

## Komodo Deployment (Production Auto-Trigger)

Use the dedicated compose file so every Komodo deployment starts the production environment automatically.

1. In Komodo, create a new Stack for this repository.
2. Set Compose File to `docker-compose.komodo.yml`.
3. Keep branch as `main` (or your chosen release branch).
4. Set the production domain to `chatstash.powerbyte.app` in your reverse proxy / ingress route to this stack.
5. In Komodo stack environment variables, set:
   - `SESSION_SECRET` to a strong random value (required)
   - `PROD_PORT` if you need a custom external port (default is `3000`)
6. Enable auto-deploy on push in Komodo.

Result:
- On each deployment trigger, Komodo builds `Dockerfile` using `target: production`.
- Container runs with `NODE_ENV=production` automatically.
- No development profile is used in Komodo deployments.
- Session cookie security is enforced for `chatstash.powerbyte.app`.

### Image Management

```bash
# Build images manually
docker build --target development -t chatstash:dev .
docker build --target production -t chatstash:prod .

# List images
docker images | grep chatstash

# Remove image
docker rmi chatstash:dev
docker rmi chatstash:prod

# View image details
docker inspect chatstash:prod
```

## Volumes and Data Persistence

### Development
- **Live Code Mounting**: The entire project directory is mounted to `/app`, allowing real-time code changes
- **Node Modules**: `/app/node_modules` is isolated to prevent conflicts
- **Logs**: Conversation logs are preserved on the host

### Production
- **No persistent volumes**: Data is built into the image at build time
- **Temporary Storage**: `/tmp` and `/var/cache` are tmpfs mounts for transient data
- **Build Output**: The built `app/` directory is copied into the image

## Health Checks

Both development and production containers include health checks that:
- Run every 30 seconds
- Timeout after 10 seconds
- Require 3 consecutive failures to mark as unhealthy
- Have a 10-second startup period before first check

## Security Considerations

### Development
- Full access for development convenience
- Debug mode enabled
- All dependencies available

### Production
- **Read-Only Filesystem**: Root filesystem is read-only
- **Non-Root User**: Application runs as `nodejs` (UID 1001)
- **No Privilege Escalation**: `no-new-privileges` security option enabled
- **Temporary Storage**: tmpfs mounts for necessary write operations
- **Resource Limits**: CPU and memory constraints prevent resource exhaustion
- **Restart Policy**: `always` ensures automatic recovery

## Troubleshooting

### Port Already in Use

If port 4173 (dev) or 3000 (prod) is already in use:

```bash
# Change the port in .env
DEV_PORT=53174
PROD_PORT=3001

# Or specify on command line
docker-compose up -e DEV_PORT=53174
```

### Container exits immediately

Check logs:
```bash
docker-compose logs app
```

### Cannot connect to `localhost:4173`

- Verify container is running: `docker-compose ps`
- Check if port is exposed: `docker-compose port app 4173`
- Verify network connectivity: `docker-compose exec app wget -O- http://localhost:4173`

### Permission denied errors

Ensure Docker daemon is running and user has access:
```bash
docker ps  # Should list containers without sudo
```

### Build failures

Clear Docker cache and rebuild:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Performance Tips

1. **Use .dockerignore**: Reduces build context size
2. **Multi-Stage Build**: Reduces final image size
3. **Alpine Linux**: Smaller base images (~5MB vs 350MB+ for full Node)
4. **Layer Caching**: Dockerfile is optimized for cache efficiency

## Image Sizes

Approximate image sizes:
- Development image: 400-500 MB
- Production image: 350-400 MB

## Networking

Both configurations use a Docker network named `chatstash-network`:
- Containers can communicate with each other using service names
- Network is isolated by default
- External access through exposed ports

## Scaling in Production

For production deployment with multiple instances:

```bash
# Scale the service (requires load balancer)
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# With Kubernetes
kubectl create deployment chatstash --image=chatstash:prod
kubectl scale deployment chatstash --replicas=3
kubectl expose deployment chatstash --port=3000 --type=LoadBalancer
```

## CI/CD Integration

### Building and pushing to registry

```bash
# Build with tag
docker build --target production -t your-registry/chatstash:latest .
docker build --target production -t your-registry/chatstash:1.0.0 .

# Push to registry
docker push your-registry/chatstash:latest
docker push your-registry/chatstash:1.0.0
```

### Using in CI/CD pipelines

See `.github/workflows/`, `.gitlab-ci.yml`, or similar for specific CI/CD platform.

## Updating and Rebuilding

### Update dependencies

```bash
# In development environment
docker-compose exec app npm install [package-name]

# Or rebuild with fresh dependencies
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Rebuild after code changes

Development automatically detects changes via volume mounting.

For production, rebuild after changes:
```bash
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring and Logging

### View container logs

```bash
# Follow logs
docker-compose logs -f app

# Last 50 lines
docker-compose logs --tail=50 app

# Timestamps
docker-compose logs --timestamps app
```

### Monitor container stats

```bash
# Real-time stats
docker stats chatstash-dev

# For production
docker stats chatstash-prod
```

### Inspect container

```bash
# Get container details
docker inspect chatstash-dev

# Get container processes
docker top chatstash-dev

# Get container logs
docker logs chatstash-dev
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Alpine Linux](https://alpinelinux.org/)

## Support and Issues

For issues with Docker setup:
1. Check Docker and Docker Compose versions
2. Review logs: `docker-compose logs app`
3. Verify all required files exist (Dockerfile, docker-compose.yml, etc.)
4. Check .dockerignore doesn't exclude necessary files
5. Ensure ports are not already in use

## License

Same as the main application

---

Last Updated: 2026-03-22
