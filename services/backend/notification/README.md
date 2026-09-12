# Notification Service

E-posta (Mailpit SMTP) + SMS stub. Şablonlar:

- order.paid / order.montage_scheduled / order.service_on_the_way
- payment.succeeded / payment.failed

- `GET /v1/notifications/templates`
- `POST /v1/notifications/send`

Port: `8092` · Schema: `notification`
