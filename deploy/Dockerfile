FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json apps/server/
RUN npm install
COPY apps/server apps/server
RUN npm run build -w apps/server
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
