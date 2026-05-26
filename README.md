# Physique API • Cliente GitHub Pages

Frontend estático em HTML/CSS/JS puro para testar a API Spring Boot hospedada no Render.

## URL do frontend

Exemplo:

```text
https://yukioarthur.github.io/physique-front/
```

## URL da API

```text
https://physiquewebservice.onrender.com
```

## Correções incluídas nesta versão

- Botão corrigido de `/v3/api-docs` para `/api-docs`.
- Painel visual de resposta HTTP, headers e body.
- Diagnóstico mais claro para `Failed to fetch`.
- Testes de `OPTIONS` para CORS/preflight.
- Envio de `X-API-Key`, `X-API-Version` e `Idempotency-Key`.
- Não salva API Key em `sessionStorage` nem no código.

## O que o backend precisa liberar no CORS

No Spring Boot, libere as origens:

```java
"https://yukioarthur.github.io",
"https://physiquewebservice.onrender.com"
```

A origem do GitHub Pages é apenas `https://yukioarthur.github.io`, não inclui `/physique-front/`.

Também permita os métodos:

```java
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

E os headers:

```java
Content-Type, Accept, Authorization, X-API-Key, X-API-Version, Idempotency-Key, X-Idempotency-Key, Origin, Cache-Control
```

Para MVP acadêmico, pode usar:

```java
configuration.setAllowedHeaders(List.of("*"));
```

## Como publicar no GitHub Pages

1. Suba `index.html`, `styles.css`, `app.js` e `README.md` no repositório.
2. Vá em `Settings > Pages`.
3. Selecione `Deploy from a branch`.
4. Branch: `main`.
5. Folder: `/root` ou `/docs`, conforme onde você colocou os arquivos.

## Testes sugeridos

1. GET `/api-docs`.
2. GET `/dashboard/{usuarioId}` com `X-API-Key`.
3. GET `/treinos/{treinoId}` V1.
4. GET `/treinos/{treinoId}` V2.
5. GET dashboard sem `X-API-Key` para mostrar 401.
6. POST `/treinos/finalizar` com `Idempotency-Key`.
