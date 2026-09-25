// Usage: node --import ./tests/support/register.mjs --test …
import { register } from 'node:module';

register('./ts-loader.mjs', import.meta.url);
