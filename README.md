# Physique API Test Client — GitHub Pages

Frontend estático para testar CORS e integração com a Physique API.

Ele foi feito para rodar em GitHub Pages sem build, sem Node, sem framework e sem dependências externas.

## Arquivos

```text
index.html
styles.css
app.js
README.md
```

## O que ele testa

- `GET /v3/api-docs`
- `GET /dashboard/{usuarioId}`
- `GET /treinos/{treinoId}` com `X-API-Version: 1`
- `GET /treinos/{treinoId}` com `X-API-Version: 2`
- `POST /treinos/finalizar` com `Idempotency-Key`
- Erro 401 sem `X-API-Key`
- Headers de rate limit retornados pela API
- CORS/preflight real feito pelo navegador

## Como publicar no GitHub Pages

1. Crie um repositório, por exemplo: `physique-api-test-client`.
2. Suba estes arquivos na raiz do repositório.
3. No GitHub, vá em Settings > Pages.
4. Source: Deploy from a branch.
5. Branch: `main`; Folder: `/root`.
6. Acesse a URL gerada.

Exemplo:

```text
https://SEU_USUARIO.github.io/physique-api-test-client/
```

## Ajuste obrigatório no CORS da API

A API precisa liberar a origem do GitHub Pages.

No backend Spring Boot, a origem a liberar normalmente é:

```text
https://SEU_USUARIO.github.io
```

O path do repositório não entra no `allowedOrigins`.

## Headers usados pelo frontend

### Endpoints protegidos

```http
X-API-Key: SUA_CHAVE
X-API-Version: 1
```

### POST crítico

```http
X-API-Key: SUA_CHAVE
X-API-Version: 1
Idempotency-Key: UUID_DA_OPERACAO
Content-Type: application/json
```

## Segurança

Não coloque `X-API-Key` fixa no código do GitHub Pages.

Este frontend pede a chave manualmente no navegador. Isso evita publicar a chave no repositório.

## Fluxo

```text
GitHub Pages
  ↓
Browser
  ↓ preflight OPTIONS, se houver headers customizados
Spring Boot API
  ↓
CORS valida Origin, Methods e Headers
  ↓
X-API-Key valida chave/plano
  ↓
Rate limit consome token
  ↓
Idempotency-Key valida POST crítico
  ↓
Bean Validation valida body
  ↓
Service/Repository
  ↓
MySQL da faculdade
  ↓
Beekeeper para inspeção
```

## Teste manual de preflight

```bash
curl -i -X OPTIONS "http://localhost:8080/treinos" \
  -H "Origin: https://SEU_USUARIO.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,X-API-Key,Idempotency-Key,X-API-Version"
```

Esperado:

```text
Access-Control-Allow-Origin: https://SEU_USUARIO.github.io
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,X-API-Key,Idempotency-Key,X-API-Version
```
