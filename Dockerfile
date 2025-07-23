FROM oven/bun AS build
WORKDIR /app
# Cache packages installation
COPY package.json package.json
COPY bun.lock bun.lock
RUN bun install
COPY ./src ./src
COPY tsconfig.json tsconfig.json
ENV NODE_ENV=production
RUN bun build \
	--compile \
	--minify \
	--target bun \
	--tsconfig-override tsconfig.json \
	--outfile server \
	./src/index.ts
FROM gcr.io/distroless/base
WORKDIR /app
COPY --from=build /app/server server
ENV NODE_ENV=production
CMD ["./server"]
EXPOSE 3000
