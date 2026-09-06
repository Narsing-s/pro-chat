FROM node:22-alpine AS build
WORKDIR /repo
COPY package*.json ./
COPY apps/server/package*.json apps/server/
RUN npm install
COPY apps/server apps/server
WORKDIR /repo/apps/server
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/app/data/pro-chat.json
COPY --from=build /repo/apps/server/package*.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node","dist/index.js"]
