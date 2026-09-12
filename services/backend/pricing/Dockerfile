# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/pricing ./services/backend/pricing
WORKDIR /src/services/backend/pricing
RUN go mod download && CGO_ENABLED=0 go build -o /out/pricing ./cmd/pricing

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/pricing /usr/local/bin/pricing
EXPOSE 8085
ENTRYPOINT ["/usr/local/bin/pricing"]
