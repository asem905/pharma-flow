import appError from "../utils/appError.js";
import httpStatusText from "../utils/httpStatusText.js";
import jwt from "jsonwebtoken";
const verifyToken = async (req, res, next) => {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  console.log("Auth Header:", authHeader);
  if (!authHeader) {
    const error = appError.createErrorResponse(
      "Access denied. No token provided.",
      401,
      httpStatusText.FAIL
    );
    return next(error);
  }
  const token = authHeader.split(" ")[1].trim();
  console.log("Extracted Token:", token);
  if (!token) {
    const error = appError.createErrorResponse(
      "Access denied. No token provided.",
      401,
      httpStatusText.FAIL
    );
    return next(error);
  }
  await jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
    if (err) {
      console.log(err);
      const error = appError.createErrorResponse(
        "Invalid or expired token.",
        403,
        httpStatusText.FAIL
      );
      return next(error);
    }
    req.currentUser = user;
  });

  next();
};
export default verifyToken;
