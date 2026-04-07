'use strict';

/**
 * api/infra/redis.js
 * Cliente Redis com fallback seguro.
 * Se CACHE_ENABLED=false ou Redis offline, todas as ops retornam null silenciosamente.
 */

const ENABLED = process.env.CACHE_ENABLED === 'true';
const REDIS_URL = process.env.CACHE_REDIS_URL || 'redis://localhost:6379';

/** Estado interno compartilhado */
const _state = {
  enabled: ENABLED,
  connected: false,
  status: ENABLED ? 'initializing' : 'disabled',
  lastError: null,
  client: null,
};

/** Stub sem-operação para quando cache está desabilitado/offline */
const _stub = {
  async get() { return null; },
  async set() { return null; },
  async del() { return null; },
  async ping() { return null; },
};

/**
 * Tenta conectar ao Redis. Chamado no warmup (não-bloqueante).
 * @returns {Promise<boolean>} true se conectou com sucesso
 */
async function connect() {
  if (!ENABLED) {
    _state.status = 'disabled';
    return false;
  }

  let Redis;
  try {
    Redis = require('ioredis');
  } catch {
    _state.status = 'error';
    _state.lastError = 'ioredis não instalado';
    console.warn('[Redis] ioredis não encontrado — cache desabilitado');
    return false;
  }

  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Silenciar erros não tratados (evita crash do processo)
    client.on('error', (err) => {
      _state.connected = false;
      _state.status = 'disconnected';
      _state.lastError = err.message;
    });

    client.on('connect', () => {
      _state.connected = true;
      _state.status = 'ok';
      _state.lastError = null;
      console.log('[Redis] Conectado com sucesso →', REDIS_URL);
    });

    client.on('close', () => {
      _state.connected = false;
      _state.status = 'disconnected';
    });

    await client.connect();
    _state.client = client;
    return true;
  } catch (err) {
    _state.connected = false;
    _state.status = 'error';
    _state.lastError = err.message;
    console.warn('[Redis] Falha na conexão (app continua sem cache):', err.message);
    return false;
  }
}

/** Retorna o cliente ativo ou o stub */
function _client() {
  return (_state.connected && _state.client) ? _state.client : _stub;
}

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Lê uma chave do cache.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  try {
    return await _client().get(key);
  } catch {
    return null;
  }
}

/**
 * Grava uma chave no cache.
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds=300] TTL em segundos (default 5 min)
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    if (_state.connected && _state.client) {
      await _state.client.set(key, value, 'EX', ttlSeconds);
    }
  } catch {
    // silencioso
  }
}

/**
 * Remove uma chave do cache.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function del(key) {
  try {
    await _client().del(key);
  } catch {
    // silencioso
  }
}

/**
 * Retorna o status atual do módulo de cache.
 * @returns {{ enabled: boolean, connected: boolean, status: string, lastError: string|null }}
 */
function getStatus() {
  return {
    enabled: _state.enabled,
    connected: _state.connected,
    status: _state.status,
    lastError: _state.lastError,
  };
}

module.exports = { connect, get, set, del, getStatus };
