# villao frontend — build Vite app, serve with nginx. Static, no runtime env needed
# (VITE_AGENT_ENDPOINT is baked at build time via ARG).
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_AGENT_ENDPOINT=https://villao-gateway.miha.run/api/agent/chat
ENV VITE_AGENT_ENDPOINT=$VITE_AGENT_ENDPOINT
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
