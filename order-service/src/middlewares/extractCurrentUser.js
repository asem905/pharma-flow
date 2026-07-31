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
