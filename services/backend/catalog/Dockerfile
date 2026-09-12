# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/catalog ./services/backend/catalog
WORKDIR /src/services/backend/catalog
RUN go mod download && CGO_ENABLED=0 go build -o /out/catalog ./cmd/catalog

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/catalog /usr/local/bin/catalog
EXPOSE 8083
ENTRYPOINT ["/usr/local/bin/catalog"]
