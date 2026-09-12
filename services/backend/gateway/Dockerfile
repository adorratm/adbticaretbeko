# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/gateway ./services/backend/gateway
WORKDIR /src/services/backend/gateway
RUN go mod download && CGO_ENABLED=0 go build -o /out/gateway ./cmd/gateway

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/gateway /usr/local/bin/gateway
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/gateway"]
