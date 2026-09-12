# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/cart ./services/backend/cart
WORKDIR /src/services/backend/cart
RUN go mod download && CGO_ENABLED=0 go build -o /out/cart ./cmd/cart

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/cart /usr/local/bin/cart
EXPOSE 8087
ENTRYPOINT ["/usr/local/bin/cart"]
