FROM node:20.10.0-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/mcp/package.json ./apps/mcp/package.json
RUN --mount=type=cache,target=/root/.npm \
  npm ci --workspace sauci-mcp-server --include-workspace-root=false --ignore-scripts
COPY apps/mcp ./apps/mcp
RUN npm run typecheck --workspace sauci-mcp-server \
  && npm test --workspace sauci-mcp-server
RUN npm run build --workspace sauci-mcp-server
RUN npm prune --omit=dev --workspace sauci-mcp-server --include-workspace-root=false --ignore-scripts

FROM node:20.10.0-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/mcp/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/mcp/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/mcp/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.mjs"]
