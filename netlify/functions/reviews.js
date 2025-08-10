const data = require("./data/reviews.json");
exports.handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ ok: true, links: data })
});