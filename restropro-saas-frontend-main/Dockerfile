# build environment
FROM node:21.7 AS builder

WORKDIR /usr/src/app

# Build arguments with defaults
ARG VITE_BACKEND=/api/v1
ARG VITE_BACKEND_SOCKET_IO=
ARG VITE_BACKEND_IMAGES_BASE_URL=
ARG VITE_FRONTEND_DOMAIN=http://localhost:5173
ARG VITE_STRIPE_PRODUCT_SUBSCRIPTION_KEY=price_1POsjYSCWiCS3BoQN2lnBMTz

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . /usr/src/app

# Write build arguments to .env.production to ensure Vite inlines correct configuration
RUN echo "VITE_BACKEND=${VITE_BACKEND}" > .env.production && \
    echo "VITE_BACKEND_SOCKET_IO=${VITE_BACKEND_SOCKET_IO}" >> .env.production && \
    echo "VITE_BACKEND_IMAGES_BASE_URL=${VITE_BACKEND_IMAGES_BASE_URL}" >> .env.production && \
    echo "VITE_FRONTEND_DOMAIN=${VITE_FRONTEND_DOMAIN}" >> .env.production && \
    echo "VITE_STRIPE_PRODUCT_SUBSCRIPTION_KEY=\"${VITE_STRIPE_PRODUCT_SUBSCRIPTION_KEY}\"" >> .env.production

RUN npm run build

# production environment
FROM nginx:1.25-alpine
RUN rm -rf /etc/nginx/conf.d
RUN mkdir -p /etc/nginx/conf.d
COPY ./default.conf /etc/nginx/conf.d/
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
