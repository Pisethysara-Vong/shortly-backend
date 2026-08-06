import 'dotenv/config';

export const jwtConstants = {
  secret: process.env.JWT_SECRET as string,
};

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
