const maskSensitiveData = (obj) => {
  return {
    ...obj,
    key: '**MASKED**',
    id: '**MASKED**',
  };
};

const LOG_LEVELS = {
  DEBUG: 3,
  INFO: 2,
  ERROR: 1,
};

const UI_LOG_LEVELS = {
  'log-level-trace': 4,
  'log-level-debug': 3,
  'log-level-info': 2,
  'log-level-error': 1,
  'log-level-disable': -1,
};
const noop = () => {};
const createLogger = (node, level) => {
  return {
    log: (msg, data) => (level >= LOG_LEVELS.INFO ? node.log(msg, data) : noop),
    debug: (msg, data) =>
      level >= LOG_LEVELS.DEBUG ? node.debug(msg, data) : noop,
    error: (msg, data) =>
      level >= LOG_LEVELS.ERROR ? node.error(msg, data) : noop,
  };
};

module.exports = {
  maskSensitiveData,
  createLogger,
  UI_LOG_LEVELS,
};
