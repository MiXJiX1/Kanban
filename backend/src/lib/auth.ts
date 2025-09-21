import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "dev";
export const sign = (sub: string) => jwt.sign({ sub }, SECRET, { expiresIn: "7d" });
export const verify = (token: string) => jwt.verify(token, SECRET) as { sub: string };
