(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const defaultBody = () => JSON.stringify({
    usuarioId: Number($('usuarioId')?.value || 1),
    treinoId: Number($('treinoId')?.value || 1),
    data: new Date().toISOString().slice(0, 10),
    series: [
      {
        exercicioId: Number($('exercicioId')?.value || 1),
        numeroSerie: 1,
        repeticoes: 10,
        peso: 40
      }
    ]
  }, null, 2);

  function init() {
    $('originText').textContent = window.location.origin;
    $('baseUrl').value = sessionStorage.getItem('physique_baseUrl') || 'https://physiquewebservice.onrender.com';
    $('apiVersion').value = sessionStorage.getItem('physique_apiVersion') || '1';
    $('apiKey').value = sessionStorage.getItem('physique_apiKey') || '';
    $('idempotencyKey').value = sessionStorage.getItem('physique_idempotencyKey') || crypto.randomUUID();
    $('bodyJson').value = sessionStorage.getItem('physique_bodyJson') || defaultBody();

    $('saveConfig').addEventListener('click', saveConfig);
    $('clearConfig').addEventListener('click', clearConfig);
    $('newIdempotencyKey').addEventListener('click', newIdempotencyKey);
    $('resetBody').addEventListener('click', () => {
      $('bodyJson').value = defaultBody();
      sessionStorage.setItem('physique_bodyJson', $('bodyJson').value);
    });
    $('postFinalizar').addEventListener('click', postFinalizar);
    $('clearResult').addEventListener('click', clearResult);

    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => runAction(button.dataset.action));
    });

    ['baseUrl', 'apiKey', 'apiVersion', 'bodyJson'].forEach((id) => {
      $(id).addEventListener('change', saveConfigSilent);
      $(id).addEventListener('input', saveConfigSilent);
    });
  }

  function saveConfigSilent() {
    sessionStorage.setItem('physique_baseUrl', sanitizeBaseUrl($('baseUrl').value));
    sessionStorage.setItem('physique_apiVersion', $('apiVersion').value);
    sessionStorage.setItem('physique_apiKey', $('apiKey').value.trim());
    sessionStorage.setItem('physique_bodyJson', $('bodyJson').value);
  }

  function saveConfig() {
    saveConfigSilent();
    setStatus('ok', 'Configuração salva');
    setSummary('ok', 'Configuração salva nesta sessão do navegador.');
  }

  function clearConfig() {
    sessionStorage.clear();
    $('apiKey').value = '';
    $('baseUrl').value = 'https://physiquewebservice.onrender.com';
    $('apiVersion').value = '1';
    $('idempotencyKey').value = crypto.randomUUID();
    $('bodyJson').value = defaultBody();
    clearResult();
    setStatus('', 'Aguardando teste');
  }

  function newIdempotencyKey() {
    $('idempotencyKey').value = crypto.randomUUID();
    sessionStorage.setItem('physique_idempotencyKey', $('idempotencyKey').value);
  }

  function sanitizeBaseUrl(value) {
    return (value || '').trim().replace(/\/+$/, '');
  }

  function config() {
    return {
      baseUrl: sanitizeBaseUrl($('baseUrl').value),
      apiKey: $('apiKey').value.trim(),
      version: $('apiVersion').value,
      usuarioId: $('usuarioId').value || '1',
      treinoId: $('treinoId').value || '1',
      exercicioId: $('exercicioId').value || '1'
    };
  }

  function authHeaders(versionOverride) {
    const cfg = config();
    const headers = {
      'Accept': 'application/json',
      'X-API-Version': String(versionOverride || cfg.version || '1')
    };
    if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;
    return headers;
  }

  async function runAction(action) {
    const cfg = config();
    const routes = {
      apiDocs: { method: 'GET', path: '/api-docs', headers: { 'Accept': 'application/json' } },
      root: { method: 'GET', path: '/', headers: { 'Accept': 'application/json' } },
      dashboard: { method: 'GET', path: `/dashboard/${cfg.usuarioId}`, headers: authHeaders() },
      treinoV1: { method: 'GET', path: `/treinos/${cfg.treinoId}`, headers: authHeaders('1') },
      treinoV2: { method: 'GET', path: `/treinos/${cfg.treinoId}`, headers: authHeaders('2') },
      dashboardNoKey: { method: 'GET', path: `/dashboard/${cfg.usuarioId}`, headers: { 'Accept': 'application/json', 'X-API-Version': cfg.version || '1' } }
    };
    await callApi(routes[action]);
  }

  async function postFinalizar() {
    saveConfigSilent();
    let parsed;
    try {
      parsed = JSON.parse($('bodyJson').value);
    } catch (error) {
      setStatus('error', 'JSON inválido');
      setSummary('error', 'O body informado não é um JSON válido. Corrija antes de enviar.');
      $('resultOutput').textContent = String(error.message || error);
      return;
    }

    const headers = authHeaders();
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = $('idempotencyKey').value.trim() || crypto.randomUUID();
    sessionStorage.setItem('physique_idempotencyKey', headers['Idempotency-Key']);

    await callApi({
      method: 'POST',
      path: '/treinos/finalizar',
      headers,
      body: JSON.stringify(parsed)
    });
  }

  async function callApi(request) {
    const cfg = config();
    const url = `${cfg.baseUrl}${request.path}`;
    setLoading(true);
    setStatus('', 'Executando...');
    setSummary('', `Chamando ${request.method} ${url}`);

    const startedAt = performance.now();
    try {
      const response = await fetch(url, {
        method: request.method,
        headers: request.headers || {},
        body: request.body,
        mode: 'cors',
        cache: 'no-store'
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const rawText = await response.text();
      const body = tryParseJson(rawText);
      const headers = pickHeaders(response.headers);

      const payload = {
        request: {
          method: request.method,
          url,
          headers: maskHeaders(request.headers || {}),
          body: request.body ? tryParseJson(request.body) : undefined
        },
        response: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          elapsedMs: elapsed,
          headers,
          body
        }
      };

      setStatus(response.ok ? 'ok' : 'error', `${response.status} ${response.statusText}`);
      setSummary(response.ok ? 'ok' : 'error', `Resposta recebida: ${response.status} ${response.statusText} em ${elapsed}ms.`);
      $('resultOutput').textContent = JSON.stringify(payload, null, 2);
    } catch (error) {
      const diagnostic = {
        error: 'Falha na requisição',
        message: error.message || String(error),
        request: {
          method: request.method,
          url,
          headers: maskHeaders(request.headers || {})
        },
        possibleCauses: [
          'A URL base da API está errada ou a API está desligada.',
          'A origem https://yukioarthur.github.io não está liberada no CORS.',
          'O backend não respondeu corretamente ao preflight OPTIONS.',
          'O navegador bloqueou a requisição por CORS ou mixed content.',
          'Algum header enviado pelo frontend não está em allowedHeaders.'
        ],
        nextChecks: [
          'Abra https://physiquewebservice.onrender.com/ no navegador.',
          'Abra https://physiquewebservice.onrender.com/api-docs no navegador.',
          'No DevTools > Network, veja se a chamada OPTIONS falhou.',
          'Confirme no Spring Boot se CorsConfig libera https://yukioarthur.github.io e allowedHeaders=*.'
        ]
      };
      setStatus('error', 'Failed to fetch');
      setSummary('error', 'O navegador bloqueou ou não conseguiu completar a requisição. Veja o diagnóstico abaixo.');
      $('resultOutput').textContent = JSON.stringify(diagnostic, null, 2);
    } finally {
      setLoading(false);
    }
  }

  function tryParseJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  function pickHeaders(headers) {
    const keep = [
      'content-type',
      'location',
      'x-rate-limit-plan',
      'x-rate-limit-remaining',
      'x-rate-limit-retry-after-seconds',
      'ratelimit',
      'ratelimit-policy',
      'retry-after'
    ];
    const out = {};
    keep.forEach((name) => {
      const value = headers.get(name);
      if (value !== null) out[name] = value;
    });
    return out;
  }

  function maskHeaders(headers) {
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
      if (key.toLowerCase() === 'x-api-key' && value) return [key, `${String(value).slice(0, 8)}...`];
      return [key, value];
    }));
  }

  function setLoading(loading) {
    document.querySelectorAll('button').forEach((button) => {
      if (button.id !== 'clearResult') button.disabled = loading;
    });
  }

  function setStatus(type, text) {
    const dot = $('statusDot');
    dot.className = 'dot';
    if (type) dot.classList.add(type);
    $('statusText').textContent = text;
  }

  function setSummary(type, text) {
    const summary = $('resultSummary');
    summary.className = 'result-summary';
    if (type) summary.classList.add(type);
    summary.textContent = text;
  }

  function clearResult() {
    $('resultOutput').textContent = 'Clique em um teste para executar.';
    setSummary('', 'Nenhuma chamada executada ainda.');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
