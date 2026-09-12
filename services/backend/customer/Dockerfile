# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/customer ./services/backend/customer
WORKDIR /src/services/backend/customer
RUN go mod download && CGO_ENABLED=0 go build -o /out/customer ./cmd/customer

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/customer /usr/local/bin/customer
EXPOSE 8082
ENTRYPOINT ["/usr/local/bin/customer"]
