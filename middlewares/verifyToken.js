
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ObjectId } from "mongodb";

const authURL = process.env.CLIENT_URL;

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authURL)
);

// Verify JWT and check current user status
export const verifyToken = (usersCollection) => {
  return async (req, res, next) => {
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

      const userId = payload.sub;

      if (!userId) {
        return res.status(401).send({
          message: "Invalid user token",
        });
      }

      // Support both ObjectId and string MongoDB IDs
      const idQuery = [{ _id: userId }];

      if (ObjectId.isValid(userId)) {
        idQuery.push({ _id: new ObjectId(userId) });
      }

      const user = await usersCollection.findOne({
        $or: idQuery,
      });

      if (!user) {
        return res.status(401).send({
          message: "User not found",
        });
      }

      if (user.isBlocked) {
        return res.status(403).send({
          message: "Your account has been blocked",
        });
      }

      // Always use current database role
      req.user = {
        ...payload,
        id: userId,
        role: user.role,
      };

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);

      return res.status(401).send({
        message: "Invalid or expired token",
      });
    }
  };
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
// Verify Vendor Role
export const verifyVendor = (req, res, next) => {
  if (req.user?.role !== "vendor") {
    return res.status(403).send({
      message: "Forbidden access. Vendor only.",
    });
  }

  next();
};