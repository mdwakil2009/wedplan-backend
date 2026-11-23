
import { jwtVerify, createRemoteJWKSet } from "jose";

const authURL = process.env.CLIENT_URL;

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authURL)
);

// Verify JWT
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authURL,
      audience: authURL,
    });

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);

    return res.status(401).send({
      message: "Invalid or expired token",
    });
  }
};

// Verify Admin Role
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).send({
      message: "Forbidden access. Admin only.",
    });
  }

  next();
};
