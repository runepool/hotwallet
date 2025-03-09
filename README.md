
## Psbst output structure 

```
Buy Psbt:

     0 - Taker received amount
  1..n - Maker rune change
   n+1 - Protocol rune fee
   n+2 - Edict
n+3..m - Maker received sats amount
   m+1 - Protocol sats fee
```

```
Sell Psbt:

     0 - Taker rune change
  1..n - Maker received rune amounts
   n+1 - Edict
n+2..m - Taker received amount
   m+1 - Protocol sats fee
```

TODO: 

 -- Why does filled amount go negative
 -- Wrap up validation on maker side