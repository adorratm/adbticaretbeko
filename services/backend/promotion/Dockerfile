# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/promotion ./services/backend/promotion
WORKDIR /src/services/backend/promotion
RUN go mod download && CGO_ENABLED=0 go build -o /out/promotion ./cmd/promotion

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/promotion /usr/local/bin/promotion
EXPOSE 8086
ENTRYPOINT ["/usr/local/bin/promotion"]
