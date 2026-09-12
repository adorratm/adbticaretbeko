# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/gateway ./services/backend/gateway
WORKDIR /src/services/backend/gateway
RUN go mod download && CGO_ENABLED=0 go build -o /out/gateway ./cmd/gateway

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget
COPY --from=build /out/gateway /usr/local/bin/gateway
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/gateway"]
