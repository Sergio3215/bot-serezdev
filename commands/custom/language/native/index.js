const implementations = require("./implementations.js");
const types = require("./types.js");
const registry = require("./registry.js");

const nativeRegistry = registry.CreateNativeRegistry(implementations);

module.exports = {
    implementations,
    nativeRegistry,
    ...types,
    ...registry,
};
