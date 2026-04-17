FROM node:20-alpine AS web-build
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile
COPY packages/core ./packages/core
COPY packages/web ./packages/web
RUN pnpm --filter @codelens-ai/core build
RUN VITE_TARGET=web pnpm --filter web build

FROM python:3.12-slim
WORKDIR /app
COPY packages/server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY packages/server .
COPY --from=web-build /app/packages/web/dist ./dist
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
