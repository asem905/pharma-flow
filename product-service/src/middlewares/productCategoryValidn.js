import * as z from "zod";

const productSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(3).optional(),
    price: z.number().min(0),
    stock: z.number().int().min(0).optional(),
    image: z.string().url().optional(),
    brand: z.string().min(3),
    categoryId: z.string().uuid(),
})
const categorySchema = z.object({
    name: z.string().min(3),
})

const validateProduct = (req, res, next) => {
    const result = productSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    next();
}

const validateCategory = (req, res, next) => {
    const result = categorySchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues });
    }
    next();
}

export { validateProduct, validateCategory };
