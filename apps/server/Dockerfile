FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY ../../package*.json ../../
RUN npm install
COPY . ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/app/data/pro-chat.json
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node","dist/index.js"]
