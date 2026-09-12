# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/cms ./services/backend/cms
WORKDIR /src/services/backend/cms
RUN go mod download && CGO_ENABLED=0 go build -o /out/cms ./cmd/cms

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=build /out/cms /usr/local/bin/cms
EXPOSE 8100
ENTRYPOINT ["/usr/local/bin/cms"]
