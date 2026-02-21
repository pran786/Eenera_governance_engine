FROM nginx:alpine

# Remove default files
RUN rm -rf /usr/share/nginx/html/*

# Copy React build from frontend
COPY --from=frontend-build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]