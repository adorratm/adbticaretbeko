# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY shared/go ./shared/go
COPY services/backend/reporting ./services/backend/reporting
WORKDIR /src/services/backend/reporting
RUN go mod download && CGO_ENABLED=0 go build -o /out/reporting ./cmd/reporting

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /out/reporting /usr/local/bin/reporting
EXPOSE 8098
ENTRYPOINT ["/usr/local/bin/reporting"]
