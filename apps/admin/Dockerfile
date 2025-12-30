FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (only what's needed for admin)
RUN npm install

# Copy source
COPY . .

# Build shared package first
RUN npx turbo run build --filter=@sauci/shared

# Build admin app with env vars
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_OPENAI_API_KEY
ARG VITE_OPENROUTER_API_KEY
ARG VITE_AI_MODEL
ARG VITE_AI_MODEL_GENERATE
ARG VITE_AI_MODEL_FIX
ARG VITE_AI_MODEL_POLISH

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
ENV VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY
ENV VITE_AI_MODEL=$VITE_AI_MODEL
ENV VITE_AI_MODEL_GENERATE=$VITE_AI_MODEL_GENERATE
ENV VITE_AI_MODEL_FIX=$VITE_AI_MODEL_FIX
ENV VITE_AI_MODEL_POLISH=$VITE_AI_MODEL_POLISH

RUN npx turbo run build --filter=@sauci/admin

FROM nginx:alpine
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
