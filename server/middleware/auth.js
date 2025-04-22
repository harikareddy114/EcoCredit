const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    console.log("Auth middleware called for:", req.method, req.originalUrl);

    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("No authorization header found");
      return res
        .status(401)
        .json({ message: "No authorization token, access denied" });
    }

    // Verify token
    const token = authHeader.split(" ")[1]; // Bearer TOKEN
    if (!token) {
      console.log("No token found in authorization header");
      return res.status(401).json({ message: "No token, access denied" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      console.log(
        "Token decoded successfully. User:",
        decoded.id,
        "Role:",
        decoded.role
      );
      req.user = decoded;
      next();
    } catch (err) {
      console.log("Token verification failed:", err.message);
      res.status(401).json({ message: "Token is not valid" });
    }
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ message: "Server error in auth middleware" });
  }
};

module.exports = { auth };
