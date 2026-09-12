# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/marketplace ./services/backend/marketplace
WORKDIR /src/services/backend/marketplace
RUN go mod download && CGO_ENABLED=0 go build -o /out/marketplace ./cmd/marketplace

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/marketplace /usr/local/bin/marketplace
EXPOSE 8096
ENTRYPOINT ["/usr/local/bin/marketplace"]
