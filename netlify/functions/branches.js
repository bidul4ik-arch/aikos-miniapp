const data = require("./data/branches.json");
exports.handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ ok: true, branches: data })
});