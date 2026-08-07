// ============================================================================
// URL CONTROLLER SPEC
// File: src/app/resources/r2-url/controller.spec.ts
// ============================================================================
//
// UrlService is mocked — this file only proves the controller wires things
// correctly: the decorated user/params are forwarded to the right service
// method, results pass through unmodified, and the two admin-only routes
// enforce their inline `user.role !== RoleEnum.ADMIN` check BEFORE calling
// the service. Real business logic (dedup, short-code generation, URL
// normalization, ownership checks, cascading delete) is covered in
// service.spec.ts, not here.
//
// NOTE ON ROUTE ORDERING: @Get('admin/all') and @Get('admin/user/:userId')
// are declared before the catch-all @Get(':id') in controller.ts, which is
// required — Nest matches routes in declaration order, so if :id were
// declared first it would swallow requests to /admin/all (treating "admin"
// as the :id value) at the real HTTP layer. Unit tests calling controller
// methods directly (as these do) can't detect a route-ordering regression,
// since there's no actual HTTP routing involved — only an e2e/supertest
// test hitting real paths would catch that.

jest.mock('../../../../prisma/client', () => ({
  prismaClient: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UrlController } from './controller';
import { UrlService } from './service';
import { CreateUrlDto, UrlResponse } from './dto';
import { RoleEnum } from '../../../../enums/role.enum';
import { type TokenPayload } from '../../constants/jwt';

describe('UrlController', () => {
  let controller: UrlController;
  let service: jest.Mocked<UrlService>;

  const regularUser: TokenPayload = {
    id: 'user-uuid-1',
    email: 'user@x.com',
    role: RoleEnum.USER,
  } as TokenPayload;

  const adminUser: TokenPayload = {
    id: 'admin-uuid-1',
    email: 'admin@x.com',
    role: RoleEnum.ADMIN,
  } as TokenPayload;

  const mockUrlResponse: UrlResponse = {
    id: '123',
    shortCode: 'abc1234',
    originalUrl: 'https://example.com/page',
    clickCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UrlController],
      providers: [
        {
          provide: UrlService,
          useValue: {
            createUrl: jest.fn(),
            getUserUrls: jest.fn(),
            getUrlById: jest.fn(),
            deleteUrl: jest.fn(),
            getAllUrlsAdmin: jest.fn(),
            getUserUrlsAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UrlController>(UrlController);
    service = module.get(UrlService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ========================================================================
  // CREATE URL
  // ========================================================================
  describe('createUrl', () => {
    const dto: CreateUrlDto = { originalUrl: 'https://example.com/page' };

    it('delegates to urlService.createUrl with the decorated user id and dto, and returns its result', async () => {
      service.createUrl.mockResolvedValueOnce(mockUrlResponse);

      const result = await controller.createUrl(regularUser, dto);

      expect(service.createUrl).toHaveBeenCalledTimes(1);
      expect(service.createUrl).toHaveBeenCalledWith(regularUser.id, dto);
      expect(result).toBe(mockUrlResponse);
    });
  });

  // ========================================================================
  // GET AUTHENTICATED USER'S URLs
  // ========================================================================
  describe('getUserUrls', () => {
    it("delegates to urlService.getUserUrls with the decorated user's id", async () => {
      service.getUserUrls.mockResolvedValueOnce([mockUrlResponse]);

      const result = await controller.getUserUrls(regularUser);

      expect(service.getUserUrls).toHaveBeenCalledWith(regularUser.id);
      expect(result).toEqual([mockUrlResponse]);
    });
  });

  // ========================================================================
  // ADMIN: GET ALL URLs
  // ========================================================================
  describe('getAllUrlsAdmin', () => {
    it('delegates to urlService.getAllUrlsAdmin when the caller is an admin', async () => {
      service.getAllUrlsAdmin.mockResolvedValueOnce([mockUrlResponse]);

      const result = await controller.getAllUrlsAdmin(adminUser);

      expect(service.getAllUrlsAdmin).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockUrlResponse]);
    });

    it('throws ForbiddenException and never calls the service when the caller is not an admin', async () => {
      const err = await controller
        .getAllUrlsAdmin(regularUser)
        .catch((e) => e);

      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.message).toBe('Admin access required');
      expect(service.getAllUrlsAdmin).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // ADMIN: GET URLs FOR SPECIFIC USER
  // ========================================================================
  describe('getUserUrlsAdmin', () => {
    it('delegates to urlService.getUserUrlsAdmin with the target userId when the caller is an admin', async () => {
      service.getUserUrlsAdmin.mockResolvedValueOnce([mockUrlResponse]);

      const result = await controller.getUserUrlsAdmin(
        adminUser,
        'target-user-id',
      );

      expect(service.getUserUrlsAdmin).toHaveBeenCalledWith('target-user-id');
      expect(result).toEqual([mockUrlResponse]);
    });

    it('throws ForbiddenException and never calls the service when the caller is not an admin', async () => {
      const err = await controller
        .getUserUrlsAdmin(regularUser, 'target-user-id')
        .catch((e) => e);

      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.message).toBe('Admin access required');
      expect(service.getUserUrlsAdmin).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // GET URL BY ID
  // ========================================================================
  describe('getUrlById', () => {
    it('delegates to urlService.getUrlById with the user id, role, and url id — for a regular user', async () => {
      service.getUrlById.mockResolvedValueOnce(mockUrlResponse);

      const result = await controller.getUrlById(regularUser, '123');

      expect(service.getUrlById).toHaveBeenCalledWith(
        regularUser.id,
        regularUser.role,
        '123',
      );
      expect(result).toBe(mockUrlResponse);
    });

    it('delegates to urlService.getUrlById with the admin role — controller performs no authorization check of its own here', async () => {
      service.getUrlById.mockResolvedValueOnce(mockUrlResponse);

      await controller.getUrlById(adminUser, '123');

      expect(service.getUrlById).toHaveBeenCalledWith(
        adminUser.id,
        RoleEnum.ADMIN,
        '123',
      );
    });

    it('propagates a BadRequestException for a malformed id, and a NotFoundException for a missing/inaccessible url', async () => {
      service.getUrlById.mockRejectedValueOnce(
        new BadRequestException('Invalid URL ID format'),
      );
      const badIdErr = await controller
        .getUrlById(regularUser, 'not-a-number')
        .catch((e) => e);
      expect(badIdErr).toBeInstanceOf(BadRequestException);

      service.getUrlById.mockRejectedValueOnce(
        new NotFoundException('URL not found or access denied'),
      );
      const notFoundErr = await controller
        .getUrlById(regularUser, '999')
        .catch((e) => e);
      expect(notFoundErr).toBeInstanceOf(NotFoundException);
      expect(notFoundErr.message).toBe('URL not found or access denied');
    });
  });

  // ========================================================================
  // DELETE / UNLINK URL
  // ========================================================================
  describe('deleteUrl', () => {
    it('delegates to urlService.deleteUrl with the user id and url id, and returns its result', async () => {
      const deleteResult = { message: 'URL removed from your account successfully' };
      service.deleteUrl.mockResolvedValueOnce(deleteResult);

      const result = await controller.deleteUrl(regularUser, '123');

      expect(service.deleteUrl).toHaveBeenCalledWith(regularUser.id, '123');
      expect(result).toBe(deleteResult);
    });

    it('propagates a NotFoundException when the url is not in the caller\'s account', async () => {
      service.deleteUrl.mockRejectedValueOnce(
        new NotFoundException('URL not found in your account'),
      );

      const err = await controller.deleteUrl(regularUser, '999').catch((e) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('URL not found in your account');
    });
  });
});