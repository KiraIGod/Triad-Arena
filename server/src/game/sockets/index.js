const jwt = require("jsonwebtoken");

io.use((socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error("UNAUTHORIZED"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId;
    return next();
  } catch {
    return next(new Error("UNAUTHORIZED"));
  }
});
