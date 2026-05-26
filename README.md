# Physique API Test Client

Frontend estático para GitHub Pages usado para testar a Physique API hospedada no Render.

## URL do site

https://yukioarthur.github.io/physique-front/

## URL da API

https://physiquewebservice.onrender.com

## O que testar

- GET `/api-docs`
- GET `/dashboard/{usuarioId}` com `X-API-Key`
- GET `/treinos/{treinoId}` com `X-API-Version: 1`
- GET `/treinos/{treinoId}` com `X-API-Version: 2`
- GET `/dashboard/{usuarioId}` sem API Key, esperando 401
- POST `/treinos/finalizar` com `Idempotency-Key`

## CORS necessário no Spring Boot

Liberar a origem:

```java
"https://yukioarthur.github.io"
```

Headers importantes:

```java
configuration.setAllowedHeaders(List.of("*"));
```

Métodos:

```java
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

Filtros de API Key e Idempotência devem ignorar `OPTIONS`.
