// src/utils/logger.js
module.exports = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERR]', ...args),
  debug: (...args) => console.debug('[DBG]', ...args)
};
