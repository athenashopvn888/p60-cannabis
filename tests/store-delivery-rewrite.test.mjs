import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');

test('P60 exposes only the public Store Delivery page, assets and read-only data feed',()=>{
  assert.match(config,/source: "\/store-delivery", destination: "https:\/\/sd2-pos\.vercel\.app\/store-delivery"/);
  assert.match(config,/source: "\/store-delivery-assets\/:path\*", destination: "https:\/\/sd2-pos\.vercel\.app\/store-delivery-assets\/:path\*"/);
  assert.match(config,/source: "\/store-delivery-data\/:path\*", destination: "https:\/\/sd2-pos\.vercel\.app\/store-delivery-data\/:path\*"/);
  assert.doesNotMatch(config,/source: "\/sd2-pos/);
});
