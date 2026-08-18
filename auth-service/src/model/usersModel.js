import { prisma } from "../config/db.js";

class UsersModel {

    static async findAll(where = {}, select = {}) {
        console.log("select", select);

        const users = await prisma.users.findMany({
            where,
            select
        });
        console.log("users", users);
        return users;
    }
    static async findByEmail(email) {
        const user = await prisma.users.findUnique({
            where: {
                email
            }
        });
        return user;
    }
    static async findById(id) {
        const user = await prisma.users.findUnique({
            where: {
                id
            }
        });
        return user;
    }
    static async create(data) {
        const user = await prisma.users.create({
            data
        });
        return user;
    }
    static async update(id, data) {
        const user = await prisma.users.update({
            where: {
                id
            },
            data
        });
        return user;
    }
    static async delete(id) {
        const user = await prisma.users.delete({
            where: {
                id
            }
        });
        return user;
    }
    static async count() {
        return await prisma.users.count();
    }

}

export default UsersModel;
