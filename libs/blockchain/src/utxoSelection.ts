import { UnspentOutput } from "./bitcoin/types/UnspentOutput";


interface UTXOSelectionResult {
    selectedUTXOs: UnspentOutput[];
    totalValue: number;
    change: number;
    cost: number;
}


export const MAX_ITERATIONS = 10_000_000;
export const branchAndBoundUTXOSelection = (
    utxos: UnspentOutput[],
    target: number,
    feeRate: number
): UTXOSelectionResult => {
    let i = 0;
    let bestSolution: UTXOSelectionResult = { selectedUTXOs: [], totalValue: Infinity, change: Infinity, cost: 0 };
    let stack: { index: number; total: number; solution: UnspentOutput[] }[] = [];
    stack.push({ index: 0, total: 0, solution: [] });

    utxos = utxos.sort((a, b) => b.amount - a.amount).filter(item => item.amount > 148 * feeRate);

    while (stack.length > 0) {
        i++;
        if (i >= MAX_ITERATIONS) {
            break;
        }
        let { index, total, solution, } = stack.pop();

        let fee = feeRate * (solution.length * 148); // Approximate fee calculation
        if (total - fee >= target && fee < 30_000) {
            let change = total - target - fee;

            if (change >= 0 && (change < bestSolution.change)) {
                bestSolution = { selectedUTXOs: [...solution], totalValue: total, change: change, cost: fee };
            }

            continue;
        }

        if (index >= utxos.length) continue;

        if (feeRate * 148 > utxos[index].amount) continue;

        // Explore the branch that excludes the current UTXO
        stack.push({ index: index + 1, total: total, solution: [...solution] });

        // Explore the branch that includes the current UTXO
        stack.push({ index: index + 1, total: total + utxos[index].amount, solution: [...solution, utxos[index]] });
    }

    return bestSolution;
}
