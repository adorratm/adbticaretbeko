# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/order ./services/backend/order
WORKDIR /src/services/backend/order
RUN go mod download && CGO_ENABLED=0 go build -o /out/order ./cmd/order

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/order /usr/local/bin/order
EXPOSE 8089
ENTRYPOINT ["/usr/local/bin/order"]
