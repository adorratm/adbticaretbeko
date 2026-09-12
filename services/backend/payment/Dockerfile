# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/payment ./services/backend/payment
WORKDIR /src/services/backend/payment
RUN go mod download && CGO_ENABLED=0 go build -o /out/payment ./cmd/payment

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/payment /usr/local/bin/payment
EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/payment"]
