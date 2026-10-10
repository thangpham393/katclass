const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { lineSubtotal, lineDiscount, lineTotal, invoiceTotal, invoiceDebt, invoiceStatus } = require('../src/lib/db-invoices.ts');

test('Existing invoice items and global cash discounts keep their original totals', () => {
  const items = [{ name: 'Học phí', qty: 2, price: 2000000 }];
  assert.equal(lineSubtotal(items[0]), 4000000);
  assert.equal(lineDiscount(items[0]), 0);
  assert.equal(invoiceTotal(items, 200000), 3800000);
  assert.equal(invoiceDebt({ items, discount: 200000, paid_amount: 1000000 }), 2800000);
});

test('Mixed percent/cash reductions apply to each line including quantity, then global discount', () => {
  const items = [
    { name: 'Học phí', qty: 2, price: 2000000, discount_type: 'percent', discount_value: 10 },
    { name: 'Giáo trình', qty: 1, price: 500000, discount_type: 'cash', discount_value: 50000 },
  ];
  assert.equal(lineDiscount(items[0]), 400000);
  assert.equal(lineTotal(items[1]), 450000);
  assert.equal(invoiceTotal(items, 200000), 3850000);
  assert.equal(invoiceStatus({ items, discount: 200000, paid_amount: 0 }), 'unpaid');
  assert.equal(invoiceStatus({ items, discount: 200000, paid_amount: 1000000 }), 'partial');
  assert.equal(invoiceStatus({ items, discount: 200000, paid_amount: 3850000 }), 'paid');
});

test('Percent rounding matches PostgreSQL VND amounts and free lines do not become negative', () => {
  const rounded = { name: 'Lẻ', qty: 1, price: 1001, discount_type: 'percent', discount_value: 33.3 };
  assert.equal(lineDiscount(rounded), 333);
  assert.equal(lineTotal(rounded), 668);
  const free = { ...rounded, discount_value: 100 };
  assert.equal(lineTotal(free), 0);
  assert.equal(invoiceTotal([free], 0), 0);
});
