const calculateSplits = (amount: bigint, splitSize: number, maxCost: number, feeRate: number, isRuneSplit: boolean): { maxSplits: number, amountPerSplit: bigint } => {
    let maxSplits = Math.max(1, Math.floor(Number(amount) / splitSize));
    let totalCosts = maxSplits * 40 * feeRate + (isRuneSplit ? (maxSplits * 546) : 0);
    while (totalCosts > maxCost) {
        if (maxSplits == 1) break;
        maxSplits--;
        totalCosts = maxSplits * 40 * feeRate + (isRuneSplit ? (maxSplits * 546) : 0);
    }
    const amountPerSplit = amount / BigInt(maxSplits);
    return { maxSplits, amountPerSplit };
};