FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM alpine:3.19
COPY --from=build /app/dist /app/dist
# This container just holds the built files for the nginx volume
CMD ["sh", "-c", "cp -r /app/dist/* /var/www/html/ 2>/dev/null; sleep infinity"]
