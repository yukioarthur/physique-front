const el = (id) => document.getElementById(id);

const state = {
  lastController: null,
};

const importantHeaders = [
  'content-type',
  'location',
  'x-rate-limit-plan',
  'x-rate-limit-remaining',
  'x-rate-limit-retry-after-seconds',
  'ratelimit',
  'ratelimit-policy',
  'retry-after',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers'
];

function init() {
  el('currentOrigin').textContent = window.location.origin;
  el('baseUrl').value = sessionStorage.getItem('physique.baseUrl') || 'https://physiquewebservice.onrender.com';
  el('apiVersion').value = sessionStorage.getItem('physique.apiVersion') || '1';
  el('idempotencyKey').value = crypto.randomUUID();
  updateFinishBody();

  ['usuarioId', 'treinoId', 'exercicioId'].forEach((id) => {
    el(id).addEventListener('input', updateFinishBody);
  });

  el('saveSession').addEventListener('click', () => {
    sessionStorage.setItem('physique.baseUrl', normalizeBaseUrl(el('baseUrl').value));
    sessionStorage.setItem('physique.apiVersion', el('apiVersion').value);
    showLocalMessage('Configuração salva para esta sessão. A API Key não foi salva por segurança.');
  });

  el('clearSession').addEventListener('click', () => {
    sessionStorage.removeItem('physique.baseUrl');
    sessionStorage.removeItem('physique.apiVersion');
    el('baseUrl').value = 'https://physiquewebservice.onrender.com';
    el('apiVersion').value = '1';
    showLocalMessage('Sessão limpa.');
  });

  el('newIdempotencyKey').addEventListener('click', () => {
    el('idempotencyKey').value = crypto.randomUUID();
  });

  document.querySelectorAll('[data-test]').forEach((button) => {
    button.addEventListener('click', () => runPreset(button.dataset.test));
  });

  el('finishWorkout').addEventListener('click', finishWorkout);
}

function normalizeBaseUrl(value) {
  return (value || '').trim().replace(/\/+$/, '');
}

function getConfig() {
  return {
    baseUrl: normalizeBaseUrl(el('baseUrl').value),
    apiKey: el('apiKey').value.trim(),
    apiVersion: el('apiVersion').value,
    usuarioId: el('usuarioId').value || '1',
    treinoId: el('treinoId').value || '1',
    exercicioId: el('exercicioId').value || '1',
  };
}

function defaultHeaders({ includeKey = true, version = null, json = false, idempotencyKey = null } = {}) {
  const cfg = getConfig();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (includeKey && cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;
  if (version ?? cfg.apiVersion) headers['X-API-Version'] = version ?? cfg.apiVersion;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

function updateFinishBody() {
  const cfg = getConfig();
  const today = new Date().toISOString().slice(0, 10);
  const body = {
    usuarioId: Number(cfg.usuarioId),
    treinoId: Number(cfg.treinoId),
    data: today,
    series: [
      {
        exercicioId: Number(cfg.exercicioId),
        numeroSerie: 1,
        repeticoes: 10,
        peso: 40
      }
    ]
  };
  el('finishBody').value = JSON.stringify(body, null, 2);
}

async function runPreset(test) {
  const cfg = getConfig();

  const routes = {
    apiDocs: {
      title: 'GET /api-docs',
      method: 'GET',
      path: '/api-docs',
      headers: {},
    },
    dashboard: {
      title: `GET /dashboard/${cfg.usuarioId}`,
      method: 'GET',
      path: `/dashboard/${encodeURIComponent(cfg.usuarioId)}`,
      headers: defaultHeaders({ includeKey: true }),
    },
    treinoV1: {
      title: `GET /treinos/${cfg.treinoId} • V1`,
      method: 'GET',
      path: `/treinos/${encodeURIComponent(cfg.treinoId)}`,
      headers: defaultHeaders({ includeKey: true, version: '1' }),
    },
    treinoV2: {
      title: `GET /treinos/${cfg.treinoId} • V2`,
      method: 'GET',
      path: `/treinos/${encodeURIComponent(cfg.treinoId)}`,
      headers: defaultHeaders({ includeKey: true, version: '2' }),
    },
    dashboardNoKey: {
      title: `GET /dashboard/${cfg.usuarioId} sem X-API-Key`,
      method: 'GET',
      path: `/dashboard/${encodeURIComponent(cfg.usuarioId)}`,
      headers: defaultHeaders({ includeKey: false }),
    },
    preflightDashboard: {
      title: 'OPTIONS /dashboard/{usuarioId}',
      method: 'OPTIONS',
      path: `/dashboard/${encodeURIComponent(cfg.usuarioId)}`,
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-API-Key,X-API-Version,Content-Type',
      },
    },
    preflightPost: {
      title: 'OPTIONS /treinos/finalizar',
      method: 'OPTIONS',
      path: '/treinos/finalizar',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-API-Key,X-API-Version,Idempotency-Key',
      },
    },
  };

  const request = routes[test];
  if (!request) return;
  await executeRequest(request);
}

async function finishWorkout() {
  let parsedBody;
  try {
    parsedBody = JSON.parse(el('finishBody').value);
  } catch (error) {
    renderResult({
      title: 'JSON inválido no body',
      method: 'POST',
      url: '/treinos/finalizar',
      status: 'erro local',
      duration: '-',
      headers: {},
      body: { error: 'JSON inválido', message: error.message },
      diagnostic: 'Corrija o JSON antes de enviar para a API.'
    });
    return;
  }

  await executeRequest({
    title: 'POST /treinos/finalizar',
    method: 'POST',
    path: '/treinos/finalizar',
    headers: defaultHeaders({
      includeKey: true,
      json: true,
      idempotencyKey: el('idempotencyKey').value.trim()
    }),
    body: JSON.stringify(parsedBody),
  });
}

async function executeRequest({ title, method, path, headers = {}, body = null }) {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path}`;
  setLoading(true);
  setMeta({ title, method, url, duration: 'executando...' });

  const started = performance.now();

  try {
    const response = await fetch(url, {
      method,
      mode: 'cors',
      headers,
      body,
    });

    const duration = `${Math.round(performance.now() - started)} ms`;
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const parsed = parseBody(rawText, contentType);

    renderResult({
      title,
      method,
      url,
      status: `${response.status} ${response.statusText}`,
      ok: response.ok,
      duration,
      headers: extractHeaders(response.headers),
      body: parsed,
      diagnostic: buildHttpDiagnostic(response.status, path, method),
    });
  } catch (error) {
    const duration = `${Math.round(performance.now() - started)} ms`;
    renderResult({
      title,
      method,
      url,
      status: 'Falha na requisição',
      ok: false,
      duration,
      headers: {},
      body: {
        error: 'Falha na requisição',
        message: error.message,
        possibleCauses: [
          'A API está desligada ou a URL base está errada.',
          'A origem do GitHub Pages não está liberada no CORS da API.',
          'Você está em HTTPS chamando HTTP remoto, causando mixed content.',
          'A rede bloqueou o acesso ao host/porta da API.',
          'O backend não respondeu corretamente ao preflight OPTIONS.',
          'O endpoint /api-docs foi configurado, mas o frontend ainda tenta /v3/api-docs.'
        ]
      },
      diagnostic: buildCorsDiagnostic(cfg, method, path, headers),
    });
  } finally {
    setLoading(false);
  }
}

function parseBody(rawText, contentType) {
  if (!rawText) return null;
  if (contentType.includes('application/json')) {
    try { return JSON.parse(rawText); } catch { return rawText; }
  }
  try { return JSON.parse(rawText); } catch { return rawText; }
}

function extractHeaders(headers) {
  const output = {};
  importantHeaders.forEach((name) => {
    const value = headers.get(name);
    if (value !== null) output[name] = value;
  });
  return output;
}

function renderResult({ title, method, url, status, ok, duration, headers, body, diagnostic }) {
  el('resultTitle').textContent = title;
  el('statusBadge').textContent = status;
  el('statusBadge').className = `badge ${badgeClass(status, ok)}`;
  setMeta({ title, method, url, duration });
  el('headersOutput').textContent = stringify(headers || {});
  el('bodyOutput').textContent = stringify(body);
  el('diagnosticOutput').textContent = diagnostic;
}

function setMeta({ method, url, duration }) {
  el('metaMethod').textContent = method || '-';
  el('metaUrl').textContent = url || '-';
  el('metaDuration').textContent = duration || '-';
}

function badgeClass(status, ok) {
  if (ok) return 'ok';
  const text = String(status || '');
  if (text.startsWith('4')) return 'warn';
  if (text.startsWith('5') || text.includes('Falha')) return 'error';
  return 'neutral';
}

function stringify(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function buildHttpDiagnostic(status, path, method) {
  const lines = [];
  lines.push(`Chamada concluída: ${method} ${path}`);
  lines.push(`Status HTTP: ${status}`);
  if (status === 200 || status === 201) lines.push('OK: API respondeu com sucesso.');
  if (status === 400) lines.push('400: entrada inválida, versionamento inválido ou Bean Validation.');
  if (status === 401) lines.push('401: X-API-Key ausente, inválida ou expirada.');
  if (status === 403) lines.push('403: chave válida, mas sem permissão, ou CORS inválido em chamada de navegador.');
  if (status === 404) lines.push('404: rota ou recurso não encontrado.');
  if (status === 409) lines.push('409: conflito, comum quando Idempotency-Key ainda está PROCESSING.');
  if (status === 422) lines.push('422: mesma Idempotency-Key usada com payload diferente.');
  if (status === 429) lines.push('429: rate limit excedido. Veja Retry-After.');
  if (status >= 500) lines.push('500: erro interno. Verifique logs do Render/Spring Boot.');
  return lines.join('\n');
}

function buildCorsDiagnostic(cfg, method, path, headers) {
  const requestedHeaders = Object.keys(headers).join(',') || '(sem headers customizados)';
  return [
    'A requisição caiu no catch do fetch(). Em navegador, isso costuma indicar bloqueio de rede/CORS.',
    '',
    `Origem atual: ${window.location.origin}`,
    `API base: ${cfg.baseUrl}`,
    `Endpoint: ${method} ${path}`,
    `Headers enviados: ${requestedHeaders}`,
    '',
    'No Spring Boot, confira se CorsConfig.java permite:',
    '- Origin: https://yukioarthur.github.io',
    '- Origin: https://physiquewebservice.onrender.com',
    '- Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS',
    '- Headers: Content-Type, X-API-Key, X-API-Version, Idempotency-Key',
    '- ApiKeyAuthenticationFilter e IdempotencyFilter ignoram OPTIONS',
    '',
    'Teste recomendado no terminal:',
    `curl -i -X OPTIONS "${cfg.baseUrl}${path}" \\\n  -H "Origin: ${window.location.origin}" \\\n  -H "Access-Control-Request-Method: ${method === 'OPTIONS' ? 'GET' : method}" \\\n  -H "Access-Control-Request-Headers: Content-Type,X-API-Key,X-API-Version,Idempotency-Key"`
  ].join('\n');
}

function setLoading(isLoading) {
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = isLoading;
  });
}

function showLocalMessage(message) {
  renderResult({
    title: 'Mensagem local',
    method: '-',
    url: '-',
    status: 'local',
    ok: true,
    duration: '-',
    headers: {},
    body: { message },
    diagnostic: 'Mensagem gerada pelo frontend, sem chamada para a API.'
  });
}

init();
