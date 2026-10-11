# D-06 offline eval

- Corpus: `test/fixtures/d06-intent-corpus.json` (synthetic households only).
- Offline semantic checks: `npm run test:unit -- test/d06-intent-eval.test.js`
- Live preview sample (not CI): `npm run eval:d06:live -- --url <preview-url> --max-usd 0.05`
