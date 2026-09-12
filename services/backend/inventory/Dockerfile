# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/inventory ./services/backend/inventory
WORKDIR /src/services/backend/inventory
RUN go mod download && CGO_ENABLED=0 go build -o /out/inventory ./cmd/inventory

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/inventory /usr/local/bin/inventory
EXPOSE 8084
ENTRYPOINT ["/usr/local/bin/inventory"]
