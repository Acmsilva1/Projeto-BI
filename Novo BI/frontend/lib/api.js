/**
 * api.js - Cliente de comunicacao com backend Node.js.
 */

const API_BASE = 'http://localhost:3001/api/v1';
const _CACHE = new Map();
const CACHE_TTL_MS = 2500;

async function fetchAPI(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);

  const globalFilters = window.AppState?.filters || {};
  const allParams = { ...globalFilters, ...params };

  Object.entries(allParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const cacheKey = url.toString();
  const now = Date.now();
  const cached = _CACHE.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API ${endpoint} -> ${response.status}`);
  }

  const data = await response.json();
  _CACHE.set(cacheKey, { ts: now, data });
  return data;
}

function formatCurrency(value) {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(2).replace('.', ',')}M`;
  if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(0)}K`;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value, decimals = 1) {
  if (value === undefined || value === null) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

window.API = { fetchAPI, formatCurrency, formatNumber };
window.DEMO_MODE = false;


