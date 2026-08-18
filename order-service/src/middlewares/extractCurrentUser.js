const extractCurrentUser = (req, res, next) => {
    const userHeader = req.headers["x-current-user"];
    console.log("userHeader", userHeader);
    if (userHeader) {
        try {
            req.currentUser = JSON.parse(userHeader);
        } catch {
            req.currentUser = null;
        }
    }
    console.log("req.currentUser", req.currentUser);
    next();
};

export default extractCurrentUser;
