# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/checkout ./services/backend/checkout
WORKDIR /src/services/backend/checkout
RUN go mod download && CGO_ENABLED=0 go build -o /out/checkout ./cmd/checkout

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/checkout /usr/local/bin/checkout
EXPOSE 8088
ENTRYPOINT ["/usr/local/bin/checkout"]
