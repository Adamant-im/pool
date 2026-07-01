/**
 * Applies schema defaults and returns the first config validation error.
 * @param {object} config Pool configuration object to validate and enrich
 * @param {object} schema Config schema keyed by config field name
 * @returns {string|undefined} Validation error message when the config is invalid
 */
export default (config, schema) => {
  for (const fieldName of Object.keys(schema)) {
    const configProperty = config[fieldName];
    const field = schema[fieldName];

    if (!configProperty && field.isRequired) {
      return `Pool's ${config.address} config is wrong. Field _${fieldName}_ is not valid. Cannot start Pool.`;
    } else if (!configProperty && configProperty !== 0 && field.default) {
      config[fieldName] = field.default;
    }

    if (configProperty && field.type !== configProperty.__proto__.constructor) {
      return `Pool's ${config.address} config is wrong. Field type _${fieldName}_ is not valid, expected type is _${field.type.name}_. Cannot start Pool.`;
    }

    if (field.allowedValues && !field.allowedValues.includes(config[fieldName])) {
      return `Pool's ${config.address} config is wrong. Field _${fieldName}_ must be one of: ${field.allowedValues.join(', ')}. Cannot start Pool.`;
    }
  }
};
