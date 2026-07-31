export const validateRole = (...roles) => {
    return (req, res, next) => {
        const userRole = req.currentUser?.role;
        console.log("userRole", userRole);
        console.log("roles", roles);
        if (!userRole || !roles.includes(userRole)) {

            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to perform this action"
            })
        }
        next()
    }
}