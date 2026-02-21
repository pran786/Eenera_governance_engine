# Build environment
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json and yarn.lock (if available)
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile || yarn install

# Copy the source code
COPY . .

# Set environment variable for build
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Build the application
RUN yarn build

# Production environment
FROM nginx:alpine

# # Copy custom Nginx configuration
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets to nginx
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
