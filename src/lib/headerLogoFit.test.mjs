// Header bar, "Logo fit": an opt-in select next to the logo size. The
// storefront reads an unset value as 'box' (the square logo box every stored
// header has today); only a header added from now on starts with 'height'.
// The key, values and defaults are the contract shared with the storefront
// (multi-stores-web/src/themes/minimal/sections/chrome/HeaderBar.tsx).
// Run: node --experimental-strip-types --test src/lib/headerLogoFit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSectionSchema } from './section-schemas.ts';

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];
const header = findSectionSchema('header-bar');
const field = header.schema.find((f) => f.key === 'logo_fit');

test('logo_fit is a select right after logo_size', () => {
  const keys = header.schema.map((f) => f.key);
  assert.equal(keys[keys.indexOf('logo_size') + 1], 'logo_fit');
  assert.equal(field.type, 'select');
  assert.deepEqual(field.options.map((o) => o.value), ['box', 'height']);
});

test("an unset value shows 'box'; a new header starts with 'height'", () => {
  assert.equal(field.defaultValue, 'box');
  assert.equal(header.defaultSettings.logo_fit, 'height');
});

test('label, description and options in six locales', () => {
  assert.deepEqual(field.label, {
    en: 'Logo fit',
    ar: 'ملاءمة الشعار',
    tr: 'Logo sığdırma',
    de: 'Logo-Anpassung',
    fr: 'Ajustement du logo',
    sv: 'Logotypens anpassning',
  });
  assert.deepEqual(field.options[0].label, {
    en: 'Inside a square',
    ar: 'داخل مربع',
    tr: 'Kare içinde',
    de: 'In einem Quadrat',
    fr: 'Dans un carré',
    sv: 'I en kvadrat',
  });
  assert.deepEqual(field.options[1].label, {
    en: 'Keep proportions',
    ar: 'الحفاظ على النِّسب',
    tr: 'Oranları koru',
    de: 'Proportionen beibehalten',
    fr: 'Conserver les proportions',
    sv: 'Behåll proportionerna',
  });
  // The description names the option by its label and states both limits.
  for (const loc of LOCALES) {
    const text = field.description[loc];
    assert.ok(typeof text === 'string' && text.trim(), `description: no ${loc}`);
    assert.ok(text.includes(field.options[1].label[loc]), `description ${loc} names the option`);
    assert.ok(text.includes('56'), `description ${loc} states the height limit`);
  }
  assert.equal(
    field.description.en,
    'For a wide wordmark choose "Keep proportions": the logo is as tall as the logo size (at most 56 px) and as wide as it needs, up to five times its height.',
  );
  assert.equal(
    field.description.ar,
    'للشعار العريض اختر «الحفاظ على النِّسب»: يكون ارتفاع الشعار بحجم الشعار (56 بكسل كحد أقصى) وعرضه بحسب حاجته حتى خمسة أضعاف ارتفاعه.',
  );
});

test('every other header-bar field and default is as it was', () => {
  assert.deepEqual(header.schema.map((f) => f.key), [
    'show_logo', 'show_store_name', 'logo_url', 'logo_url_mobile', 'store_name_override',
    'logo_size', 'logo_fit', 'show_search', 'show_cart', 'cart_action', 'show_account',
    'show_locale', 'sticky_mode', 'submenu_style', 'active_style', 'bg_color', 'text_color',
    'border_color', 'accent_color', 'menu_key', 'items',
  ]);
  const logoSize = header.schema.find((f) => f.key === 'logo_size');
  assert.deepEqual(
    { type: logoSize.type, min: logoSize.min, max: logoSize.max, defaultValue: logoSize.defaultValue },
    { type: 'number', min: 16, max: 96, defaultValue: 32 },
  );
  assert.deepEqual(header.defaultSettings, {
    show_logo: true,
    show_store_name: true,
    show_search: true,
    show_cart: true,
    cart_action: 'page',
    show_account: false,
    show_locale: true,
    sticky_mode: 'always',
    submenu_style: 'dropdown',
    active_style: 'text',
    logo_size: 32,
    logo_fit: 'height',
  });
});
