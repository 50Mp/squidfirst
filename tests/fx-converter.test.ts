import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewLakForUsd} from '../admin-ui/src/fx-converter.js';
test('FX example converter uses exact decimal math and two-decimal half-up rounding',()=>{
 assert.equal(previewLakForUsd('10','22675.43'),'226,754.30');
 assert.equal(previewLakForUsd('20','22675.43'),'453,508.60');
 assert.equal(previewLakForUsd('0.01','1.5'),'0.02');
 assert.equal(previewLakForUsd('0','22675.43'),'0.00');
 assert.equal(previewLakForUsd('9999999.99','999999999999.999999'),'9,999,999,989,999,999,990.00');
});
test('invalid converter input never becomes a displayed price',()=>{
 for(const [usd,rate] of [['','22675.43'],['-10','22675.43'],['1.001','22675.43'],['1','0'],['1','NaN'],['1','-2'],['1','1e4'],['10000000','1']])assert.equal(previewLakForUsd(usd,rate),null);
});
