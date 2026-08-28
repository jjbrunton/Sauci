FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm \
  npm ci --workspace @sauci/api --include-workspace-root=false --ignore-scripts
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN npm run build --workspace @sauci/api
RUN npm prune --omit=dev --workspace @sauci/api --include-workspace-root=false --ignore-scripts

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3003
WORKDIR /app
RUN mkdir -p /data/media && chown node:node /data/media
COPY --from=build /workspace/node_modules ./node_modules
# npm may place 0.x dependency upgrades in the workspace-local tree. Overlay
# that pruned tree so runtime resolution matches the workspace lockfile.
COPY --from=build /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/drizzle ./drizzle
USER node
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3003/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
