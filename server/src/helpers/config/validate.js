export default (config, schema) => {
  Object.keys(schema).forEach((fieldName) => {
    const configProperty = config[fieldName];
    const field = schema[fieldName];

    if (!configProperty && field.isRequired) {
      return `Pool's ${config.address} config is wrong. Field _${field}_ is not valid. Cannot start Pool.`;
    } else if (!configProperty && configProperty !== 0 && field.default) {
      config[fieldName] = field.default;
    }

    if (configProperty && field.type !== configProperty.__proto__.constructor) {
      return `Pool's ${config.address} config is wrong. Field type _${field}_ is not valid, expected type is _${field.type.name}_. Cannot start Pool.`;
    }
  });
};
