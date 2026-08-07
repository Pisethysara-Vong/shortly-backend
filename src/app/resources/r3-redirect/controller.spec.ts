// ============================================================================
// REDIRECT CONTROLLER SPEC
// File: src/app/resources/r3-redirect/controller.spec.ts
// ============================================================================
//
// RedirectService is mocked — this file only proves the controller wires
// things correctly: the shortCode param is forwarded, a successful
// resolution results in a 302 redirect to the right URL, and a thrown
// error (NotFoundException / GoneException) propagates without the
// controller ever calling res.redirect(). Real resolution/caching/expiry
// logic is covered in service.spec.ts, not here.

jest.mock('../../../../prisma/client', () => ({
    prismaClient: {},
}));
import { Test, TestingModule } from '@nestjs/testing';
import { GoneException, HttpStatus, NotFoundException } from '@nestjs/common';
import { type Response } from 'express';
import { RedirectController } from './controller';
import { RedirectService } from './service';

describe('RedirectController', () => {
  let controller: RedirectController;
  let service: jest.Mocked<RedirectService>;

  const mockRes = {
    redirect: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedirectController],
      providers: [
        {
          provide: RedirectService,
          useValue: {
            resolveAndIncrement: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RedirectController>(RedirectController);
    service = module.get(RedirectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to redirectService.resolveAndIncrement with the shortCode route param', async () => {
    service.resolveAndIncrement.mockResolvedValueOnce('https://example.com/page');

    await controller.redirect('abc123', mockRes);

    expect(service.resolveAndIncrement).toHaveBeenCalledTimes(1);
    expect(service.resolveAndIncrement).toHaveBeenCalledWith('abc123');
  });

  it('redirects with a 302 Found status to the resolved original URL', async () => {
    service.resolveAndIncrement.mockResolvedValueOnce('https://example.com/page');

    await controller.redirect('abc123', mockRes);

    expect(mockRes.redirect).toHaveBeenCalledTimes(1);
    expect(mockRes.redirect).toHaveBeenCalledWith(
      HttpStatus.FOUND,
      'https://example.com/page',
    );
  });

  it('propagates a NotFoundException when the short code cannot be resolved, and never calls res.redirect', async () => {
    service.resolveAndIncrement.mockRejectedValueOnce(
      new NotFoundException('Short URL not found'),
    );

    const err = await controller.redirect('missing', mockRes).catch((e) => e);

    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Short URL not found');
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });

  it('propagates a GoneException when the short code has expired, and never calls res.redirect', async () => {
    service.resolveAndIncrement.mockRejectedValueOnce(
      new GoneException('Short URL has expired'),
    );

    const err = await controller.redirect('expired', mockRes).catch((e) => e);

    expect(err).toBeInstanceOf(GoneException);
    expect(err.message).toBe('Short URL has expired');
    expect(mockRes.redirect).not.toHaveBeenCalled();
  });
});