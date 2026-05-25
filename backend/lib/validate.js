const { z } = require("zod");

function validateSchema(schema) {
  return (req, res, next) => {
    try {
      const source = (req.method === "GET" || req.method === "DELETE") ? req.query : req.body;
      const result = schema.parse(source);
      // attach parsed data for handlers
      req.validated = result;
      return next();
    } catch (err) {
      // Zod error
      err.status = 400;
      return next(err);
    }
  };
}

module.exports = { validateSchema, z };
