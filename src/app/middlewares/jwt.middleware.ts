import { jwtConstants } from '../constants/jwt';
import { TokenPayload } from '../constants/jwt';
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Authorization token is missing or not in the correct format.',
      );
    }

    const token = authorizationHeader.split('Bearer ')[1];

    try {
      // Verify and decode the JWT
      const payload = jwt.verify(token, jwtConstants.secret) as TokenPayload;
      // console.log(payload); // debug
      let defaultRole = payload.role;

      // Set role in res.locals
      if (defaultRole) {
        res.locals.userRole = { role: defaultRole };
      } else {
        throw new UnauthorizedException('User does not have any valid roles.');
      }

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Authorization token is expired.');
      } else if (error instanceof jwt.JsonWebTokenError) {
        return res.json({ 
          statusCode: 401,
          message: 'Invalid token',
        });
      } else {
        return res.json({
          statusCode: 401,
          message: 'Invalid token number 2',
        });
      }
    }
  }
}
