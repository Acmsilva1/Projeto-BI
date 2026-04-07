'use strict';

/**
 * api/infra/rabbit.js
 * Cliente RabbitMQ com fallback seguro via amqplib.
 * Se QUEUE_ENABLED=false ou Rabbit offline, publish/subscribe são no-ops silenciosos.
 */

const ENABLED = process.env.QUEUE_ENABLED === 'true';
const RABBIT_URL = process.env.QUEUE_RABBIT_URL || 'amqp://guest:guest@localhost:5672';

/** Estado interno compartilhado */
const _state = {
  enabled: ENABLED,
  connected: false,
  status: ENABLED ? 'initializing' : 'disabled',
  lastError: null,
  connection: null,
  channel: null,
};

/**
 * Tenta conectar ao RabbitMQ. Chamado no warmup (não-bloqueante).
 * @returns {Promise<boolean>} true se conectou com sucesso
 */
async function connect() {
  if (!ENABLED) {
    _state.status = 'disabled';
    return false;
  }

  let amqp;
  try {
    amqp = require('amqplib');
  } catch {
    _state.status = 'error';
    _state.lastError = 'amqplib não instalado';
    console.warn('[RabbitMQ] amqplib não encontrado — mensageria desabilitada');
    return false;
  }

  try {
    const connection = await amqp.connect(RABBIT_URL, { timeout: 3000 });

    connection.on('error', (err) => {
      _state.connected = false;
      _state.status = 'disconnected';
      _state.lastError = err.message;
    });

    connection.on('close', () => {
      _state.connected = false;
      _state.status = 'disconnected';
      _state.channel = null;
      _state.connection = null;
      console.warn('[RabbitMQ] Conexão encerrada');
    });

    const channel = await connection.createChannel();

    channel.on('error', (err) => {
      _state.lastError = err.message;
    });

    _state.connection = connection;
    _state.channel = channel;
    _state.connected = true;
    _state.status = 'ok';
    _state.lastError = null;

    console.log('[RabbitMQ] Conectado com sucesso →', RABBIT_URL.replace(/:\/\/.*@/, '://***@'));
    return true;
  } catch (err) {
    _state.connected = false;
    _state.status = 'error';
    _state.lastError = err.message;
    console.warn('[RabbitMQ] Falha na conexão (app continua sem fila):', err.message);
    return false;
  }
}

/**
 * Publica uma mensagem em uma fila.
 * Se offline, descarta silenciosamente.
 * @param {string} queue Nome da fila
 * @param {object|string} payload Dados a publicar
 * @param {object} [options] amqplib sendToQueue options
 * @returns {Promise<boolean>} true se publicou com sucesso
 */
async function publish(queue, payload, options = { persistent: true }) {
  if (!_state.connected || !_state.channel) return false;
  try {
    const content = Buffer.from(
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );
    await _state.channel.assertQueue(queue, { durable: true });
    return _state.channel.sendToQueue(queue, content, options);
  } catch (err) {
    _state.lastError = err.message;
    return false;
  }
}

/**
 * Registra um consumer em uma fila.
 * Se offline, no-op silencioso.
 * @param {string} queue Nome da fila
 * @param {function} handler Função async (msg) => void
 * @returns {Promise<void>}
 */
async function subscribe(queue, handler) {
  if (!_state.connected || !_state.channel) return;
  try {
    await _state.channel.assertQueue(queue, { durable: true });
    await _state.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
        _state.channel.ack(msg);
      } catch (err) {
        console.error('[RabbitMQ] Erro ao processar mensagem:', err.message);
        _state.channel.nack(msg, false, false); // descarta sem requeue
      }
    });
  } catch (err) {
    _state.lastError = err.message;
    console.warn('[RabbitMQ] Falha ao registrar consumer:', err.message);
  }
}

/**
 * Retorna o status atual do módulo de mensageria.
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

module.exports = { connect, publish, subscribe, getStatus };
