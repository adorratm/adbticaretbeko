# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/notification ./services/backend/notification
WORKDIR /src/services/backend/notification
RUN go mod download && CGO_ENABLED=0 go build -o /out/notification ./cmd/notification

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/notification /usr/local/bin/notification
EXPOSE 8092
ENTRYPOINT ["/usr/local/bin/notification"]
