/**
 * Parses the x-current-user header forwarded by the API Gateway
 * and attaches it to req.currentUser so validateRole can read it.
 */
const extractCurrentUser = (req, res, next) => {
    const userHeader = req.headers["x-current-user"];
    if (userHeader) {
        try {
            req.currentUser = JSON.parse(userHeader);
        } catch {
            req.currentUser = null;
        }
    }
    next();
};

export default extractCurrentUser;
