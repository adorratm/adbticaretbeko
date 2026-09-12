# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/worker ./services/backend/worker
WORKDIR /src/services/backend/worker
RUN go mod download && CGO_ENABLED=0 go build -o /out/worker ./cmd/worker

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/worker /usr/local/bin/worker
EXPOSE 8099
ENTRYPOINT ["/usr/local/bin/worker"]
