import 'reflect-metadata';
import { Module, type Provider } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { DRailwayClient } from './d-railway.client';
import { WagonModule } from './wagon.module';

/**
 * DRailwayClient haqiqiy DI orqali yaratiladimi. vitest (esbuild) design:paramtypes ni
 * chiqarmaydi, tsc esa chiqaradi va API prodda shu bilan ishga tushadi: shuning uchun tsc
 * yozadigan metadata bu yerda qo'lda beriladi. Oddiy class provider bo'lsa Nest
 * "Object, Function" tokenlarini topolmay butun API ni yiqitadi; useFactory bilan ko'tariladi.
 * ponytail: @nestjs/testing o'rnatilmagan; WagonModule ning providers ro'yxati o'zi olinadi,
 * IdentityModule zanjiri (@Inject li konstruktorlar) metadata siz ko'tarilmaydi, shuning uchun
 * faqat shu modulning providerlari sinaladi.
 */
Reflect.defineMetadata('design:paramtypes', [Object, Function], DRailwayClient);

const providers = Reflect.getMetadata('providers', WagonModule) as Provider[];

@Module({ providers })
class Probe {}

describe('WagonModule', () => {
  it("DRailwayClient DI orqali yaratiladi (useFactory)", async () => {
    expect(providers).toHaveLength(1);
    const app = await NestFactory.createApplicationContext(Probe, { logger: false, abortOnError: false });
    try {
      expect(app.get(DRailwayClient)).toBeInstanceOf(DRailwayClient);
    } finally {
      await app.close();
    }
  });

  it('oddiy class provider bo\'lsa yiqiladi (nega useFactory kerakligi)', async () => {
    @Module({ providers: [DRailwayClient] })
    class Bare {}
    await expect(NestFactory.createApplicationContext(Bare, { logger: false, abortOnError: false })).rejects.toThrow(/DRailwayClient/);
  });
});
