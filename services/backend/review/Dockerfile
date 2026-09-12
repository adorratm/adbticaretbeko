# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/review ./services/backend/review
WORKDIR /src/services/backend/review
RUN go mod download && CGO_ENABLED=0 go build -o /out/review ./cmd/review

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/review /usr/local/bin/review
EXPOSE 8094
ENTRYPOINT ["/usr/local/bin/review"]
