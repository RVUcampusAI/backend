function ok(res, message, data = {}, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, status = 400, data = null) {
  const body = { success: false, message };
  if (data !== null && data !== undefined) body.data = data;
  return res.status(status).json(body);
}

module.exports = { ok, fail };
