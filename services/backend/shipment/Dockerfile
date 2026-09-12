# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/shipment ./services/backend/shipment
WORKDIR /src/services/backend/shipment
RUN go mod download && CGO_ENABLED=0 go build -o /out/shipment ./cmd/shipment

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/shipment /usr/local/bin/shipment
EXPOSE 8091
ENTRYPOINT ["/usr/local/bin/shipment"]
