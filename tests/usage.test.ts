import {summarizeUsage} from '../lib/usage';
test('counts measured usage without treating limits as tokens or unknown costs as zero',()=>{
 expect(summarizeUsage([{meta:'{"maxTokens":4096}'},{meta:'{"usage":{"totalTokens":37}}'},{meta:'broken'}])).toEqual({totalTokens:37,measuredCalls:1,totalCost:null,pricedCalls:0});
});
test('accepts explicitly recorded zero cost',()=>{
 expect(summarizeUsage([{meta:'{"tokensUsed":10,"cost":0}'}]).totalCost).toBe(0);
});
