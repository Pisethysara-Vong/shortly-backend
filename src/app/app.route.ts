// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';
import { AccountModule } from './resources/r1-account/module';
import { UrlModule } from './resources/r2-url/module';
import { RedirectModule } from './resources/r3-redirect/module';

// ===========================================================================>> Custom Library

export const appRoutes: Routes = [{
    path: 'api',
    children: [
        {
            path: 'account',
            module: AccountModule
        },
        {
            path: 'url',
            module: UrlModule
        },
        {
            path: 'redirect',
            module: RedirectModule
        },
    ]
}];