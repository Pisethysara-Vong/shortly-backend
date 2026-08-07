import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app/app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  it('root() returns the title used for the index view', () => {
    const result = appController.root();
    expect(result).toEqual({ title: 'Shortly API' });
  });
});