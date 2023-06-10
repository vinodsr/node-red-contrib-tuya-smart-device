const maskSensitiveData = (obj) => {
  return {
    ...obj,
    key: '**MASKED**',
    id: '**MASKED**',
  };
};

module.exports = {
  maskSensitiveData,
};
