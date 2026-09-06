FROM node:22-alpine AS build
WORKDIR /repo
COPY package*.json ./
COPY apps/web/package*.json apps/web/
RUN npm install
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN npm run build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
