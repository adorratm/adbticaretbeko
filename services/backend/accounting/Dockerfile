# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/accounting ./services/backend/accounting
WORKDIR /src/services/backend/accounting
RUN go mod download && CGO_ENABLED=0 go build -o /out/accounting ./cmd/accounting

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/accounting /usr/local/bin/accounting
EXPOSE 8097
ENTRYPOINT ["/usr/local/bin/accounting"]
