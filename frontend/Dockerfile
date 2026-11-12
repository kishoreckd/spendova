# Local development image. Vite proxies same-origin API requests to the Compose API service.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p node_modules/.vite node_modules/.vite-temp \
    && chown node:node /app /app/node_modules /app/node_modules/.vite /app/node_modules/.vite-temp
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
