# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/search ./services/backend/search
WORKDIR /src/services/backend/search
RUN go mod download && CGO_ENABLED=0 go build -o /out/search ./cmd/search

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/search /usr/local/bin/search
EXPOSE 8093
ENTRYPOINT ["/usr/local/bin/search"]
