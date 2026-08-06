import { RoleEnum } from '../../../enums/role.enum';
import { ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class UserMiddleware implements NestMiddleware {
    
    use(req: Request, res: Response, next: NextFunction) {
        // Extract roles from res.locals
        const userRole = res.locals.userRole as { role: string } | undefined;

        if (!userRole) {
            throw new UnauthorizedException('Unauthorized: No role found.');
        }
        const isUser = userRole.role === RoleEnum.USER;

        if (!isUser) {
            throw new ForbiddenException('Access denied. You do not have the required permissions to access this route.');
        }
        next();
    }
}
