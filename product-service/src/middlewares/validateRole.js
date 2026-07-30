export const validateRole = (...roles) => {
    return (req, res, next) => {
        const userRole = req.currentUser?.role;
        if (!userRole || !roles.includes(userRole)) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to perform this action"
            })
        }
        next()
    }
}