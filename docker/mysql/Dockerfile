FROM mysql:8.0

ENV TZ=Asia/Phnom_Penh

# Copy database schema and seed SQL scripts to entrypoint
COPY init/ /docker-entrypoint-initdb.d/
