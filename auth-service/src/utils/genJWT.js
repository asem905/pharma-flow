import jwt from "jsonwebtoken"
const genJWT = async (payload) => {
    return await jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: "2h" });
}
export default genJWT