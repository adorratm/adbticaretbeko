# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/auth ./services/backend/auth
WORKDIR /src/services/backend/auth
RUN go mod download && CGO_ENABLED=0 go build -o /out/auth ./cmd/auth

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/auth /usr/local/bin/auth
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/auth"]
