FROM mysql:8.0

# Copy database schema and seed SQL scripts to entrypoint
COPY init/ /docker-entrypoint-initdb.d/
