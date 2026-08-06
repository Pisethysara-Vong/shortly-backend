// ================================================================>> Core Library
import { ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';

// ================================================================>> Third Party Library
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';
import { TokenPayload } from '../constants/jwt';

const UserDecorator = createParamDecorator(
  async (_data, context: ExecutionContext) => {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error(
        'JWT secret key is not defined in environment variables.',
      );
    }
    const request = context.switchToHttp().getRequest();
    const token: string = request.headers?.authorization?.split('Bearer ')[1];
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = jwt.verify(token, secretKey) as TokenPayload;
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  },
);
export default UserDecorator;
