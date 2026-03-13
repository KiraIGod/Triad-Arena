const jwt = require("jsonwebtoken")

function jwtMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: "Missing token" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret")
    req.user = decoded
    return next()
  } catch (_error) {
    return res.status(401).json({ message: "Invalid token" })
  }
}

module.exports = { jwtMiddleware }
