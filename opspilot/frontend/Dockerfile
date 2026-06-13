# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: development — Vite dev server with hot reload
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS development

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder — compile TypeScript and bundle with Vite
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
# Full install — the build needs devDependencies (vite, typescript, plugin-react).
RUN npm ci

# API base URL is baked into the bundle at build time. An empty value makes the
# app issue same-origin relative requests (/api/...), which nginx reverse-proxies
# to the backend (see nginx.conf) — no CORS/CSP issues behind the proxy. Override
# with --build-arg VITE_API_BASE_URL=https://api.example.com for a fixed origin.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: production — serve compiled assets via nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
